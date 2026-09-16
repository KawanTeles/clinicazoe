"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { insuranceRequiresModality, MODALITY_LABELS, PARTICULAR_PRODUCT_LABELS } from "@/lib/constants";
import type { Modality, ParticularProduct, PaymentMethod } from "@/lib/supabase/types";
import { PatientPickerField } from "@/modules/patients/components/PatientPickerField";
import type { PatientSearchResult } from "@/modules/patients/services/patient-actions";
import { AvailabilityCalendar } from "@/modules/appointments/components/AvailabilityCalendar";
import { getAvailableTimes, type DayAvailability } from "@/modules/appointments/services/booking-queries";
import { createGroupAppointment, type GroupParticipantInput } from "@/modules/appointments/services/booking-actions";

interface Option {
  id: string;
  name: string;
}

interface ProfessionalOption {
  id: string;
  fullName: string;
}

interface TimeOption {
  slotId: string;
  startTime: string;
  endTime: string;
}

interface ParticipantDraft {
  key: string;
  patient: PatientSearchResult | null;
  insuranceId: string;
  paymentMethod: PaymentMethod | "";
  modality: Modality | "";
  particularProduct: ParticularProduct | "";
}

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cartao: "Cartão",
  pix: "PIX",
  dinheiro: "Dinheiro",
  convenio: "Convênio",
};
const MODALITIES: Modality[] = ["aba", "comum"];
const PARTICULAR_PRODUCTS: ParticularProduct[] = ["consulta", "pacote"];
const PARTICULAR_PAYMENT_METHODS: PaymentMethod[] = ["cartao", "pix", "dinheiro"];

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

let participantKeySeq = 0;
function emptyParticipant(): ParticipantDraft {
  participantKeySeq += 1;
  return {
    key: `participant-${participantKeySeq}`,
    patient: null,
    insuranceId: "",
    paymentMethod: "",
    modality: "",
    particularProduct: "",
  };
}

interface GroupAppointmentFormProps {
  insurances: Option[];
  professionals: ProfessionalOption[];
}

/** Cria um atendimento conjugado (dupla/grupo/multidisciplinar) — separado do
 * StaffAppointmentForm (1 paciente + 1 profissional) para não arriscar
 * regredir o fluxo simples, que é o mais usado. Disponibilidade é checada
 * pelo convênio do PRIMEIRO participante (limitação de v1, documentada no
 * plano): se outro participante tiver convênio incompatível com o slot
 * escolhido, o erro só aparece ao confirmar. */
