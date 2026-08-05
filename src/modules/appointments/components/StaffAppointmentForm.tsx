"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { formatCurrency } from "@/lib/whatsapp";
import { CITIES } from "@/lib/constants";
import type { PaymentMethod } from "@/lib/supabase/types";
import { PatientPickerField } from "@/modules/patients/components/PatientPickerField";
import { createPatient, type PatientSearchResult } from "@/modules/patients/services/patient-actions";
import {
  getBookableProfessionalsByInsurance,
  getAvailableDates,
  getAvailableTimes,
  getProfessionalPricing,
  getEffectiveDuration,
} from "@/modules/appointments/services/booking-queries";
import { createAppointmentForPatient } from "@/modules/appointments/services/booking-actions";
import {
  createRecurringAppointments,
  previewRecurringAppointments,
  type OccurrencePreview,
} from "@/modules/appointments/services/recurrence-actions";
import { RecurrenceFields, type RecurrenceValue } from "@/modules/appointments/components/RecurrenceFields";
import { ConflictsReview } from "@/modules/appointments/components/ConflictsReview";

interface Option {
  id: string;
  name: string;
}

interface ProfessionalOption {
  id: string;
  fullName: string;
  specialtyName: string;
  specialty_id: string | null;
  avatarUrl: string | null;
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
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

const DEFAULT_RECURRENCE: RecurrenceValue = {
  frequency: "weekly",
  startDate: "",
  endDate: "",
  maxOccurrences: "",
  notes: "",
};

const STEP_LABELS = [
  "Paciente",
  "Cidade",
  "Convênio",
  "Profissional",
  "Data",
  "Horário",
  "Pagamento",
  "Recorrência",
  "Resumo",
];

export function StaffAppointmentForm({ insurances }: { insurances: Option[] }) {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Etapa 1: paciente
  const [patient, setPatient] = useState<PatientSearchResult | null>(null);
  const [showCreatePatient, setShowCreatePatient] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newWhatsapp, setNewWhatsapp] = useState("");
  const [newCity, setNewCity] = useState("");
  const [creatingPatient, setCreatingPatient] = useState(false);

  // Etapa 2: cidade
  const [city, setCity] = useState<string | null>(null);

  // Etapa 3: convênio
  const [insurance, setInsurance] = useState<Option | null>(null);

  // Etapa 4: profissional
  const [professionals, setProfessionals] = useState<ProfessionalOption[]>([]);
  const [professional, setProfessional] = useState<ProfessionalOption | null>(null);
  const [duration, setDuration] = useState<number | null>(null);

  // Etapa 5-6: data/horário
  const [dates, setDates] = useState<string[]>([]);
  const [date, setDate] = useState<string | null>(null);
  const [times, setTimes] = useState<TimeOption[]>([]);
  const [time, setTime] = useState<TimeOption | null>(null);

  // Etapa 7: pagamento
  const [pricing, setPricing] = useState<PricingOption[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);

