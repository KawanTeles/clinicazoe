"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency } from "@/lib/whatsapp";
import { getAttendanceInfo } from "@/lib/attendance";
import { MODALITY_LABELS, PARTICULAR_PRODUCT_LABELS, insuranceRequiresModality } from "@/lib/constants";
import type { Modality, ParticularProduct, PaymentMethod } from "@/lib/supabase/types";
import {
  getBookableInsurances,
  getBookableProfessionals,
  getAvailableDates,
  getAvailableTimes,
  getProfessionalPricing,
  type ProfessionalPricingResult,
} from "@/modules/appointments/services/booking-queries";
import { createAppointment } from "@/modules/appointments/services/booking-actions";

interface Option {
  id: string;
  name: string;
}

interface ProfessionalOption {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  bio: string | null;
}

interface TimeOption {
  slotId: string;
  startTime: string;
  endTime: string;
}

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cartao: "Cartão",
  pix: "PIX",
  dinheiro: "Dinheiro",
  convenio: "Convênio",
};

const MODALITIES: Modality[] = ["aba", "comum"];
const PARTICULAR_PAYMENT_METHODS: PaymentMethod[] = ["cartao", "pix", "dinheiro"];

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });

export function BookingWizard({ specialties }: { specialties: Option[] }) {
  const router = useRouter();
  const [step, setStep] = useState(1);

  const [specialty, setSpecialty] = useState<Option | null>(null);
  const [insurances, setInsurances] = useState<Option[]>([]);
  const [insurance, setInsurance] = useState<Option | null>(null);
  const [professionals, setProfessionals] = useState<ProfessionalOption[]>([]);
  const [professional, setProfessional] = useState<ProfessionalOption | null>(null);
  const [dates, setDates] = useState<string[]>([]);
  const [date, setDate] = useState<string | null>(null);
  const [times, setTimes] = useState<TimeOption[]>([]);
  const [time, setTime] = useState<TimeOption | null>(null);
  const [pricing, setPricing] = useState<ProfessionalPricingResult | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [modality, setModality] = useState<Modality | null>(null);
  const [particularProduct, setParticularProduct] = useState<ParticularProduct | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ whatsappLink: string | null } | null>(null);

  const requiresModality = insuranceRequiresModality(insurance?.name);
  const STEP = {
    specialty: 1,
    insurance: 2,
    professional: 3,
    modality: requiresModality ? 4 : -1,
    date: requiresModality ? 5 : 4,
    time: requiresModality ? 6 : 5,
    confirmation: requiresModality ? 7 : 6,
  };
  const stepLabels = requiresModality
    ? ["Especialidade", "Convênio", "Profissional", "Modalidade", "Data", "Horário", "Confirmação"]
    : ["Especialidade", "Convênio", "Profissional", "Data", "Horário", "Confirmação"];
  const selectedValue =
    pricing?.insuranceKind === "convenio"
      ? pricing.options.find((o) => o.modality === modality)?.value ?? null
      : pricing?.insuranceKind === "particular"
        ? pricing.options.find((o) => o.product === particularProduct)?.value ?? null
        : null;

  async function selectSpecialty(option: Option) {
    setSpecialty(option);
    setInsurance(null);
    setProfessional(null);
    setLoading(true);
    setError(null);
    const data = await getBookableInsurances(option.id);
    setInsurances(data);
    setLoading(false);
    setStep(2);
  }

  async function selectInsurance(option: Option) {
    setInsurance(option);
    setProfessional(null);
    setPricing(null);
    setModality(null);
    setParticularProduct(null);
    setPaymentMethod(null);
    setLoading(true);
    setError(null);
    const data = await getBookableProfessionals(specialty!.id, option.id);
    setProfessionals(data);
    setLoading(false);
    if (data.length === 0) setError("Nenhum profissional disponível para essa combinação.");
    setStep(3);
  }

  async function selectProfessional(option: ProfessionalOption) {
    setProfessional(option);
    setDate(null);
    setModality(null);
    setParticularProduct(null);
    setPaymentMethod(null);
    setLoading(true);
    setError(null);
    const [datesData, pricingResult] = await Promise.all([
      getAvailableDates(option.id),
      getProfessionalPricing(option.id, insurance!.id),
    ]);
    setDates(datesData);
    setPricing(pricingResult);
    setLoading(false);
    if (datesData.length === 0) setError("Esse profissional não tem horários disponíveis no momento.");
    setStep(requiresModality ? STEP.modality : STEP.date);
  }

  function selectModality(m: Modality) {
    setModality(m);
    setPaymentMethod("convenio");
    setStep(STEP.date);
  }

  async function selectDate(selected: string) {
    setDate(selected);
    setTime(null);
    setLoading(true);
    setError(null);
    const data = await getAvailableTimes(professional!.id, insurance!.id, selected, modality ?? undefined);
    setTimes(data);
    setLoading(false);
    if (data.length === 0) setError("Sem horários livres nesse dia. Escolha outra data.");
    setStep(STEP.time);
  }

  function selectTime(option: TimeOption) {
    setTime(option);
    setStep(STEP.confirmation);
  }

  async function handleConfirm() {
    if (!specialty || !insurance || !professional || !date || !time || !paymentMethod) return;
    if (requiresModality && !modality) {
      setError("Selecione a modalidade (ABA ou Comum).");
      return;
    }
    if (!requiresModality && !particularProduct) {
      setError("Selecione Consulta Particular ou Pacote Particular.");
      return;
    }

    setLoading(true);
    setError(null);

    const response = await createAppointment({
      professionalId: professional.id,
      specialtyId: specialty.id,
      insuranceId: insurance.id,
      scheduleSlotId: time.slotId,
      date,
      startTime: time.startTime,
      endTime: time.endTime,
      paymentMethod,
      modality: modality ?? undefined,
      particularProduct: particularProduct ?? undefined,
    });

    setLoading(false);

    if (response.error) {
      setError(response.error);
      return;
    }

    if (response.whatsappLink) {
      window.open(response.whatsappLink, "_blank");
    }

    setResult({ whatsappLink: response.whatsappLink ?? null });
  }

  if (result) {
    return (
      <Card className="max-w-xl mx-auto shadow-card border-primary/40">
        <CardContent className="flex flex-col items-center gap-5 p-8 text-center sm:p-10">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--badge-bg)] text-2xl text-[var(--primary)] border border-primary/40 shadow-sm">
            ✓
          </div>
          <div>
            <h2 className="text-xl font-bold text-text-primary font-heading">Agendamento enviado!</h2>
            <p className="mt-2 text-xs text-text-secondary leading-relaxed max-w-md">
              Sua consulta está pendente de confirmação pela recepção. Você pode acompanhar o status na aba &quot;Minhas Consultas&quot;.
            </p>
          </div>
          {result.whatsappLink && (
            <a href={result.whatsappLink} target="_blank" rel="noreferrer">
              <Button type="button" className="shadow-button font-bold text-xs">Reenviar no WhatsApp</Button>
            </a>
          )}
          <Button type="button" variant="secondary" onClick={() => router.push("/appointments")}>
            Ver minhas consultas
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ol className="flex flex-wrap gap-2 text-xs">
        {stepLabels.map(
          (label, index) => (
            <li key={label}>
              <span
                className={
                  step === index + 1
                    ? "inline-flex items-center rounded-full bg-[var(--primary)] px-3.5 py-1.5 font-bold text-white shadow-sm"
                    : step > index + 1
                      ? "inline-flex items-center rounded-full bg-[var(--badge-bg)] border border-primary/30 px-3.5 py-1.5 font-semibold text-[var(--primary)]"
                      : "inline-flex items-center rounded-full bg-card-elevated border border-border px-3.5 py-1.5 font-medium text-text-muted"
                }
              >
                {index + 1}. {label}
              </span>
            </li>
          )
        )}
      </ol>

      {error && <p className="text-xs font-semibold text-danger">{error}</p>}

      {step === 1 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {specialties.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => selectSpecialty(option)}
              className="rounded-2xl border border-border bg-card p-5 text-left text-sm font-bold text-text-primary shadow-card transition-all hover:border-primary hover:bg-card-elevated hover:-translate-y-0.5 cursor-pointer"
            >
              {option.name}
            </button>
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <>
              <Skeleton className="h-16 rounded-2xl" />
              <Skeleton className="h-16 rounded-2xl" />
              <Skeleton className="h-16 rounded-2xl" />
            </>
          ) : (
            insurances.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => selectInsurance(option)}
                className="rounded-2xl border border-border bg-card p-5 text-left text-sm font-bold text-text-primary shadow-card transition-all hover:border-primary hover:bg-card-elevated hover:-translate-y-0.5 cursor-pointer"
              >
                {option.name}
              </button>
            ))
          )}
        </div>
      )}

      {step === 3 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {loading ? (
            <>
              <Skeleton className="h-20 rounded-2xl" />
              <Skeleton className="h-20 rounded-2xl" />
            </>
          ) : (
            professionals.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => selectProfessional(option)}
                className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 text-left shadow-card transition-all hover:border-primary hover:bg-card-elevated hover:-translate-y-0.5 cursor-pointer"
              >
                <Avatar src={option.avatarUrl} name={option.fullName} size={44} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-text-primary">{option.fullName}</p>
                  {option.bio && <p className="truncate text-xs text-text-secondary mt-0.5">{option.bio}</p>}
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {step === STEP.modality && (
        <div className="flex flex-wrap gap-2.5">
          {loading ? (
            <Skeleton className="h-12 w-full rounded-xl" />
          ) : pricing?.insuranceKind === "convenio" && pricing.options.length > 0 ? (
            MODALITIES.map((m) => {
              const opt = pricing.options.find((o) => o.modality === m);
              return (
                <button
                  key={m}
                  type="button"
                  disabled={!opt}
                  onClick={() => opt && selectModality(m)}
                  className={
                    !opt
                      ? "rounded-xl border border-border/50 bg-card-elevated/30 px-4 py-3 text-xs font-bold text-text-muted cursor-not-allowed"
                      : "rounded-xl border border-border bg-card px-4 py-3 text-xs font-bold text-text-primary shadow-sm transition-all hover:border-primary hover:bg-card-elevated cursor-pointer"
                  }
                >
                  {MODALITY_LABELS[m]}
                  {opt ? ` — ${formatCurrency(opt.value)}` : " (sem valor)"}
                </button>
              );
            })
          ) : (
            <p className="text-xs font-semibold text-danger">
              Este profissional ainda não possui um valor cadastrado para essa modalidade.
            </p>
          )}
        </div>
      )}

      {step === STEP.date && (
        <div className="flex flex-wrap gap-2.5">
          {loading ? (
            <Skeleton className="h-12 w-full rounded-xl" />
          ) : (
            dates.map((iso) => (
              <button
                key={iso}
                type="button"
                onClick={() => selectDate(iso)}
                className="rounded-xl border border-border bg-card px-4 py-3 text-xs font-bold text-text-primary shadow-sm transition-all hover:border-primary hover:bg-card-elevated cursor-pointer"
              >
                {WEEKDAY_FORMATTER.format(new Date(`${iso}T00:00:00`))}
              </button>
            ))
          )}
        </div>
      )}

      {step === STEP.time && (
        <div className="flex flex-wrap gap-2.5">
          {loading ? (
            <Skeleton className="h-12 w-full rounded-xl" />
          ) : (
            times.map((option) => (
              <button
                key={`${option.slotId}-${option.startTime}`}
                type="button"
                onClick={() => selectTime(option)}
                className="rounded-xl border border-border bg-card px-4 py-3 text-xs font-bold text-text-primary shadow-sm transition-all hover:border-primary hover:bg-card-elevated cursor-pointer"
              >
                {option.startTime.slice(0, 5)}
              </button>
            ))
          )}
        </div>
      )}

      {step === STEP.confirmation && specialty && insurance && professional && date && time && (
        <Card className="border-border shadow-card">
          <CardContent className="flex flex-col gap-5 p-6">
            {(() => {
              const attendance = getAttendanceInfo(insurance?.name, paymentMethod, modality ?? undefined, particularProduct ?? undefined);
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs rounded-xl border border-border bg-card-elevated/50 p-4">
                  <p>
                    <span className="text-text-muted">Especialidade: </span>
                    <span className="font-bold text-text-primary">{specialty.name}</span>
                  </p>
                  <p>
                    <span className="text-text-muted">Profissional: </span>
                    <span className="font-bold text-text-primary">{professional.fullName}</span>
                  </p>
                  <p>
                    <span className="text-text-muted">Tipo de Atendimento: </span>
                    <span className="font-bold text-text-primary">{attendance.attendanceType}</span>
                  </p>
                  {attendance.isConvenio ? (
                    <p>
                      <span className="text-text-muted">Convênio: </span>
                      <span className="font-bold text-text-primary">
                        {attendance.insuranceName}
                        {attendance.modalityLabel ? ` — ${attendance.modalityLabel}` : ""}
                      </span>
                    </p>
                  ) : paymentMethod ? (
                    <p>
                      <span className="text-text-muted">Forma de Pagamento: </span>
                      <span className="font-bold text-text-primary">{attendance.paymentMethodLabel}</span>
                    </p>
                  ) : null}
                  <p className="col-span-full">
                    <span className="text-text-muted">Data/Hora: </span>
                    <span className="font-bold text-[var(--primary)]">
                      {WEEKDAY_FORMATTER.format(new Date(`${date}T00:00:00`))} às {time.startTime.slice(0, 5)}
                    </span>
                  </p>
                  {selectedValue != null && (
                    <p className="col-span-full">
                      <span className="text-text-muted">Valor: </span>
                      <span className="font-black text-primary">{formatCurrency(selectedValue)}</span>
                    </p>
                  )}
                </div>
              );
            })()}

            {requiresModality ? null : pricing?.insuranceKind === "particular" && pricing.options.length > 0 ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-bold text-text-primary uppercase tracking-wider">Produto Particular</p>
                  <div className="flex flex-wrap gap-2">
                    {pricing.options.map((opt) => (
                      <button
                        key={opt.product}
                        type="button"
                        onClick={() => setParticularProduct(opt.product)}
                        className={
                          particularProduct === opt.product
                            ? "rounded-xl border-2 border-primary bg-[var(--badge-bg)] px-4 py-2.5 text-xs font-bold text-[var(--primary)] shadow-sm cursor-pointer"
                            : "rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-text-secondary hover:border-primary/50 cursor-pointer"
                        }
                      >
                        {PARTICULAR_PRODUCT_LABELS[opt.product]} — {formatCurrency(opt.value)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-bold text-text-primary uppercase tracking-wider">Forma de Pagamento</p>
                  <div className="flex flex-wrap gap-2">
                    {PARTICULAR_PAYMENT_METHODS.map((pm) => (
                      <button
                        key={pm}
                        type="button"
                        onClick={() => setPaymentMethod(pm)}
                        className={
                          paymentMethod === pm
                            ? "rounded-xl border-2 border-primary bg-[var(--badge-bg)] px-4 py-2.5 text-xs font-bold text-[var(--primary)] shadow-sm cursor-pointer"
                            : "rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-text-secondary hover:border-primary/50 cursor-pointer"
                        }
                      >
                        {PAYMENT_LABELS[pm]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs font-semibold text-danger">
                Valores particulares ainda não configurados em Configurações da Clínica.
              </p>
            )}

            {error && <p className="text-xs font-semibold text-danger">{error}</p>}

            <Button
              type="button"
              disabled={loading || !paymentMethod || (requiresModality ? !modality : !particularProduct)}
              onClick={handleConfirm}
              className="w-full font-bold shadow-button"
            >
              {loading ? "Confirmando..." : "Confirmar Agendamento"}
            </Button>
          </CardContent>
        </Card>
      )}

      {step > 1 && !result && (
        <Button type="button" variant="secondary" className="w-fit text-xs font-semibold" onClick={() => setStep(step - 1)}>
          ← Voltar Etapa
        </Button>
      )}
    </div>
  );
}