export function GroupAppointmentForm({ insurances, professionals }: GroupAppointmentFormProps) {
  const router = useRouter();

  const [principalId, setPrincipalId] = useState("");
  const [coTherapistIds, setCoTherapistIds] = useState<string[]>([]);
  const [participants, setParticipants] = useState<ParticipantDraft[]>(() => [emptyParticipant(), emptyParticipant()]);

  const [date, setDate] = useState<string | null>(null);
  const [selectedDayInfo, setSelectedDayInfo] = useState<DayAvailability | null>(null);
  const [times, setTimes] = useState<TimeOption[]>([]);
  const [time, setTime] = useState<TimeOption | null>(null);
  const [loadingTimes, setLoadingTimes] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ count: number } | null>(null);

  const insuranceById = new Map(insurances.map((i) => [i.id, i]));
  const representative = participants[0];
  const representativeInsurance = representative ? insuranceById.get(representative.insuranceId) : undefined;

  function updateParticipant(key: string, patch: Partial<ParticipantDraft>) {
    setParticipants((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }

  function addParticipant() {
    setParticipants((prev) => [...prev, emptyParticipant()]);
  }

  function removeParticipant(key: string) {
    setParticipants((prev) => (prev.length > 1 ? prev.filter((p) => p.key !== key) : prev));
  }

  function toggleCoTherapist(id: string) {
    setCoTherapistIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function resetAvailability() {
    setDate(null);
    setSelectedDayInfo(null);
    setTimes([]);
    setTime(null);
  }

  async function handleSelectDay(day: DayAvailability) {
    setDate(day.date);
    setSelectedDayInfo(day);
    setTime(null);
    if (!principalId || !representativeInsurance) return;
    setLoadingTimes(true);
    setError(null);
    const data = await getAvailableTimes(principalId, representativeInsurance.id, day.date);
    setTimes(data);
    setLoadingTimes(false);
    if (data.length === 0) setError(day.reason ?? "Sem horários livres nesse dia. Escolha outra data.");
  }

  async function handleSubmit() {
    setError(null);

    if (!principalId) {
      setError("Selecione o profissional principal.");
      return;
    }
    if (!date || !time) {
      setError("Selecione data e horário.");
      return;
    }

    const resolvedParticipants: GroupParticipantInput[] = [];
    for (const p of participants) {
      if (!p.patient) {
        setError("Preencha o paciente de todos os participantes.");
        return;
      }
      if (!p.insuranceId) {
        setError(`Selecione o convênio de ${p.patient.fullName}.`);
        return;
      }
      const insurance = insuranceById.get(p.insuranceId);
      const requiresModality = insuranceRequiresModality(insurance?.name);
      if (requiresModality && !p.modality) {
        setError(`Selecione a modalidade de ${p.patient.fullName}.`);
        return;
      }
      if (!requiresModality && !p.particularProduct) {
        setError(`Selecione o produto particular de ${p.patient.fullName}.`);
        return;
      }
      if (!p.paymentMethod) {
        setError(`Selecione a forma de pagamento de ${p.patient.fullName}.`);
        return;
      }

      resolvedParticipants.push({
        patientId: p.patient.id,
        insuranceId: p.insuranceId,
        paymentMethod: p.paymentMethod,
        modality: p.modality || undefined,
        particularProduct: p.particularProduct || undefined,
      });
    }

    const uniquePatientIds = new Set(resolvedParticipants.map((p) => p.patientId));
    if (uniquePatientIds.size !== resolvedParticipants.length) {
      setError("Cada paciente só pode aparecer uma vez nesta sessão.");
      return;
    }

    setSaving(true);
    const result = await createGroupAppointment({
      principalProfessionalId: principalId,
      coTherapistProfessionalIds: coTherapistIds,
      scheduleSlotId: time.slotId,
      date,
      startTime: time.startTime,
      endTime: time.endTime,
      participants: resolvedParticipants,
    });
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccess({ count: resolvedParticipants.length });
  }

  if (success) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-2xl border border-primary/40 bg-card p-8 text-center shadow-card animate-fade-up">
        <Badge tone="premium">Sessão criada!</Badge>
        <h2 className="text-xl font-bold text-text-primary font-heading">
          {success.count} atendimentos criados nesta sessão
        </h2>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Button variant="secondary" onClick={() => router.push("/appointments")}>
            Ver atendimentos
          </Button>
          <Button variant="ghost" onClick={() => router.refresh()}>
            Criar outra sessão
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-3.5">
      {error && (
        <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-3.5 shadow-xs">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--primary)] font-heading">
          Profissionais
        </span>
        <Select
          label="Profissional principal"
          value={principalId}
          onChange={(e) => {
            setPrincipalId(e.target.value);
            setCoTherapistIds((prev) => prev.filter((id) => id !== e.target.value));
            resetAvailability();
          }}
        >
          <option value="">Selecione</option>
          {professionals.map((p) => (
            <option key={p.id} value={p.id}>
              {p.fullName}
            </option>
          ))}
        </Select>

        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-text-secondary">
            Profissionais adicionais (coterapeutas)
          </label>
          {professionals.filter((p) => p.id !== principalId).length === 0 ? (
            <p className="text-xs text-text-muted">Nenhum outro profissional disponível.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {professionals
                .filter((p) => p.id !== principalId)
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleCoTherapist(p.id)}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all ${
                      coTherapistIds.includes(p.id)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card-elevated/40 text-text-secondary hover:border-primary/50"
                    }`}
                  >
                    {p.fullName}
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-3.5 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--primary)] font-heading">
            Participantes ({participants.length})
          </span>
          <Button type="button" size="sm" variant="ghost" onClick={addParticipant}>
            + Adicionar paciente
          </Button>
        </div>

        {participants.map((p, index) => {
          const insurance = insuranceById.get(p.insuranceId);
          const requiresModality = insuranceRequiresModality(insurance?.name);
          const paymentOptions = requiresModality ? (["convenio"] as PaymentMethod[]) : PARTICULAR_PAYMENT_METHODS;

          return (
            <div key={p.key} className="flex flex-col gap-2.5 rounded-lg border border-border bg-card-elevated/40 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-text-primary">Paciente {index + 1}</span>
                {participants.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeParticipant(p.key)}
                    className="text-xs font-semibold text-danger hover:underline"
                  >
                    Remover
                  </button>
                )}
              </div>

              <PatientPickerField
                selectedName={p.patient?.fullName}
                selectedPhone={p.patient?.phone}
                onSelect={(selected) => updateParticipant(p.key, { patient: selected })}
                onClear={() => updateParticipant(p.key, { patient: null })}
              />

              <div className="grid grid-cols-2 gap-2">
                <Select
                  label="Convênio"
                  value={p.insuranceId}
                  onChange={(e) =>
                    updateParticipant(p.key, {
                      insuranceId: e.target.value,
                      modality: "",
                      particularProduct: "",
                      paymentMethod: "",
                    })
                  }
                >
                  <option value="">Selecione</option>
                  {insurances.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Forma de pagamento"
                  value={p.paymentMethod}
                  onChange={(e) => updateParticipant(p.key, { paymentMethod: e.target.value as PaymentMethod })}
                  disabled={!p.insuranceId}
                >
                  <option value="">Selecione</option>
                  {paymentOptions.map((pm) => (
                    <option key={pm} value={pm}>
                      {PAYMENT_LABELS[pm]}
                    </option>
                  ))}
                </Select>
              </div>

              {p.insuranceId &&
                (requiresModality ? (
                  <Select
                    label="Modalidade"
                    value={p.modality}
                    onChange={(e) => updateParticipant(p.key, { modality: e.target.value as Modality })}
                  >
                    <option value="">Selecione</option>
                    {MODALITIES.map((m) => (
                      <option key={m} value={m}>
                        {MODALITY_LABELS[m]}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Select
                    label="Produto particular"
                    value={p.particularProduct}
                    onChange={(e) => updateParticipant(p.key, { particularProduct: e.target.value as ParticularProduct })}
                  >
                    <option value="">Selecione</option>
                    {PARTICULAR_PRODUCTS.map((prod) => (
                      <option key={prod} value={prod}>
                        {PARTICULAR_PRODUCT_LABELS[prod]}
                      </option>
                    ))}
                  </Select>
                ))}
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-3.5 shadow-xs">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--primary)] font-heading">
          Data e horário
        </span>
        {!principalId || !representativeInsurance ? (
          <p className="text-xs text-text-muted">
            Selecione o profissional principal e o convênio do primeiro paciente para ver a disponibilidade.
          </p>
        ) : (
          <>
            <AvailabilityCalendar
              professionalId={principalId}
              insuranceId={representativeInsurance.id}
              selectedDate={date}
              onSelectDate={handleSelectDay}
            />
            {date && (
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                  Horários livres
                </label>
                {loadingTimes ? (
                  <p className="text-xs text-text-muted animate-pulse">Carregando...</p>
                ) : times.length === 0 ? (
                  <p className="text-xs text-danger">{selectedDayInfo?.reason ?? "Sem horários para este dia."}</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {times.map((opt) => (
                      <button
                        key={`${opt.slotId}-${opt.startTime}`}
                        type="button"
                        onClick={() => setTime(opt)}
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
            {date && time && (
              <p className="text-xs text-text-secondary">
                Sessão em {dateFormatter.format(new Date(`${date}T00:00:00`))} às {time.startTime.slice(0, 5)}.
              </p>
            )}
          </>
        )}
      </div>

      <Button className="h-10 w-full text-xs font-bold" isLoading={saving} disabled={!principalId || !date || !time} onClick={handleSubmit}>
        Criar atendimento conjugado
      </Button>
    </div>
  );
}
