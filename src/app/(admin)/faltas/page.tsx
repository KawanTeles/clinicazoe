import { redirect } from "next/navigation";
import { Pagination } from "@/components/ui/Pagination";
import { getCurrentUser } from "@/lib/auth";
import { getAbsencesForViewer, type AbsencePeriodFilter } from "@/modules/appointments/services/appointment-queries";
import { getActiveProfessionals } from "@/modules/professionals/services/professional-queries";
import { AbsencesFilters } from "@/modules/appointments/components/AbsencesFilters";
import { AbsencePatientList } from "@/modules/appointments/components/AbsencePatientList";

export const metadata = {
  title: "Faltas — Espaço Zoe",
};

const VALID_PERIODS: AbsencePeriodFilter[] = ["30d", "mes_atual", "todos"];

interface FaltasPageProps {
  searchParams: Promise<{ professional?: string; period?: string; page?: string }>;
}

export default async function FaltasPage({ searchParams }: FaltasPageProps) {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (!["admin", "recepcionista", "profissional"].includes(session.profile.role)) redirect("/dashboard");

  const isStaff = session.profile.role === "admin" || session.profile.role === "recepcionista";
  const { professional, period: periodParam, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const period = VALID_PERIODS.includes(periodParam as AbsencePeriodFilter)
    ? (periodParam as AbsencePeriodFilter)
    : "todos";

  const [{ groups, totalPages, totalAbsences }, professionals] = await Promise.all([
    getAbsencesForViewer(session.profile.role, session.user.id, page, {
      professionalId: isStaff ? professional : undefined,
      period,
    }),
    isStaff ? getActiveProfessionals() : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary font-heading">Faltas</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {isStaff
              ? "Pacientes que faltaram, agrupados por paciente — de todos os profissionais."
              : "Pacientes que faltaram com você, agrupados por paciente."}
          </p>
        </div>
        {totalAbsences > 0 && (
          <span className="text-xs font-semibold text-text-secondary">
            {totalAbsences} {totalAbsences === 1 ? "falta" : "faltas"} · {groups.length === 1 ? "1 paciente" : `${groups.length} pacientes`}{" "}
            {totalPages > 1 ? "nesta página" : "no período"}
          </span>
        )}
      </div>

      <AbsencesFilters
        professionals={professionals.map((p) => ({ id: p.id, name: p.full_name }))}
        selectedProfessionalId={professional ?? ""}
        selectedPeriod={period}
        showProfessionalFilter={isStaff}
      />

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-sm font-medium text-text-secondary">
          Nenhuma falta registrada neste período.
        </div>
      ) : (
        <AbsencePatientList groups={groups} isStaff={isStaff} />
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        basePath="/faltas"
        searchParams={{ professional: isStaff ? professional : undefined, period: period !== "todos" ? period : undefined }}
      />
    </div>
  );
}
