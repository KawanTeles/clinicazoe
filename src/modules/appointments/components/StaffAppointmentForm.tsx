"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { formatCurrency } from "@/lib/whatsapp";
import { getAttendanceInfo } from "@/lib/attendance";
import { MODALITY_LABELS, PARTICULAR_PRODUCT_LABELS, insuranceRequiresModality } from "@/lib/constants";
import type { Modality, ParticularProduct, PaymentMethod } from "@/lib/supabase/types";
import { PatientPickerField } from "@/modules/patients/components/PatientPickerField";
import { createPatient, type PatientSearchResult } from "@/modules/patients/services/patient-actions";
import {
  getBookableProfessionalsByInsurance,
  getAvailableTimes,
  getProfessionalPricing,
  getEffectiveDuration,
  type DayAvailability,
  type ProfessionalPricingResult,
} from "@/modules/appointments/services/booking-queries";
import { AvailabilityCalendar } from "@/modules/appointments/components/AvailabilityCalendar";
import { createAppointmentForPatient } from "@/modules/appointments/services/booking-actions";
import {
  createRecurringAppointments,
  previewRecurringAppointments,
  type OccurrencePreview,
} from "@/modules/appointments/services/recurrence-actions";
import { RecurrenceFields, type RecurrenceValue } from "@/modules/appointments/components/RecurrenceFields";
import { ConflictsReview } from "@/modules/appointments/components/ConflictsReview";
import { Avatar } from "@/components/ui/Avatar";

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

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cartao: "Cartão",
  pix: "PIX",
  dinheiro: "Dinheiro",
  convenio: "Convênio",
};

const MODALITIES: Modality[] = ["aba", "comum"];
const PARTICULAR_PAYMENT_METHODS: PaymentMethod[] = ["cartao", "pix", "dinheiro"];

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

const DEFAULT_RECURRENCE: RecurrenceValue = {
  frequency: "weekly",
  startDate: "",
  endDate: "",
  maxOccurrences: "",
  notes: "",
};