  // Etapa 8: recorrência
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrence, setRecurrence] = useState<RecurrenceValue>(DEFAULT_RECURRENCE);

  const [conflictOccurrences, setConflictOccurrences] = useState<OccurrencePreview[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{ whatsappLink?: string | null; count: number } | null>(null);

  function goTo(next: number) {
    setError(null);
    setStep(next);
  }

  function handleSelectPatient(selected: PatientSearchResult) {
    setPatient(selected);
    setShowCreatePatient(false);
    goTo(2);
  }

  async function handleCreatePatient(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) {
      setError("Informe o nome do paciente.");
      return;
    }
    setCreatingPatient(true);
    setError(null);
    const result = await createPatient({
      full_name: newName,
      phone: newPhone,
      details: { whatsapp: newWhatsapp || undefined, city: newCity || undefined },
    });
    setCreatingPatient(false);
    if (result.error || !result.id) {
      setError(result.error ?? "Não foi possível cadastrar o paciente.");
      return;
    }
    setPatient({
      id: result.id,
      fullName: newName,
      phone: newPhone || null,
      whatsapp: newWhatsapp || null,
      city: newCity || null,
      preferredInsuranceId: null,
      preferredProfessionalId: null,
    });
    setShowCreatePatient(false);
    goTo(2);
  }

  function handleSelectCity(selected: string) {
    setCity(selected);
    goTo(3);
  }

  async function handleSelectInsurance(option: Option) {
    setInsurance(option);
    setProfessional(null);
    setLoading(true);
    setError(null);
    const data = await getBookableProfessionalsByInsurance(option.id);
    setProfessionals(
      data.map((p) => ({
        id: p.id,
        fullName: p.fullName,
        specialtyName: p.specialtyName,
        specialty_id: p.specialty_id,
        avatarUrl: p.avatarUrl,
      })),
    );
    setLoading(false);
    if (data.length === 0) setError("Nenhum profissional disponível para este convênio.");
    goTo(4);
  }

  async function handleSelectProfessional(option: ProfessionalOption) {
    setProfessional(option);
    setLoading(true);
    setError(null);
    const [availableDates, effectiveDuration] = await Promise.all([
      getAvailableDates(option.id),
      insurance ? getEffectiveDuration(option.id, insurance.id) : Promise.resolve(null),
    ]);
    setDates(availableDates);
    setDuration(effectiveDuration);
    setLoading(false);
    if (availableDates.length === 0) setError("Esse profissional não tem horários disponíveis no momento.");
    goTo(5);
  }

  async function handleSelectDate(selected: string) {
    setDate(selected);
    setTime(null);
    if (!professional || !insurance) return;
    setLoading(true);
    setError(null);
    const data = await getAvailableTimes(professional.id, insurance.id, selected);
    setTimes(data);
    setLoading(false);
    if (data.length === 0) setError("Sem horários livres nesse dia. Escolha outra data.");
    goTo(6);
  }

  async function handleSelectTime(option: TimeOption) {
    setTime(option);
    if (!professional || !insurance) return;
    setLoading(true);
    const options = await getProfessionalPricing(professional.id, insurance.id);
    setPricing(options);
    setPaymentMethod(options[0]?.paymentMethod ?? null);
    setLoading(false);
    goTo(7);
  }

  function handleSelectPayment(method: PaymentMethod) {
    setPaymentMethod(method);
    goTo(8);
  }

  function handleContinueFromRecurrence() {
    if (isRecurring && !recurrence.startDate) {
      setError("Informe a data de início da recorrência.");
      return;
    }
    goTo(9);
  }

  async function handleConfirm() {
    if (!patient || !professional || !insurance || !date || !time || !paymentMethod) return;

    setSaving(true);
    setError(null);

    if (!isRecurring) {
      const result = await createAppointmentForPatient({
        patientId: patient.id,
        professionalId: professional.id,
        specialtyId: professional.specialty_id ?? "",
        insuranceId: insurance.id,
        scheduleSlotId: time.slotId,
        date,
        startTime: time.startTime,
        endTime: time.endTime,
        paymentMethod,
      });
      setSaving(false);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccessResult({ whatsappLink: result.whatsappLink, count: 1 });
      return;
    }

    const result = await previewRecurringAppointments({
      patientId: patient.id,
      professionalId: professional.id,
      specialtyId: professional.specialty_id ?? "",
      insuranceId: insurance.id,
      paymentMethod,
      dayOfWeek: new Date(`${recurrence.startDate}T00:00:00`).getDay(),
      startTime: time.startTime,
      frequency: recurrence.frequency,
      startDate: recurrence.startDate,
      endDate: recurrence.endDate || null,
      maxOccurrences: recurrence.maxOccurrences ? Number(recurrence.maxOccurrences) : null,
      notes: recurrence.notes || undefined,
    });
    setSaving(false);
    if (result.error || !result.occurrences) {
      setError(result.error ?? "Não foi possível gerar as datas.");
      return;
    }
    setConflictOccurrences(result.occurrences);
  }

  async function handleConfirmRecurring(skipDates: string[], overrides: Record<string, string>) {
    if (!patient || !professional || !insurance || !time || !paymentMethod) return;
    setSaving(true);
    setError(null);

    const result = await createRecurringAppointments({
      patientId: patient.id,
      professionalId: professional.id,
      specialtyId: professional.specialty_id ?? "",
      insuranceId: insurance.id,
      paymentMethod,
      dayOfWeek: new Date(`${recurrence.startDate}T00:00:00`).getDay(),
      startTime: time.startTime,
      frequency: recurrence.frequency,
      startDate: recurrence.startDate,
      endDate: recurrence.endDate || null,
      maxOccurrences: recurrence.maxOccurrences ? Number(recurrence.maxOccurrences) : null,
      notes: recurrence.notes || undefined,
      skipDates,
      overrides,
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setConflictOccurrences(null);
    setSuccessResult({ whatsappLink: result.whatsappLink, count: result.createdCount ?? 0 });
  }

  function handleReset() {
    setSuccessResult(null);
    setStep(1);
    setPatient(null);
    setCity(null);
    setInsurance(null);
    setProfessional(null);
    setDate(null);
    setTime(null);
    setPaymentMethod(null);
    setIsRecurring(false);
    setRecurrence(DEFAULT_RECURRENCE);
    router.refresh();
  }

  if (successResult) {
    return (
      <Card className="border-primary/50 bg-card shadow-card animate-fade-up">
        <CardContent className="flex flex-col items-center gap-5 p-8 text-center sm:p-12">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-[var(--badge-bg)] border border-primary/40 text-[var(--link)] shadow-[0_0_30px_rgba(15,164,122,0.3)]">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <Badge tone="premium">Agendamento realizado!</Badge>
          <h2 className="text-2xl font-black text-text-primary tracking-tight font-heading">
            {successResult.count > 1 ? `${successResult.count} consultas criadas` : "Consulta criada com sucesso"}
          </h2>
          <p className="max-w-lg text-sm text-text-secondary">
            Paciente: <strong className="text-text-primary">{patient?.fullName}</strong>
          </p>
          <div className="flex flex-col items-center gap-3 pt-2 sm:flex-row">
            {successResult.whatsappLink && (
              <a href={successResult.whatsappLink} target="_blank" rel="noreferrer">
                <Button type="button">Enviar confirmação por WhatsApp</Button>
              </a>
            )}
            <Button type="button" variant="secondary" onClick={handleReset}>
              Novo agendamento
            </Button>
            <Button type="button" variant="secondary" onClick={() => router.push("/appointments")}>
              Ver consultas
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (conflictOccurrences && professional && insurance) {
    return (
      <ConflictsReview
        occurrences={conflictOccurrences}
        professionalId={professional.id}
        insuranceId={insurance.id}
        confirming={saving}
        onConfirm={handleConfirmRecurring}
        onCancel={() => setConflictOccurrences(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--link)]">
              Etapa {step} de 9
            </span>
            <h3 className="text-lg font-extrabold text-text-primary font-heading">
              {step}. {STEP_LABELS[step - 1]}
            </h3>
          </div>
          {step > 1 && (
            <button
              type="button"
              onClick={() => goTo(step - 1)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--link)] hover:underline"
            >
              ← Voltar etapa anterior
            </button>
          )}
        </div>
        <div className="grid grid-cols-9 gap-1.5">
          {STEP_LABELS.map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                i < step ? "bg-gradient-forest shadow-[0_0_10px_rgba(15,164,122,0.5)]" : "bg-card-elevated"
              }`}
            />
          ))}
        </div>
      </div>

      {error && <p className="text-sm font-medium text-danger">{error}</p>}

      {step === 1 && (
        <Card>
          <CardContent className="flex flex-col gap-4 py-6">
            <PatientPickerField selectedName={patient?.fullName} onSelect={handleSelectPatient} />
            {!showCreatePatient ? (
              <button
                type="button"
                onClick={() => setShowCreatePatient(true)}
                className="w-fit text-sm font-semibold text-[var(--link)] hover:underline"
              >
                + Cadastrar novo paciente
              </button>
            ) : (
              <form onSubmit={handleCreatePatient} className="flex flex-col gap-4 rounded-2xl border border-border bg-card-elevated/60 p-5">
                <p className="text-sm font-bold text-text-primary">Cadastrar novo paciente</p>
                <Input label="Nome completo" value={newName} onChange={(e) => setNewName(e.target.value)} required />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="Telefone" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
                  <Input label="WhatsApp" value={newWhatsapp} onChange={(e) => setNewWhatsapp(e.target.value)} />
                </div>
                <Input label="Cidade" value={newCity} onChange={(e) => setNewCity(e.target.value)} />
                <div className="flex gap-3">
                  <Button type="submit" size="sm" isLoading={creatingPatient}>
                    Cadastrar e continuar
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => setShowCreatePatient(false)}>
                    Cancelar
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CITIES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => handleSelectCity(option)}
              className={
                city === option
                  ? "rounded-2xl border-2 border-primary bg-card-elevated p-5 text-left text-base font-bold text-text-primary shadow-card"
                  : "rounded-2xl border border-border bg-card p-5 text-left text-base font-semibold text-text-primary transition-all hover:border-primary/60 hover:bg-card-elevated/80"
              }
            >
              {option}
            </button>
          ))}
        </div>
      )}

      {step === 3 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {loading && <p className="text-sm text-text-secondary">Carregando...</p>}
          {!loading &&
            insurances.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => handleSelectInsurance(option)}
                className="rounded-2xl border border-border bg-card p-5 text-left text-base font-semibold text-text-primary shadow-card transition-all hover:border-primary/60 hover:bg-card-elevated/80"
              >
                {option.name}
              </button>
            ))}
        </div>
      )}

      {step === 4 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {loading && <p className="text-sm text-text-secondary">Carregando...</p>}
          {!loading &&
            professionals.map((option) => (
              <div key={option.id} className="flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-card">
                <div>
                  <p className="text-base font-bold text-text-primary">{option.fullName}</p>
                  <Badge tone="success" className="mt-1">{option.specialtyName}</Badge>
                </div>
                <Button className="mt-4 w-full" onClick={() => handleSelectProfessional(option)}>
                  Selecionar profissional
                </Button>
              </div>
            ))}
        </div>
      )}

      {step === 5 && (
        <div className="flex flex-col gap-4">
          {professional && duration && (
            <div className="rounded-xl border border-border bg-card-elevated/60 p-4 text-sm text-text-secondary">
              <span className="font-semibold text-text-primary">{professional.fullName}</span> —{" "}
              {professional.specialtyName} · Duração: {duration} min
            </div>
          )}
          {loading && <p className="text-sm text-text-secondary">Carregando...</p>}
          <div className="flex flex-wrap gap-3">
            {!loading &&
              dates.map((iso) => (
                <button
                  key={iso}
                  type="button"
                  onClick={() => handleSelectDate(iso)}
                  className={
                    date === iso
                      ? "rounded-xl border-2 border-primary bg-primary/10 px-4 py-3 text-sm font-bold text-primary"
                      : "rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-text-primary hover:border-primary/50"
                  }
                >
                  {WEEKDAY_FORMATTER.format(new Date(`${iso}T00:00:00`))}
                </button>
              ))}
          </div>
        </div>
      )}

      {step === 6 && (
        <div className="flex flex-wrap gap-3">
          {loading && <p className="text-sm text-text-secondary">Carregando...</p>}
          {!loading &&
            times.map((option) => (
              <button
                key={`${option.slotId}-${option.startTime}`}
                type="button"
                onClick={() => handleSelectTime(option)}
                className={
                  time?.startTime === option.startTime
                    ? "rounded-xl border-2 border-primary bg-primary/10 px-4 py-3 text-sm font-bold text-primary"
                    : "rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-text-primary hover:border-primary/50"
                }
              >
                {option.startTime.slice(0, 5)}
              </button>
            ))}
        </div>
      )}

      {step === 7 && (
        <div className="flex flex-wrap gap-3">
          {pricing.length === 0 && (
            <p className="text-sm font-medium text-danger">Sem valor configurado para este profissional/convênio.</p>
          )}
          {pricing.map((option) => (
            <button
              key={option.paymentMethod}
              type="button"
              onClick={() => handleSelectPayment(option.paymentMethod)}
              className={
                paymentMethod === option.paymentMethod
                  ? "rounded-xl border-2 border-primary bg-primary/10 px-4 py-3 text-sm font-bold text-primary"
                  : "rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-text-primary hover:border-primary/50"
              }
            >
              {PAYMENT_LABELS[option.paymentMethod]} — {formatCurrency(option.value)}
            </button>
          ))}
        </div>
      )}

      {step === 8 && (
        <div className="flex flex-col gap-4">
          <label className="flex w-fit cursor-pointer items-center gap-2 text-sm font-semibold text-text-primary">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Consulta recorrente
          </label>
          {isRecurring && <RecurrenceFields value={recurrence} onChange={setRecurrence} />}
          <Button className="w-fit" onClick={handleContinueFromRecurrence}>
            Continuar
          </Button>
        </div>
      )}

      {step === 9 && patient && city && insurance && professional && date && time && paymentMethod && (
        <Card>
          <CardContent className="flex flex-col gap-6 py-6">
            <div className="grid grid-cols-1 gap-4 rounded-xl border border-border bg-card-elevated/50 p-5 text-sm sm:grid-cols-2">
              <SummaryField label="Paciente" value={patient.fullName} />
              <SummaryField label="Cidade" value={city} />
              <SummaryField label="Convênio" value={insurance.name} />
              <SummaryField label="Profissional" value={professional.fullName} />
              <SummaryField label="Especialidade" value={professional.specialtyName} />
              <SummaryField label="Duração" value={duration ? `${duration} min` : "—"} />
              <SummaryField
                label="Data/Horário"
                value={`${dateFormatter.format(new Date(`${date}T00:00:00`))} às ${time.startTime.slice(0, 5)}`}
              />
              <SummaryField label="Forma de pagamento" value={PAYMENT_LABELS[paymentMethod]} />
              <SummaryField
                label="Valor"
                value={formatCurrency(pricing.find((p) => p.paymentMethod === paymentMethod)?.value ?? 0)}
              />
              {isRecurring && (
                <SummaryField
                  label="Recorrência"
                  value={`${recurrence.frequency === "weekly" ? "Semanal" : recurrence.frequency === "biweekly" ? "Quinzenal" : "Mensal"}, a partir de ${recurrence.startDate ? dateFormatter.format(new Date(`${recurrence.startDate}T00:00:00`)) : "—"}`}
                />
              )}
            </div>

            <Button isLoading={saving} onClick={handleConfirm}>
              Confirmar agendamento
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">{label}</p>
      <p className="mt-1 font-semibold text-text-primary">{value}</p>
    </div>
  );
}
