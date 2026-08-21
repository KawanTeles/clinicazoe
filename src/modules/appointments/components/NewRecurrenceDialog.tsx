"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatCurrency } from "@/lib/whatsapp";
import { toLocalIsoDate, todayLocalIso } from "@/lib/date";
import { MODALITY_LABELS, PARTICULAR_PRODUCT_LABELS, insuranceRequiresModality } from "@/lib/constants";
import type { Modality, ParticularProduct, PaymentMethod, RecurrenceFrequency } from "@/lib/supabase/types";
import {
  getBookableProfessionalsByInsurance,
  getProfessionalPricing,
  getEffectiveDuration,
  getAvailableTimes,
  type ProfessionalPricingResult,
} from "@/modules/appointments/services/booking-queries";
import { createRecurringAppointments } from "@/modules/appointments/services/recurrence-actions";
import { WEEKDAY_LABELS } from "@/modules/appointments/services/recurrence-generator";

interface Option {
  id: string;
  name: string;
}

interface ProfessionalOption {
  id: string;
  fullName: string;
  specialty_id: string | null;
}

interface TimeOption {
  slotId: string;
  startTime: string;
  endTime: string;
}

const MODALITIES: Modality[] = ["aba", "comum"];
const PARTICULAR_PAYMENT_METHODS: PaymentMethod[] = ["cartao", "pix", "dinheiro"];
const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cartao: "Cartão",
  pix: "PIX",
  dinheiro: "Dinheiro",
  convenio: "Convênio",
};
const FREQUENCY_OPTIONS: { value: RecurrenceFrequency; label: string }[] = [
  { value: "weekly", label: "Semanalmente" },
  { value: "biweekly", label: "Quinzenalmente" },
  { value: "monthly", label: "Mensalmente" },
];

/** Primeira data >= startDate cujo dia da semana bate com dayOfWeek — mesma
 * regra usada no gerador de ocorrências no servidor (recurrence-generator.ts),
 * só que aqui é usada apenas para buscar os horários livres desse dia como
 * referência (o servidor recalcula tudo de novo ao criar a série). */
function nextWeekdayDate(startDate: string, dayOfWeek: number) {
  const d = new Date(`${startDate}T00:00:00`);
  while (d.getDay() !== dayOfWeek) d.setDate(d.getDate() + 1);
  return toLocalIsoDate(d);
}

interface NewRecurrenceDialogProps {
  patientId: string;
  patientName: string;
  insurances: Option[];
  onClose: () => void;
  onDone: (createdCount: number) => void;
}

