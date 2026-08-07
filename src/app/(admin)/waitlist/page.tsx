import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getWaitlistEntries, getWaitlistStatusCounts } from "@/modules/waitlist/services/waitlist-queries";
import { markWaitlistAsSeen } from "@/modules/waitlist/services/waitlist-actions";
import { getActiveSpecialties } from "@/modules/specialties/services/specialty-queries";
import { getActiveProfessionals } from "@/modules/professionals/services/professional-queries";
import { getActiveInsurances } from "@/modules/insurances/services/insurance-queries";
import { WaitlistTable } from "@/modules/waitlist/components/WaitlistTable";
import type { WaitlistStatus } from "@/lib/supabase/types";

export const metadata = {
  title: "Lista de Espera — ClinicaZoe",
};

interface WaitlistPageProps {
  searchParams: Promise<{
    specialty?: string;
    professional?: string;
    insurance?: string;
    status?: string;
    date?: string;
    q?: string;
    page?: string;
  }>;
}

const VALID_STATUSES: WaitlistStatus[] = [
  "aguardando",
  "contato_realizado",
  "vaga_oferecida",
  "agendado",
  "cancelado",
  "sem_interesse",
];

export default async function WaitlistPage({ searchParams }: WaitlistPageProps) {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (!["admin", "recepcionista"].includes(session.profile.role)) redirect("/dashboard");

  await markWaitlistAsSeen();

  const { specialty, professional, insurance, status, date, q, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const statusFilter = VALID_STATUSES.includes(status as WaitlistStatus) ? (status as WaitlistStatus) : undefined;

  const [{ items, totalPages }, statusCounts, specialties, professionals, insurances] = await Promise.all([
    getWaitlistEntries({
      specialtyId: specialty || undefined,
      professionalId: professional || undefined,
      insuranceId: insurance || undefined,
      status: statusFilter,
      date: date || undefined,
      search: q || undefined,
      page,
    }),
    getWaitlistStatusCounts(),
    getActiveSpecialties(),
    getActiveProfessionals(),
    getActiveInsurances(),
  ]);

  const canManage = ["admin", "recepcionista"].includes(session.profile.role);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary font-heading">Lista de Espera</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Pacientes aguardando uma vaga compatível. Avise a equipe, ofereça vagas e transforme em agendamento sem
          sair da tela.
        </p>
      </div>

      <WaitlistTable
        entries={items}
        page={page}
        totalPages={totalPages}
        statusCounts={statusCounts}
        specialties={specialties}
        professionals={professionals.map((p) => ({ id: p.id, name: p.full_name }))}
        insurances={insurances}
        filters={{
          specialty: specialty ?? "",
          professional: professional ?? "",
          insurance: insurance ?? "",
          status: status ?? "",
          date: date ?? "",
          q: q ?? "",
        }}
        canManage={canManage}
      />
    </div>
  );
}
