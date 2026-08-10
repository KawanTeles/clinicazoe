import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/supabase/types";

/** Ids das consultas onde este profissional é coterapeuta (atendimento
 * compartilhado, Fase 2) — somadas às consultas onde ele é o principal para
 * as contagens/agregações do dashboard não ficarem incompletas para quem
 * participa de um atendimento sem ser o "dono" da agenda consumida.
 * Financeiro fica de fora por enquanto: financial_entries ainda só tem o
 * professional_id principal (modelo de rateio para coterapeuta pendente de
 * decisão de negócio). */
async function getCoTherapistAppointmentIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  professionalId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("appointment_professionals")
    .select("appointment_id")
    .eq("professional_id", professionalId);
  return (data ?? []).map((r) => r.appointment_id);
}

function startOfWeekISO() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function startOfMonthISO() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

export async function getStaffDashboard(role: Role, userId: string) {
  const supabase = await createClient();
  const today = todayISO();
  const weekStart = startOfWeekISO();
  const monthStart = startOfMonthISO();

  let appointmentsQuery = supabase.from("appointments").select("id, appointment_date, status");
  let financialQuery = supabase.from("financial_entries").select("value, status, paid_at");

  const coTherapistAppointmentIds =
    role === "profissional" ? await getCoTherapistAppointmentIds(supabase, userId) : [];

  if (role === "profissional") {
    appointmentsQuery = appointmentsQuery.eq("professional_id", userId);
    financialQuery = financialQuery.eq("professional_id", userId);
  }

  const [{ data: appointments }, { data: coTherapistAppointments }, { data: financialEntries }, { count: activeProfessionals }] =
    await Promise.all([
      appointmentsQuery,
      coTherapistAppointmentIds.length > 0
        ? supabase.from("appointments").select("id, appointment_date, status").in("id", coTherapistAppointmentIds)
        : Promise.resolve({ data: [] as { id: string; appointment_date: string; status: string }[] }),
      financialQuery,
      role === "admin" || role === "recepcionista"
        ? supabase
            .from("professionals")
            .select("id", { count: "exact", head: true })
            .eq("status", "active")
        : Promise.resolve({ count: null }),
    ]);

  const rows = [...(appointments ?? []), ...(coTherapistAppointments ?? [])];
  const activeStatuses = ["pendente", "confirmada"];

  const today_count = rows.filter(
    (a) => a.appointment_date === today && activeStatuses.includes(a.status),
  ).length;
  const week_count = rows.filter(
    (a) => a.appointment_date >= weekStart && activeStatuses.includes(a.status),
  ).length;
  const cancelled_count = rows.filter((a) => a.status === "cancelada").length;
  const completed_count = rows.filter((a) => a.status === "concluida").length;
  const pending_count = rows.filter((a) => a.status === "pendente").length;
  const confirmed_count = rows.filter((a) => a.status === "confirmada").length;

  const finance = financialEntries ?? [];
  const receitaPrevista = finance
    .filter((f) => f.status === "em_aberto")
    .reduce((sum, f) => sum + f.value, 0);
  const receitaRecebida = finance
    .filter((f) => f.status === "pago")
    .reduce((sum, f) => sum + f.value, 0);

  const paidEntries = finance.filter((f) => f.status === "pago" && f.paid_at);
  const billingToday = paidEntries
    .filter((f) => f.paid_at!.slice(0, 10) === today)
    .reduce((sum, f) => sum + f.value, 0);
  const billingWeek = paidEntries
    .filter((f) => f.paid_at!.slice(0, 10) >= weekStart)
    .reduce((sum, f) => sum + f.value, 0);
  const billingMonth = paidEntries
    .filter((f) => f.paid_at!.slice(0, 10) >= monthStart)
    .reduce((sum, f) => sum + f.value, 0);

  return {
    todayCount: today_count,
    weekCount: week_count,
    cancelledCount: cancelled_count,
    completedCount: completed_count,
    pendingCount: pending_count,
    confirmedCount: confirmed_count,
    receitaPrevista,
    receitaRecebida,
    billingToday,
    billingWeek,
    billingMonth,
    activeProfessionals: activeProfessionals ?? null,
  };
}

const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export interface DailyStat {
  date: string;
  label: string;
  appointments: number;
  revenuePrevista: number;
  revenueRecebida: number;
}

export async function getWeeklySeries(role: Role, userId: string): Promise<DailyStat[]> {
  const supabase = await createClient();

  const days: string[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    days.push(date.toISOString().slice(0, 10));
  }
  const rangeStart = days[0];

  let appointmentsQuery = supabase
    .from("appointments")
    .select("appointment_date, status")
    .gte("appointment_date", rangeStart);
  let financialQuery = supabase
    .from("financial_entries")
    .select("due_date, status, value")
    .gte("due_date", rangeStart);

  const coTherapistAppointmentIds =
    role === "profissional" ? await getCoTherapistAppointmentIds(supabase, userId) : [];

  if (role === "profissional") {
    appointmentsQuery = appointmentsQuery.eq("professional_id", userId);
    financialQuery = financialQuery.eq("professional_id", userId);
  }

  const [{ data: appointments }, { data: coTherapistAppointments }, { data: financialEntries }] = await Promise.all([
    appointmentsQuery,
    coTherapistAppointmentIds.length > 0
      ? supabase
          .from("appointments")
          .select("appointment_date, status")
          .in("id", coTherapistAppointmentIds)
          .gte("appointment_date", rangeStart)
      : Promise.resolve({ data: [] as { appointment_date: string; status: string }[] }),
    financialQuery,
  ]);

  const allAppointments = [...(appointments ?? []), ...(coTherapistAppointments ?? [])];
  const activeStatuses = ["pendente", "confirmada", "concluida"];

  return days.map((date) => {
    const dayAppointments = allAppointments.filter(
      (a) => a.appointment_date === date && activeStatuses.includes(a.status),
    ).length;
    const dayFinancial = (financialEntries ?? []).filter((f) => f.due_date === date);
    const revenuePrevista = dayFinancial
      .filter((f) => f.status === "em_aberto")
      .reduce((sum, f) => sum + f.value, 0);
    const revenueRecebida = dayFinancial
      .filter((f) => f.status === "pago")
      .reduce((sum, f) => sum + f.value, 0);

    return {
      date,
      label: WEEKDAY_SHORT[new Date(`${date}T00:00:00`).getDay()],
      appointments: dayAppointments,
      revenuePrevista,
      revenueRecebida,
    };
  });
}

export async function getPatientDashboard(userId: string) {
  const supabase = await createClient();
  const today = todayISO();

  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, appointment_date, status")
    .eq("patient_id", userId);

  const rows = appointments ?? [];
  const upcoming = rows.filter(
    (a) => a.appointment_date >= today && ["pendente", "confirmada"].includes(a.status),
  ).length;
  const completed = rows.filter((a) => a.status === "concluida").length;

  return { upcoming, completed };
}
