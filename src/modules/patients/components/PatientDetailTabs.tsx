"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency } from "@/lib/whatsapp";
import { setPatientStatus } from "@/modules/patients/services/patient-actions";
import { EvolutionTimeline } from "@/modules/evolutions/components/EvolutionTimeline";
import type { EvolutionView } from "@/modules/evolutions/services/evolution-queries";

interface AppointmentRow {
  id: string;
  appointment_date: string;
  start_time: string;
  status: string;
  value: number;
  professionalName: string;
  specialtyName: string;
  insuranceName: string;
}

interface SeriesRow {
  id: string;
  professionalName: string;
  frequency: string;
  dayLabel: string;
  startTime: string;
  status: string;
}

interface MessageRow {
  id: string;
  type: string;
  createdAt: string;
  sentByName: string | null;
}

interface PatientDetailTabsProps {
  patient: {
    id: string;
    fullName: string;
    phone: string | null;
    status: string;
    details: {
      cpf: string | null;
      birth_date: string | null;
      email: string | null;
      whatsapp: string | null;
      address: string | null;
      city: string | null;
      insurance_card_number: string | null;
      insurance_card_valid_until: string | null;
      notes: string | null;
    } | null;
    preferredInsuranceName: string | null;
    preferredProfessionalName: string | null;
  };
  upcoming: AppointmentRow[];
  history: AppointmentRow[];
  series: SeriesRow[];
  messages: MessageRow[];
  canManage: boolean;
  canChangeStatus: boolean;
  /** Só true para admin — recepcionista nunca recebe a aba de prontuário. */
  canViewClinical?: boolean;
  evolutions?: EvolutionView[];
}

const BASE_TABS = ["Dados", "Próximas consultas", "Histórico", "Recorrências", "Mensagens"] as const;
const CLINICAL_TAB = "Histórico Clínico";
type Tab = (typeof BASE_TABS)[number] | typeof CLINICAL_TAB;

const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
  remarcada: "Remarcada",
  concluida: "Concluída",
  faltou: "Faltou",
};