export function NewRecurrenceDialog({ patientId, patientName, insurances, onClose, onDone }: NewRecurrenceDialogProps) {
  const [insurance, setInsurance] = useState<Option | null>(null);
  const [professionals, setProfessionals] = useState<ProfessionalOption[]>([]);
  const [professional, setProfessional] = useState<ProfessionalOption | null>(null);
  const [loadingProfessionals, setLoadingProfessionals] = useState(false);

  const [pricing, setPricing] = useState<ProfessionalPricingResult | null>(null);
  const [modality, setModality] = useState<Modality | null>(null);
  const [particularProduct, setParticularProduct] = useState<ParticularProduct | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [loadingPricing, setLoadingPricing] = useState(false);

  const [dayOfWeek, setDayOfWeek] = useState<number | null>(null);
  const [startDate, setStartDate] = useState(todayLocalIso());
  const [endDate, setEndDate] = useState("");
  const [maxOccurrences, setMaxOccurrences] = useState("");
  const [frequency, setFrequency] = useState<RecurrenceFrequency>("weekly");

  const [times, setTimes] = useState<TimeOption[]>([]);
  const [time, setTime] = useState<TimeOption | null>(null);
  const [loadingTimes, setLoadingTimes] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiresModality = insuranceRequiresModality(insurance?.name);

  async function handleSelectInsurance(option: Option) {
    setInsurance(option);
    setProfessional(null);
    setPricing(null);
    setModality(null);
    setParticularProduct(null);
    setPaymentMethod(null);
    setDuration(null);
    setTimes([]);
    setTime(null);
    setError(null);
    setLoadingProfessionals(true);
    const data = await getBookableProfessionalsByInsurance(option.id);
    setProfessionals(data.map((p) => ({ id: p.id, fullName: p.fullName, specialty_id: p.specialty_id })));
    setLoadingProfessionals(false);
    if (data.length === 0) setError("Nenhum profissional disponível para este convênio.");
  }

  async function handleSelectProfessional(option: ProfessionalOption) {
    setProfessional(option);
    setModality(null);
    setParticularProduct(null);
    setPaymentMethod(null);
    setDuration(null);
    setTimes([]);
    setTime(null);
    setError(null);
    if (!insurance) return;
    setLoadingPricing(true);
    const result = await getProfessionalPricing(option.id, insurance.id);
    setPricing(result);
    if (result.insuranceKind === "particular") {
      const effectiveDuration = await getEffectiveDuration(option.id, insurance.id);
      setDuration(effectiveDuration);
    }
    setLoadingPricing(false);
  }

  async function handleSelectModality(m: Modality) {
    if (!professional || !insurance) return;
    setModality(m);
    setPaymentMethod("convenio");
    setTimes([]);
    setTime(null);
    setLoadingPricing(true);
    const effectiveDuration = await getEffectiveDuration(professional.id, insurance.id, m);
    setDuration(effectiveDuration);
    setLoadingPricing(false);
  }

  // Busca os horários livres assim que profissional, convênio, modalidade (se
  // exigida), dia da semana e data de início estiverem definidos — mesma
  // checagem de disponibilidade usada no agendamento avulso, sem precisar de
  // um calendário completo aqui.
  useEffect(() => {
    if (!professional || !insurance || dayOfWeek === null || !startDate) {
      setTimes([]);
      setTime(null);
      return;
    }
    if (requiresModality && !modality) {
      setTimes([]);
      setTime(null);
      return;
    }

    let cancelled = false;
    setLoadingTimes(true);
    setTime(null);
    const anchorDate = nextWeekdayDate(startDate, dayOfWeek);
    getAvailableTimes(professional.id, insurance.id, anchorDate, modality ?? undefined).then((data) => {
      if (cancelled) return;
      setTimes(data);
      setLoadingTimes(false);
    });
    return () => {
      cancelled = true;
    };
  }, [professional, insurance, modality, dayOfWeek, startDate, requiresModality]);

  async function handleSubmit() {
    if (!professional || !insurance || dayOfWeek === null || !time) {
      setError("Preencha profissional, convênio, dia da semana e horário antes de confirmar.");
      return;
    }
    if (requiresModality && !modality) {
      setError("Selecione a modalidade (ABA ou Comum).");
      return;
    }
    if (!requiresModality && (!particularProduct || !paymentMethod)) {
      setError("Selecione o produto e a forma de pagamento.");
      return;
    }

    setSaving(true);
    setError(null);
    const result = await createRecurringAppointments({
      patientId,
      professionalId: professional.id,
      specialtyId: professional.specialty_id ?? "",
      insuranceId: insurance.id,
      paymentMethod: (requiresModality ? "convenio" : paymentMethod) as PaymentMethod,
      modality: modality ?? undefined,
      particularProduct: particularProduct ?? undefined,
      dayOfWeek,
      startTime: time.startTime,
      frequency,
      startDate,
      endDate: endDate || null,
      maxOccurrences: maxOccurrences ? Number(maxOccurrences) : null,
      skipDates: [],
      overrides: {},
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onDone(result.createdCount ?? 0);
  }

  const selectedValue =
    pricing?.insuranceKind === "convenio"
      ? pricing.options.find((o) => o.modality === modality)?.value ?? null
      : pricing?.insuranceKind === "particular"
        ? pricing.options.find((o) => o.product === particularProduct)?.value ?? null
        : null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <button aria-label="Fechar" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative flex max-h-[90vh] w-full max-w-lg flex-col gap-5 overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)] animate-fade-up"
      >
        <div>
          <h2 className="text-lg font-bold text-text-primary">Nova recorrência</h2>
          <p className="text-xs text-text-secondary">
            Paciente: <strong className="text-text-primary">{patientName}</strong>
          </p>
        </div>

        {error && <p className="text-sm font-medium text-danger">{error}</p>}

        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-text-secondary">Convênio</label>
          <div className="flex flex-wrap gap-1.5">
            {insurances.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelectInsurance(opt)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                  insurance?.id === opt.id
                    ? "border-primary bg-primary/10 text-primary font-bold"
                    : "border-border bg-card-elevated/40 text-text-secondary hover:border-primary/50"
                }`}
              >
                {opt.name}
              </button>
            ))}
          </div>
        </div>

        {insurance && (
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-text-secondary">Profissional</label>
            {loadingProfessionals ? (
              <p className="text-xs text-text-muted animate-pulse">Buscando profissionais...</p>
            ) : professionals.length === 0 ? (
              <p className="text-xs text-danger">Nenhum profissional disponível para este convênio.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {professionals.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelectProfessional(opt)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                      professional?.id === opt.id
                        ? "border-primary bg-primary/10 text-primary font-bold"
                        : "border-border bg-card-elevated/40 text-text-secondary hover:border-primary/50"
                    }`}
                  >
                    {opt.fullName}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {professional &&
          (loadingPricing ? (
            <p className="text-xs text-text-muted animate-pulse">Carregando valores...</p>
          ) : requiresModality ? (
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-text-secondary">Modalidade</label>
              {pricing?.insuranceKind === "convenio" && pricing.options.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {MODALITIES.map((m) => {
                    const opt = pricing.options.find((o) => o.modality === m);
                    return (
                      <button
                        key={m}
                        type="button"
                        disabled={!opt}
                        onClick={() => opt && handleSelectModality(m)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                          !opt
                            ? "border-border/50 bg-card-elevated/20 text-text-muted cursor-not-allowed"
                            : modality === m
                              ? "border-primary bg-primary/10 text-primary font-bold"
                              : "border-border bg-card-elevated/40 text-text-secondary hover:border-primary/50"
                        }`}
                      >
                        {MODALITY_LABELS[m]}
                        {opt ? ` — ${formatCurrency(opt.value)}` : " (sem valor)"}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-danger">Este profissional ainda não possui valor cadastrado para essa modalidade.</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-text-secondary">Produto</label>
                {pricing?.insuranceKind === "particular" && pricing.options.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {pricing.options.map((opt) => (
                      <button
                        key={opt.product}
                        type="button"
                        onClick={() => setParticularProduct(opt.product)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                          particularProduct === opt.product
                            ? "border-primary bg-primary/10 text-primary font-bold"
                            : "border-border bg-card-elevated/40 text-text-secondary hover:border-primary/50"
                        }`}
                      >
                        {PARTICULAR_PRODUCT_LABELS[opt.product]} — {formatCurrency(opt.value)}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-danger">Valores particulares ainda não configurados em Configurações da Clínica.</p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-text-secondary">Forma de pagamento</label>
                <div className="flex flex-wrap gap-1.5">
                  {PARTICULAR_PAYMENT_METHODS.map((pm) => (
                    <button
                      key={pm}
                      type="button"
                      onClick={() => setPaymentMethod(pm)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                        paymentMethod === pm
                          ? "border-primary bg-primary/10 text-primary font-bold"
                          : "border-border bg-card-elevated/40 text-text-secondary hover:border-primary/50"
                      }`}
                    >
                      {PAYMENT_LABELS[pm]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}

        {duration && <p className="text-xs text-text-secondary">Duração do atendimento: {duration} min.</p>}

        {professional && (requiresModality ? modality : particularProduct && paymentMethod) && (
          <>
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-text-secondary">Dia da semana</label>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAY_LABELS.map((label, index) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setDayOfWeek(index)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                      dayOfWeek === index
                        ? "border-primary bg-primary/10 text-primary font-bold"
                        : "border-border bg-card-elevated/40 text-text-secondary hover:border-primary/50"
                    }`}
                  >
                    {label.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Data de início"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <Input label="Data final (opcional)" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>

            {dayOfWeek !== null && (
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-text-secondary">Horário</label>
                {loadingTimes ? (
                  <p className="text-xs text-text-muted animate-pulse">Buscando horários livres...</p>
                ) : times.length === 0 ? (
                  <p className="text-xs text-danger">Sem horários livres nesse dia. Tente outro dia da semana.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                    {times.map((opt) => (
                      <button
                        key={`${opt.slotId}-${opt.startTime}`}
                        type="button"
                        onClick={() => setTime(opt)}
                        className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition-all ${
                          time?.startTime === opt.startTime
                            ? "border-primary bg-primary text-white font-bold"
                            : "border-border bg-card-elevated/40 text-text-primary hover:border-primary/50"
                        }`}
                      >
                        {opt.startTime.slice(0, 5)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-text-secondary">Frequência</label>
              <div className="flex flex-wrap gap-1.5">
                {FREQUENCY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFrequency(opt.value)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                      frequency === opt.value
                        ? "border-primary bg-primary/10 text-primary font-bold"
                        : "border-border bg-card-elevated/40 text-text-secondary hover:border-primary/50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <Input
              label="Quantidade máxima de repetições (opcional)"
              type="number"
              min={1}
              value={maxOccurrences}
              onChange={(e) => setMaxOccurrences(e.target.value)}
            />

            {selectedValue != null && (
              <p className="text-xs text-text-secondary">
                Valor por atendimento: <strong className="text-text-primary">{formatCurrency(selectedValue)}</strong>
              </p>
            )}
          </>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <Button variant="secondary" size="sm" disabled={saving} onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" isLoading={saving} disabled={!time} onClick={handleSubmit}>
            Criar recorrência
          </Button>
        </div>
      </div>
    </div>
  );
}
