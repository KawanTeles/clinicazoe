import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAgendaForProfessionals } from "@/modules/schedule/services/agenda-queries";
import { AgendaBoard } from "@/modules/schedule/components/AgendaBoard";
import { toLocalIsoDate } from "@/lib/date";

export const metadata = {
  title: "Agenda — Espaço Zoe",
};

function mondayOfWeek(date: Date): Date {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  return monday;
}

function weekDates(monday: Date): string[] {
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return toLocalIsoDate(d);
  });
}

export default async function SchedulePage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (!["admin", "recepcionista", "profissional"].includes(session.profile.role)) {
    redirect("/dashboard");
  }

  const supabase = await createClient();

  const { data: professionalsRaw } = await supabase.from("professionals").select("id").eq("status", "active");

  const professionalIds = (professionalsRaw ?? []).map((p) => p.id);
  const [{ data: profiles }, { data: specialtyLinks }, { data: insurances }] = await Promise.all([
    professionalIds.length > 0
      ? supabase.from("profiles").select("id, full_name").in("id", professionalIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    professionalIds.length > 0
      ? supabase.from("professional_specialties").select("professional_id, specialty_id").in("professional_id", professionalIds)
      : Promise.resolve({ data: [] as { professional_id: string; specialty_id: string }[] }),
    supabase.from("insurances").select("id, name, color").eq("status", "active"),
  ]);

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const specialtyByProfessionalId = new Map<string, string>();
  for (const link of specialtyLinks ?? []) {
    if (!specialtyByProfessionalId.has(link.professional_id)) {
      specialtyByProfessionalId.set(link.professional_id, link.specialty_id);
    }
  }

  const professionals = professionalIds
    .map((id) => ({
      id,
      fullName: nameById.get(id) ?? "—",
      specialtyId: specialtyByProfessionalId.get(id) ?? null,
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "pt-BR"));

  const isProfessional = session.profile.role === "profissional";
  const defaultProfessionalId = isProfessional ? session.user.id : (professionals[0]?.id ?? null);

  const monday = mondayOfWeek(new Date());
  const dates = weekDates(monday);

  const initialAgenda = defaultProfessionalId
    ? Array.from((await getAgendaForProfessionals([defaultProfessionalId], dates[0], dates[4])).values())[0] ?? null
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary font-heading">Agenda</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Visão semanal por profissional — clique num horário livre para agendar, clique num atendimento para
          editar, ou arraste para mover.
        </p>
      </div>

      <AgendaBoard
        professionals={isProfessional ? professionals.filter((p) => p.id === session.user.id) : professionals}
        insurances={(insurances ?? []).map((i) => ({ id: i.id, name: i.name, color: i.color }))}
        canViewAll={!isProfessional}
        defaultProfessionalId={defaultProfessionalId}
        initialWeekStart={dates[0]}
        initialAgenda={initialAgenda}
        viewerRole={session.profile.role}
      />
    </div>
  );
}