export function StaffAppointmentForm({ insurances }: { insurances: Option[] }) {
  const router = useRouter();

  // Etapa 1: paciente
  const [patient, setPatient] = useState<PatientSearchResult | null>(null);
  const [showCreatePatient, setShowCreatePatient] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newWhatsapp, setNewWhatsapp] = useState("");
  const [newCity, setNewCity] = useState("");
  const [creatingPatient, setCreatingPatient] = useState(false);

  // Etapa 2: convênio
  const [insurance, setInsurance] = useState<Option | null>(null);

  // Etapa 4: profissional
  const [professionals, setProfessionals] = useState<ProfessionalOption[]>([]);
  const [professional, setProfessional] = useState<ProfessionalOption | null>(null);
  const [duration, setDuration] = useState<number | null>(null);

  // Etapa 5-6: data/horário
  const [date, setDate] = useState<string | null>(null);
  const [selectedDayInfo, setSelectedDayInfo] = useState<DayAvailability | null>(null);
  const [times, setTimes] = useState<TimeOption[]>([]);
  const [time, setTime] = useState<TimeOption | null>(null);

  // Etapa 7: pagamento
  const [pricing, setPricing] = useState<ProfessionalPricingResult | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [modality, setModality] = useState<Modality | null>(null);
  const [particularProduct, setParticularProduct] = useState<ParticularProduct | null>(null);

  const requiresModality = insuranceRequiresModality(insurance?.name);
  const selectedValue =
    pricing?.insuranceKind === "convenio"
      ? pricing.options.find((o) => o.modality === modality)?.value ?? null
      : pricing?.insuranceKind === "particular"
        ? pricing.options.find((o) => o.product === particularProduct)?.value ?? null
        : null;

  // Etapa 8: recorrência
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrence, setRecurrence] = useState<RecurrenceValue>(DEFAULT_RECURRENCE);

  const [conflictOccurrences, setConflictOccurrences] = useState<OccurrencePreview[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{ whatsappLink?: string | null; count: number } | null>(null);

  function handleSelectPatient(selected: PatientSearchResult) {
    setPatient(selected);
    setShowCreatePatient(false);
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
      email: null,
      avatarUrl: null,
      city: newCity || null,
      preferredInsuranceId: null,
      preferredProfessionalId: null,
    });
    setShowCreatePatient(false);
  }

  async function handleSelectInsurance(option: Option) {
    setInsurance(option);
    setProfessional(null);
    setDate(null);
    setSelectedDayInfo(null);
    setTimes([]);
    setTime(null);
    setPricing(null);
    setModality(null);
    setParticularProduct(null);
    setPaymentMethod(null);
    setDuration(null);
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
      }))
    );
    setLoading(false);
    if (data.length === 0) setError("Nenhum profissional disponível para este convênio.");
  }

  async function handleSelectProfessional(option: ProfessionalOption) {
    setProfessional(option);
    setDate(null);
    setSelectedDayInfo(null);
    setTimes([]);
    setTime(null);
    setModality(null);
    setParticularProduct(null);
    setPaymentMethod(null);
    setDuration(null);
    setError(null);
    if (!insurance) return;
    setLoading(true);
    const result = await getProfessionalPricing(option.id, insurance.id);
    setPricing(result);
    setLoading(false);
    if (result.insuranceKind === "particular") {
      // Particular não tem modalidade — libera a duração/calendário na hora.
      const effectiveDuration = await getEffectiveDuration(option.id, insurance.id);
      setDuration(effectiveDuration);
    }
  }

  async function handleSelectModality(m: Modality) {
    if (!professional || !insurance) return;
    setModality(m);
    setPaymentMethod("convenio");
    setDate(null);
    setSelectedDayInfo(null);
    setTimes([]);
    setTime(null);
    setLoading(true);
    const effectiveDuration = await getEffectiveDuration(professional.id, insurance.id, m);
    setDuration(effectiveDuration);
    setLoading(false);
  }

  async function handleSelectDay(day: DayAvailability) {
    setDate(day.date);
    setSelectedDayInfo(day);
    setTime(null);
    if (!professional || !insurance) return;
    setLoading(true);
    setError(null);
    const data = await getAvailableTimes(professional.id, insurance.id, day.date, modality ?? undefined);
    setTimes(data);
    setLoading(false);
    if (data.length === 0) setError(day.reason ?? "Sem horários livres nesse dia. Escolha outra data.");
  }

  function handleSelectTime(option: TimeOption) {
    setTime(option);
  }

  async function handleConfirm() {
    if (!patient || !professional || !insurance || !date || !time || !paymentMethod) {
      setError("Preencha todos os campos obrigatórios antes de confirmar.");
      return;
    }
    if (requiresModality && !modality) {
      setError("Selecione a modalidade (ABA ou Comum).");
      return;
    }
    if (!requiresModality && !particularProduct) {
      setError("Selecione Consulta Particular ou Pacote Particular.");
      return;
    }

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
        modality: modality ?? undefined,
        particularProduct: particularProduct ?? undefined,
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
      modality: modality ?? undefined,
      particularProduct: particularProduct ?? undefined,
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
      modality: modality ?? undefined,
      particularProduct: particularProduct ?? undefined,
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
    setPatient(null);
    setInsurance(null);
    setProfessional(null);
    setDate(null);
    setSelectedDayInfo(null);
    setTimes([]);
    setTime(null);
    setPricing(null);
    setModality(null);
    setParticularProduct(null);
    setPaymentMethod(null);
    setIsRecurring(false);
    setRecurrence(DEFAULT_RECURRENCE);
    router.refresh();
  }

  if (successResult) {
    return (
      <Card className="border-primary/50 bg-card shadow-2xl animate-fade-up max-w-2xl mx-auto">
        <CardContent className="flex flex-col items-center gap-5 p-8 text-center sm:p-12">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[var(--badge-bg)] border border-primary/40 text-[var(--primary)] shadow-[0_0_30px_rgba(15,164,122,0.3)]">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <Badge tone="premium">Agendamento Realizado!</Badge>
          <h2 className="text-2xl font-black text-text-primary tracking-tight font-heading">
            {successResult.count > 1 ? `${successResult.count} consultas criadas` : "Consulta criada com sucesso"}
          </h2>
          <p className="max-w-lg text-sm text-text-secondary">
            Paciente: <strong className="text-text-primary">{patient?.fullName}</strong>
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
            {successResult.whatsappLink && (
              <a href={successResult.whatsappLink} target="_blank" rel="noreferrer">
                <Button type="button">Enviar confirmação por WhatsApp</Button>
              </a>
            )}
            <Button type="button" variant="secondary" onClick={handleReset}>
              Novo agendamento
            </Button>
            <Button type="button" variant="ghost" onClick={() => router.push("/appointments")}>
              Ver lista de consultas
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
        modality={modality ?? undefined}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3.5 max-w-6xl mx-auto">
      {error && (
        <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">
          {error}
        </div>
      )}

      {/* 2-Column High-Density Workspace */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12">
        {/* Left Column: Paciente, Cidade, Convênio & Profissional */}
        <div className="flex flex-col gap-3.5 lg:col-span-6">
          {/* Card 1: Dados do Paciente */}
          <div className="rounded-xl border border-border/80 bg-card p-3.5 flex flex-col gap-2.5 shadow-xs">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--primary)] font-heading">
                1. Seleção do Paciente
              </span>
            </div>
            <PatientPickerField
              selectedName={patient?.fullName}
              selectedPhone={patient?.phone}
              onSelect={handleSelectPatient}
              onClear={() => setPatient(null)}
            />
            {!showCreatePatient ? (
              <button
                type="button"
                onClick={() => setShowCreatePatient(true)}
                className="w-fit text-xs font-bold text-[var(--primary)] hover:underline"
              >
                + Cadastrar novo paciente rapidamente
              </button>
            ) : (
              <form onSubmit={handleCreatePatient} className="flex flex-col gap-2.5 rounded-lg border border-border bg-card-elevated/60 p-3">
                <span className="text-xs font-bold text-text-primary">Novo Paciente Rápido</span>
                <Input label="Nome Completo" value={newName} onChange={(e) => setNewName(e.target.value)} required />
                <div className="grid grid-cols-2 gap-2">
                  <Input label="Telefone" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
                  <Input label="WhatsApp" value={newWhatsapp} onChange={(e) => setNewWhatsapp(e.target.value)} />
                </div>
                <Input label="Cidade" value={newCity} onChange={(e) => setNewCity(e.target.value)} />
                <div className="flex gap-2 pt-1">
                  <Button type="submit" size="sm" isLoading={creatingPatient} className="h-8 text-xs">
                    Salvar e Usar
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setShowCreatePatient(false)} className="h-8 text-xs">
                    Cancelar
                  </Button>
                </div>
              </form>
            )}
          </div>

          {/* Card 2: Convênio */}
          <div className="rounded-xl border border-border/80 bg-card p-3.5 flex flex-col gap-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--primary)] font-heading">
                2. Convênio
              </span>
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-text-secondary">Convênio Aceito</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {insurances.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelectInsurance(opt)}
                    className={`rounded-lg border p-2 text-left text-xs font-semibold transition-all truncate ${
                      insurance?.id === opt.id
                        ? "border-primary bg-primary/10 text-primary font-bold shadow-xs"
                        : "border-border bg-card-elevated/40 text-text-secondary hover:border-primary/50"
                    }`}
                  >
                    {opt.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Card 3: Profissional */}
          <div className="rounded-xl border border-border/80 bg-card p-3.5 flex flex-col gap-2.5 shadow-xs">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--primary)] font-heading">
                3. Profissional Responsável
              </span>
            </div>
            {!insurance ? (
              <p className="text-xs text-text-muted">Selecione primeiro um convênio acima.</p>
            ) : loading ? (
              <p className="text-xs text-text-muted animate-pulse">Buscando profissionais...</p>
            ) : professionals.length === 0 ? (
              <p className="text-xs text-danger">Nenhum profissional disponível para este convênio.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {professionals.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelectProfessional(opt)}
                    className={`flex items-center gap-2.5 rounded-lg border p-2.5 text-left transition-all ${
                      professional?.id === opt.id
                        ? "border-primary bg-primary/10 ring-1 ring-primary/40 shadow-xs"
                        : "border-border bg-card-elevated/40 hover:border-primary/50"
                    }`}
                  >
                    <Avatar src={opt.avatarUrl} name={opt.fullName} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-text-primary">{opt.fullName}</p>
                      <p className="truncate text-[10px] text-primary dark:text-[var(--link)] font-semibold">{opt.specialtyName}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Calendário, Horários, Recorrência & Resumo */}
        <div className="flex flex-col gap-3.5 lg:col-span-6">
          {/* Card 4: Data & Horário */}
          <div className="rounded-xl border border-border/80 bg-card p-3.5 flex flex-col gap-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--primary)] font-heading">
                4. Data e Horário
              </span>
            </div>
            {!professional ? (
              <p className="text-xs text-text-muted">Selecione primeiro o profissional na coluna ao lado.</p>
            ) : requiresModality && !modality ? (
              <div className="flex flex-col gap-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-text-secondary">Modalidade</label>
                {loading ? (
                  <p className="text-xs text-text-muted animate-pulse">Carregando valores...</p>
                ) : pricing?.insuranceKind === "convenio" && pricing.options.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {MODALITIES.map((m) => {
                      const opt = pricing.options.find((o) => o.modality === m);
                      return (
                        <button
                          key={m}
                          type="button"
                          disabled={!opt}
                          onClick={() => opt && handleSelectModality(m)}
                          className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-all ${
                            !opt
                              ? "border-border/50 bg-card-elevated/20 text-text-muted cursor-not-allowed"
                              : "border-border bg-card-elevated/40 text-text-primary hover:border-primary/50 cursor-pointer"
                          }`}
                        >
                          {MODALITY_LABELS[m]}
                          {opt ? ` — ${formatCurrency(opt.value)}` : " (sem valor)"}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-danger">
                    Este profissional ainda não possui um valor cadastrado para essa modalidade.
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  {duration && (
                    <span className="inline-flex w-fit items-center gap-1.5 rounded-md bg-card-elevated px-2 py-0.5 text-xs font-semibold text-text-secondary border border-border">
                      ⏱ Duração da consulta: <strong className="text-text-primary">{duration} min</strong>
                    </span>
                  )}
                  {requiresModality && modality && (
                    <button
                      type="button"
                      onClick={() => {
                        setModality(null);
                        setDate(null);
                        setSelectedDayInfo(null);
                        setTimes([]);
                        setTime(null);
                        setDuration(null);
                      }}
                      className="text-[10px] font-bold text-[var(--primary)] hover:underline"
                    >
                      {MODALITY_LABELS[modality]} · trocar modalidade
                    </button>
                  )}
                </div>

                {/* Calendário */}
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-text-secondary">Data</label>
                  {insurance && (
                    <AvailabilityCalendar
                      professionalId={professional.id}
                      insuranceId={insurance.id}
                      selectedDate={date}
                      onSelectDate={handleSelectDay}
                      modality={modality ?? undefined}
                    />
                  )}
                </div>

                {/* Times */}
                {date && (
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-text-secondary">Horários Livres</label>
                    {times.length === 0 ? (
                      <p className="text-xs text-danger">{selectedDayInfo?.reason ?? "Sem horários para este dia."}</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                        {times.map((opt) => (
                          <button
                            key={`${opt.slotId}-${opt.startTime}`}
                            type="button"
                            onClick={() => handleSelectTime(opt)}
                            className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition-all ${
                              time?.startTime === opt.startTime
                                ? "border-primary bg-primary text-white shadow-xs font-bold"
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
              </>
            )}
          </div>

          {/* Card 5: Recorrência */}
          <div className="rounded-xl border border-border/80 bg-card p-3.5 flex flex-col gap-2 shadow-xs">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--primary)] font-heading">
                5. Recorrência (opcional)
              </span>
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold text-text-primary cursor-pointer">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="h-3.5 w-3.5 rounded accent-primary"
              />
              Agendamento Recorrente (Semanal, Quinzenal ou Mensal)
            </label>

            {isRecurring && (
              <div className="pt-1">
                <RecurrenceFields value={recurrence} onChange={setRecurrence} />
              </div>
            )}
          </div>

          {/* Card 6: Resumo & Confirmação */}
          <div className="rounded-xl border border-primary/40 bg-card/90 p-3.5 flex flex-col gap-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--primary)] font-heading">
                6. Resumo do Atendimento
              </span>
            </div>
            {(() => {
              const attendance = getAttendanceInfo(insurance?.name, paymentMethod, modality ?? undefined, particularProduct ?? undefined);
              return (
                <div className="grid grid-cols-2 gap-2 text-xs border-b border-border/50 pb-2.5">
                  <div>
                    <span className="text-text-muted block font-medium">Paciente:</span>
                    <span className="font-bold text-text-primary truncate block">{patient?.fullName || "—"}</span>
                  </div>
                  <div>
                    <span className="text-text-muted block font-medium">Profissional:</span>
                    <span className="font-bold text-text-primary truncate block">{professional?.fullName || "—"}</span>
                  </div>
                  <div>
                    <span className="text-text-muted block font-medium">Tipo de Atendimento:</span>
                    <span className="font-bold text-text-primary truncate block">{attendance.attendanceType}</span>
                  </div>
                  {attendance.isConvenio ? (
                    <div>
                      <span className="text-text-muted block font-medium">Convênio:</span>
                      <span className="font-bold text-text-primary truncate block">
                        {attendance.insuranceName}
                        {attendance.modalityLabel ? ` — ${attendance.modalityLabel}` : ""}
                      </span>
                    </div>
                  ) : paymentMethod ? (
                    <div>
                      <span className="text-text-muted block font-medium">Forma de Pagamento:</span>
                      <span className="font-bold text-text-primary truncate block">{attendance.paymentMethodLabel}</span>
                    </div>
                  ) : null}
                  <div className="col-span-2">
                    <span className="text-text-muted block font-medium">Data / Hora:</span>
                    <span className="font-bold text-primary dark:text-[var(--link)]">
                      {date && time
                        ? `${dateFormatter.format(new Date(`${date}T00:00:00`))} às ${time.startTime.slice(0, 5)}`
                        : "—"}
                    </span>
                  </div>
                  {selectedValue != null && (
                    <div className="col-span-2">
                      <span className="text-text-muted block font-medium">Valor:</span>
                      <span className="font-black text-primary">{formatCurrency(selectedValue)}</span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Particular: produto + forma de pagamento. Convênio: modalidade já escolhida acima. */}
            {!requiresModality && (
              <div className="flex flex-col gap-3">
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                    Produto Particular
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {pricing?.insuranceKind === "particular" && pricing.options.length > 0 ? (
                      pricing.options.map((opt) => (
                        <button
                          key={opt.product}
                          type="button"
                          onClick={() => setParticularProduct(opt.product)}
                          className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                            particularProduct === opt.product
                              ? "border-primary bg-primary/10 text-primary font-bold shadow-xs"
                              : "border-border bg-card-elevated/40 text-text-secondary hover:border-primary/50"
                          }`}
                        >
                          {PARTICULAR_PRODUCT_LABELS[opt.product]} — {formatCurrency(opt.value)}
                        </button>
                      ))
                    ) : (
                      <p className="text-xs text-danger">
                        Valores particulares ainda não configurados em Configurações da Clínica.
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                    Forma de Pagamento
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {PARTICULAR_PAYMENT_METHODS.map((pm) => (
                      <button
                        key={pm}
                        type="button"
                        onClick={() => setPaymentMethod(pm)}
                        className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                          paymentMethod === pm
                            ? "border-primary bg-primary/10 text-primary font-bold shadow-xs"
                            : "border-border bg-card-elevated/40 text-text-secondary hover:border-primary/50"
                        }`}
                      >
                        {PAYMENT_LABELS[pm]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="pt-1">
              <Button
                className="w-full h-10 text-xs font-bold shadow-button"
                isLoading={saving}
                disabled={
                  !patient ||
                  !professional ||
                  !insurance ||
                  !date ||
                  !time ||
                  !paymentMethod ||
                  (requiresModality ? !modality : !particularProduct)
                }
                onClick={handleConfirm}
              >
                Confirmar Agendamento
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