const MESSAGE_LABELS: Record<string, string> = {
  booking: "Confirmação de agendamento",
  confirmation: "Consulta confirmada",
  cancellation: "Cancelamento/remarcação",
  reminder: "Lembrete de consulta",
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });
const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function PatientDetailTabs({
  patient,
  upcoming,
  history,
  series,
  messages,
  canManage,
  canChangeStatus,
  canViewClinical = false,
  evolutions = [],
}: PatientDetailTabsProps) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState<Tab>("Dados");
  const [togglingStatus, setTogglingStatus] = useState(false);
  const visibleTabs: Tab[] = canViewClinical ? [...BASE_TABS, CLINICAL_TAB] : [...BASE_TABS];

  async function handleReactivate() {
    setTogglingStatus(true);
    const result = await setPatientStatus(patient.id, "active");
    setTogglingStatus(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Paciente reativado com sucesso.");
    router.refresh();
  }

  async function handleDelete() {
    const confirmed = await confirm({
      title: `Excluir "${patient.fullName}"?`,
      description:
        "Para preservar consultas e histórico clínico já registrados, o cadastro será desativado em vez de apagado permanentemente. Essa ação pode ser revertida reativando o paciente.",
      confirmLabel: "Excluir",
      tone: "danger",
    });
    if (!confirmed) return;

    setTogglingStatus(true);
    const result = await setPatientStatus(patient.id, "inactive");
    setTogglingStatus(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Paciente excluído com sucesso.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary font-heading">{patient.fullName}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge tone={patient.status === "active" ? "success" : "neutral"}>
              {patient.status === "active" ? "Ativo" : "Inativo"}
            </Badge>
            <span className="text-sm text-text-secondary">{patient.phone || "Sem telefone"}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {canManage && (
            <Link href={`/patients/${patient.id}/edit`}>
              <Button variant="secondary">Editar</Button>
            </Link>
          )}
          {canChangeStatus && patient.status === "active" && (
            <Button variant="danger" isLoading={togglingStatus} onClick={handleDelete}>
              Excluir
            </Button>
          )}
          {canChangeStatus && patient.status === "inactive" && (
            <Button variant="primary" isLoading={togglingStatus} onClick={handleReactivate}>
              Reativar
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {visibleTabs.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={
              tab === item
                ? "rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-white"
                : "rounded-full border border-border bg-card-elevated px-4 py-1.5 text-xs font-semibold text-text-secondary hover:border-primary/50"
            }
          >
            {item}
          </button>
        ))}
      </div>

      {tab === "Dados" && (
        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border bg-card p-6 shadow-card sm:grid-cols-2">
          <Field label="CPF" value={patient.details?.cpf} />
          <Field
            label="Data de nascimento"
            value={patient.details?.birth_date ? dateFormatter.format(new Date(`${patient.details.birth_date}T00:00:00`)) : null}
          />
          <Field label="E-mail" value={patient.details?.email} />
          <Field label="WhatsApp" value={patient.details?.whatsapp} />
          <Field label="Endereço" value={patient.details?.address} />
          <Field label="Cidade" value={patient.details?.city} />
          <Field label="Convênio" value={patient.preferredInsuranceName} />
          <Field label="Nº da carteirinha" value={patient.details?.insurance_card_number} />
          <Field
            label="Validade da carteirinha"
            value={
              patient.details?.insurance_card_valid_until
                ? dateFormatter.format(new Date(`${patient.details.insurance_card_valid_until}T00:00:00`))
                : null
            }
          />
          <Field label="Profissional de preferência" value={patient.preferredProfessionalName} />
          <div className="sm:col-span-2">
            <Field label="Observações" value={patient.details?.notes} />
          </div>
        </div>
      )}

      {tab === "Próximas consultas" && <AppointmentsTable rows={upcoming} empty="Nenhuma consulta futura." />}
      {tab === "Histórico" && <AppointmentsTable rows={history} empty="Nenhuma consulta anterior." />}
      {tab === CLINICAL_TAB && <EvolutionTimeline evolutions={evolutions} />}

      {tab === "Recorrências" && (
        <div className="flex flex-col gap-3">
          {series.length === 0 ? (
            <EmptyState text="Nenhuma consulta recorrente." />
          ) : (
            series.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                <div>
                  <p className="font-semibold text-text-primary">
                    {s.dayLabel} às {s.startTime.slice(0, 5)} — {s.professionalName}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {s.frequency === "weekly" ? "Semanalmente" : s.frequency === "biweekly" ? "Quinzenalmente" : "Mensalmente"}
                  </p>
                </div>
                <Badge tone={s.status === "active" ? "premium" : "neutral"}>
                  {s.status === "active" ? "Ativa" : "Cancelada"}
                </Badge>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "Mensagens" && (
        <div className="flex flex-col gap-2">
          {messages.length === 0 ? (
            <EmptyState text="Nenhuma mensagem enviada ainda." />
          ) : (
            messages.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm">
                <span className="font-medium text-text-primary">{MESSAGE_LABELS[m.type] ?? m.type}</span>
                <span className="text-xs text-text-secondary">
                  {dateTimeFormatter.format(new Date(m.createdAt))}
                  {m.sentByName ? ` — ${m.sentByName}` : ""}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">{label}</p>
      <p className="mt-1 text-sm text-text-primary">{value || "—"}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm font-medium text-text-secondary">
      {text}
    </div>
  );
}

function AppointmentsTable({ rows, empty }: { rows: AppointmentRow[]; empty: string }) {
  if (rows.length === 0) return <EmptyState text={empty} />;

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-card">
      <table className="w-full min-w-[600px] text-left text-sm">
        <thead className="border-b border-border bg-card-elevated/80 text-xs font-bold uppercase tracking-wider text-text-secondary">
          <tr>
            <th className="px-5 py-4 font-bold">Data/Hora</th>
            <th className="px-5 py-4 font-bold">Profissional</th>
            <th className="px-5 py-4 font-bold">Convênio</th>
            <th className="px-5 py-4 font-bold">Valor</th>
            <th className="px-5 py-4 font-bold">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-surface/50">
              <td className="px-5 py-4 text-text-secondary">
                {dateFormatter.format(new Date(`${row.appointment_date}T00:00:00`))}{" "}
                <span className="font-semibold text-text-primary">{row.start_time.slice(0, 5)}</span>
              </td>
              <td className="px-5 py-4 font-semibold text-text-primary">{row.professionalName}</td>
              <td className="px-5 py-4 text-text-secondary">{row.insuranceName}</td>
              <td className="px-5 py-4 text-text-secondary">{formatCurrency(row.value)}</td>
              <td className="px-5 py-4">
                <Badge tone="neutral">{STATUS_LABELS[row.status] ?? row.status}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
