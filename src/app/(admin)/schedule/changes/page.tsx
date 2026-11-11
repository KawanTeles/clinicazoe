import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  getScheduleChangeLog,
  getActiveProfessionalsForFilter,
} from "@/modules/schedule/services/agenda-queries";

export const metadata = {
  title: "Alterações da Agenda — Espaço Zoe",
};

const ENTITY_LABELS: Record<string, string> = {
  appointment: "Atendimento",
  schedule_slot: "Horário de trabalho",
  schedule_block: "Bloqueio",
  schedule_exception: "Férias/Ausência",
};

const ACTION_LABELS: Record<string, string> = {
  created: "Criado",
  updated: "Alterado",
  rescheduled: "Remarcado",
  cancelled: "Cancelado",
  status_changed: "Status alterado",
  slot_created: "Horário criado",
  slot_updated: "Horário alterado",
  slot_deleted: "Horário removido",
  block_created: "Bloqueio criado",
  block_deleted: "Bloqueio removido",
  exception_created: "Férias/ausência criada",
  exception_deleted: "Férias/ausência removida",
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value.split("-").reverse().join("/");
  return String(value);
}

export default async function ScheduleChangesPage({
  searchParams,
}: {
  searchParams: Promise<{ professionalId?: string; entityType?: string; startDate?: string; endDate?: string }>;
}) {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (!["admin", "recepcionista", "profissional"].includes(session.profile.role)) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const isProfessional = session.profile.role === "profissional";

  const [rows, professionals] = await Promise.all([
    getScheduleChangeLog({
      professionalId: isProfessional ? session.user.id : params.professionalId,
      entityType: params.entityType,
      startDate: params.startDate,
      endDate: params.endDate,
    }),
    isProfessional ? Promise.resolve([]) : getActiveProfessionalsForFilter(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary font-heading">Alterações da Agenda</h1>
        <p className="mt-1 text-sm text-text-secondary">
          {isProfessional
            ? "Histórico de alterações na sua agenda."
            : "Histórico de alterações em atendimentos, horários e bloqueios de todos os profissionais."}
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4">
        {!isProfessional && (
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">Profissional</label>
            <select
              name="professionalId"
              defaultValue={params.professionalId ?? ""}
              className="h-9.5 rounded-lg border border-border bg-card-elevated px-3 text-xs font-medium text-text-primary"
            >
              <option value="">Todos</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">Tipo</label>
          <select
            name="entityType"
            defaultValue={params.entityType ?? ""}
            className="h-9.5 rounded-lg border border-border bg-card-elevated px-3 text-xs font-medium text-text-primary"
          >
            <option value="">Todos</option>
            {Object.entries(ENTITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">De</label>
          <input type="date" name="startDate" defaultValue={params.startDate ?? ""} className="h-9.5 rounded-lg border border-border bg-card-elevated px-3 text-xs" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">Até</label>
          <input type="date" name="endDate" defaultValue={params.endDate ?? ""} className="h-9.5 rounded-lg border border-border bg-card-elevated px-3 text-xs" />
        </div>
        <button type="submit" className="h-9.5 rounded-lg bg-[var(--primary)] px-4 text-xs font-bold text-white">
          Filtrar
        </button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-left text-xs">
          <thead className="bg-card-elevated/60 text-[11px] uppercase tracking-wide text-text-secondary">
            <tr>
              <th className="px-4 py-3">Quando</th>
              <th className="px-4 py-3">Quem alterou</th>
              <th className="px-4 py-3">Agenda de</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Ação</th>
              <th className="px-4 py-3">Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                  Nenhuma alteração encontrada.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-border/60">
                  <td className="px-4 py-3 whitespace-nowrap text-text-secondary">
                    {new Date(row.createdAt).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 font-semibold text-text-primary">{row.changedByName}</td>
                  <td className="px-4 py-3 text-text-secondary">{row.professionalName}</td>
                  <td className="px-4 py-3 text-text-secondary">{ENTITY_LABELS[row.entityType] ?? row.entityType}</td>
                  <td className="px-4 py-3 text-text-secondary">{ACTION_LABELS[row.action] ?? row.action}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    {row.changes.length === 0
                      ? "—"
                      : row.changes.map((c) => `${c.field}: ${formatValue(c.old)} → ${formatValue(c.new)}`).join("; ")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
