"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/whatsapp";
import type { PaymentMethod } from "@/lib/supabase/types";
import {
  getBookableInsurances,
  getBookableProfessionals,
  getAvailableDates,
  getAvailableTimes,
  getProfessionalPricing,
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

interface PricingOption {
  paymentMethod: PaymentMethod;
  value: number;
}

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cartao: "Cartão",
  pix: "PIX",
  dinheiro: "Dinheiro",
  convenio: "Convênio",
};

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
  const [pricing, setPricing] = useState<PricingOption[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ whatsappLink: string | null } | null>(null);

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
    setLoading(true);
    setError(null);
    const data = await getAvailableDates(option.id);
    setDates(data);
    setLoading(false);
    if (data.length === 0) setError("Esse profissional não tem horários disponíveis no momento.");
    setStep(4);
  }

  async function selectDate(selected: string) {
    setDate(selected);
    setTime(null);
    setLoading(true);
    setError(null);
    const data = await getAvailableTimes(professional!.id, insurance!.id, selected);
    setTimes(data);
    setLoading(false);
    if (data.length === 0) setError("Sem horários livres nesse dia. Escolha outra data.");
    setStep(5);
  }

  async function selectTime(option: TimeOption) {
    setTime(option);
    setLoading(true);
    setError(null);
    const options = await getProfessionalPricing(professional!.id, insurance!.id);
    setPricing(options);
    setPaymentMethod(options[0]?.paymentMethod ?? null);
    setLoading(false);
    setStep(6);
  }

  async function handleConfirm() {
    if (!specialty || !insurance || !professional || !date || !time || !paymentMethod) return;

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
      <Card className="max-w-xl">
        <CardContent className="flex flex-col items-center gap-5 py-10 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#2E8B57]/20 text-3xl text-[#5ED39D] border border-[#2E8B57]/40 shadow-[0_0_20px_rgba(46,139,87,0.25)]">
            ✓
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#F5F7F6]">Agendamento enviado!</h2>
            <p className="mt-2 text-sm text-[#C8D4CF] leading-relaxed">
              Sua consulta está pendente de confirmação pela recepção. Você pode acompanhar em
              &quot;Minhas Consultas&quot;.
            </p>
          </div>
          {result.whatsappLink && (
            <a href={result.whatsappLink} target="_blank" rel="noreferrer">
              <Button type="button">Reenviar mensagem no WhatsApp</Button>
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
        {["Especialidade", "Convênio", "Profissional", "Data", "Horário", "Confirmação"].map(
          (label, index) => (
            <li key={label}>
              <span
                className={
                  step === index + 1
                    ? "inline-flex items-center rounded-full bg-[#2E8B57] px-3.5 py-1.5 font-bold text-white shadow-[0_0_12px_rgba(46,139,87,0.3)]"
                    : step > index + 1
                      ? "inline-flex items-center rounded-full bg-[#2E8B57]/20 border border-[#2E8B57]/30 px-3.5 py-1.5 font-semibold text-[#5ED39D]"
                      : "inline-flex items-center rounded-full bg-[#17382D] border border-[#255044] px-3.5 py-1.5 font-medium text-[#7A9187]"
                }
              >
                {index + 1}. {label}
              </span>
            </li>
          ),
        )}
      </ol>

      {error && <p className="text-sm font-medium text-[#FF8A8A]">{error}</p>}

      {step === 1 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {specialties.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => selectSpecialty(option)}
              className="rounded-2xl border border-[#255044] bg-[#102A22] p-5 text-left text-base font-semibold text-[#F5F7F6] shadow-[0_4px_20px_rgba(0,0,0,0.2)] transition-all hover:border-[#2E8B57] hover:bg-[#17382D] hover:shadow-[0_8px_25px_rgba(11,61,46,0.3)] cursor-pointer"
            >
              {option.name}
            </button>
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {loading && <p className="text-sm text-[#C8D4CF]">Carregando...</p>}
          {!loading &&
            insurances.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => selectInsurance(option)}
                className="rounded-2xl border border-[#255044] bg-[#102A22] p-5 text-left text-base font-semibold text-[#F5F7F6] shadow-[0_4px_20px_rgba(0,0,0,0.2)] transition-all hover:border-[#2E8B57] hover:bg-[#17382D] hover:shadow-[0_8px_25px_rgba(11,61,46,0.3)] cursor-pointer"
              >
                {option.name}
              </button>
            ))}
        </div>
      )}

      {step === 3 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {loading && <p className="text-sm text-[#C8D4CF]">Carregando...</p>}
          {!loading &&
            professionals.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => selectProfessional(option)}
                className="flex items-center gap-4 rounded-2xl border border-[#255044] bg-[#102A22] p-5 text-left shadow-[0_4px_20px_rgba(0,0,0,0.2)] transition-all hover:border-[#2E8B57] hover:bg-[#17382D] hover:shadow-[0_8px_25px_rgba(11,61,46,0.3)] cursor-pointer"
              >
                <Avatar src={option.avatarUrl} name={option.fullName} size={48} />
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-[#F5F7F6]">{option.fullName}</p>
                  {option.bio && <p className="truncate text-xs text-[#C8D4CF] mt-0.5">{option.bio}</p>}
                </div>
              </button>
            ))}
        </div>
      )}

      {step === 4 && (
        <div className="flex flex-wrap gap-3">
          {loading && <p className="text-sm text-[#C8D4CF]">Carregando...</p>}
          {!loading &&
            dates.map((iso) => (
              <button
                key={iso}
                type="button"
                onClick={() => selectDate(iso)}
                className="rounded-xl border border-[#255044] bg-[#102A22] px-4 py-3 text-sm font-semibold text-[#F5F7F6] shadow-[0_4px_20px_rgba(0,0,0,0.2)] transition-all hover:border-[#2E8B57] hover:bg-[#17382D] cursor-pointer"
              >
                {WEEKDAY_FORMATTER.format(new Date(`${iso}T00:00:00`))}
              </button>
            ))}
        </div>
      )}

      {step === 5 && (
        <div className="flex flex-wrap gap-3">
          {loading && <p className="text-sm text-[#C8D4CF]">Carregando...</p>}
          {!loading &&
            times.map((option) => (
              <button
                key={`${option.slotId}-${option.startTime}`}
                type="button"
                onClick={() => selectTime(option)}
                className="rounded-xl border border-[#255044] bg-[#102A22] px-4 py-3 text-sm font-semibold text-[#F5F7F6] shadow-[0_4px_20px_rgba(0,0,0,0.2)] transition-all hover:border-[#2E8B57] hover:bg-[#17382D] cursor-pointer"
              >
                {option.startTime}
              </button>
            ))}
        </div>
      )}

      {step === 6 && specialty && insurance && professional && date && time && (
        <Card>
          <CardContent className="flex flex-col gap-6 py-6">
            <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 rounded-xl border border-[#255044] bg-[#17382D]/50 p-4">
              <p>
                <span className="text-[#C8D4CF]">Especialidade: </span>
                <span className="font-semibold text-[#F5F7F6]">{specialty.name}</span>
              </p>
              <p>
                <span className="text-[#C8D4CF]">Convênio: </span>
                <span className="font-semibold text-[#F5F7F6]">{insurance.name}</span>
              </p>
              <p>
                <span className="text-[#C8D4CF]">Profissional: </span>
                <span className="font-semibold text-[#F5F7F6]">{professional.fullName}</span>
              </p>
              <p>
                <span className="text-[#C8D4CF]">Data/Hora: </span>
                <span className="font-semibold text-[#5ED39D]">
                  {WEEKDAY_FORMATTER.format(new Date(`${date}T00:00:00`))} às {time.startTime}
                </span>
              </p>
            </div>

            {pricing.length > 0 ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm font-bold text-[#F5F7F6]">Forma de pagamento</p>
                <div className="flex flex-wrap gap-3">
                  {pricing.map((option) => (
                    <button
                      key={option.paymentMethod}
                      type="button"
                      onClick={() => setPaymentMethod(option.paymentMethod)}
                      className={
                        paymentMethod === option.paymentMethod
                          ? "rounded-xl border-2 border-[#2E8B57] bg-[#2E8B57]/20 px-4 py-3 text-sm font-bold text-[#5ED39D] shadow-[0_0_15px_rgba(46,139,87,0.2)] cursor-pointer"
                          : "rounded-xl border border-[#255044] bg-[#17382D] px-4 py-3 text-sm font-medium text-[#F5F7F6] hover:border-[#2E8B57] cursor-pointer"
                      }
                    >
                      {PAYMENT_LABELS[option.paymentMethod]} — {formatCurrency(option.value)}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm font-medium text-[#FF8A8A]">
                Este profissional não tem valor configurado para esse convênio.
              </p>
            )}

            {error && <p className="text-sm font-medium text-[#FF8A8A]">{error}</p>}

            <Button type="button" disabled={loading || !paymentMethod} onClick={handleConfirm}>
              {loading ? "Enviando..." : "Confirmar agendamento"}
            </Button>
          </CardContent>
        </Card>
      )}

      {step > 1 && !result && (
        <Button type="button" variant="secondary" className="w-fit" onClick={() => setStep(step - 1)}>
          Voltar
        </Button>
      )}
    </div>
  );
}

