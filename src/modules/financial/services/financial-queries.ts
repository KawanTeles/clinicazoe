import { createClient } from "@/lib/supabase/server";
import type { Database, Role } from "@/lib/supabase/types";

type FinancialEntryRow = Database["public"]["Tables"]["financial_entries"]["Row"];

export interface FinancialEntryView {
  id: string;
  patientName: string;
  professionalName: string;
  insuranceName: string;
  value: number;
  paymentMethod: string;
  dueDate: string;
  status: string;
  paidAt: string | null;
  paidByName: string | null;
  hasProof: boolean;
  isOverdue: boolean;
}

const PAGE_SIZE = 20;

export async function getFinancialEntries(
  role: Role,
  userId: string,
  page = 1,
): Promise<{ items: FinancialEntryView[]; totalPages: number }> {
  const supabase = await createClient();

  let query = supabase
    .from("financial_entries")
    .select("*", { count: "exact" })
    .neq("status", "cancelado")
    .order("due_date", { ascending: false });

  if (role === "profissional") {
    query = query.eq("professional_id", userId);
  }

  const from = (page - 1) * PAGE_SIZE;
  const { data, count } = await query.range(from, from + PAGE_SIZE - 1);
  const rows: FinancialEntryRow[] = data ?? [];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  if (rows.length === 0) return { items: [], totalPages };

  const patientIds = Array.from(new Set(rows.map((r) => r.patient_id)));
  const professionalIds = Array.from(new Set(rows.map((r) => r.professional_id)));
  const insuranceIds = Array.from(
    new Set(rows.map((r) => r.insurance_id).filter((id): id is string => Boolean(id))),
  );
  const paidByIds = Array.from(new Set(rows.map((r) => r.paid_by).filter((id): id is string => Boolean(id))));

  const [{ data: patients }, { data: professionals }, { data: insurances }, { data: paidByProfiles }] =
    await Promise.all([
      supabase.from("profiles").select("id, full_name").in("id", patientIds),
      supabase.from("profiles").select("id, full_name").in("id", professionalIds),
      insuranceIds.length > 0
        ? supabase.from("insurances").select("id, name").in("id", insuranceIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      paidByIds.length > 0
        ? supabase.from("profiles").select("id, full_name").in("id", paidByIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    ]);

  const patientById = new Map((patients ?? []).map((p) => [p.id, p.full_name]));
  const professionalById = new Map((professionals ?? []).map((p) => [p.id, p.full_name]));
  const insuranceById = new Map((insurances ?? []).map((i) => [i.id, i.name]));
  const paidByNameById = new Map((paidByProfiles ?? []).map((p) => [p.id, p.full_name]));
  const todayIso = new Date().toISOString().slice(0, 10);

  const items = rows.map((row) => ({
    id: row.id,
    patientName: patientById.get(row.patient_id) ?? "Paciente",
    professionalName: professionalById.get(row.professional_id) ?? "Profissional",
    insuranceName: row.insurance_id ? insuranceById.get(row.insurance_id) ?? "" : "",
    value: row.value,
    paymentMethod: row.payment_method,
    dueDate: row.due_date,
    status: row.status,
    paidAt: row.paid_at,
    paidByName: row.paid_by ? paidByNameById.get(row.paid_by) ?? null : null,
    hasProof: Boolean(row.payment_proof_path),
    isOverdue: row.status === "em_aberto" && row.due_date < todayIso,
  }));

  return { items, totalPages };
}

export async function getFinancialSummary(role: Role, userId: string) {
  const supabase = await createClient();

  let query = supabase.from("financial_entries").select("value, status, due_date").neq("status", "cancelado");
  if (role === "profissional") {
    query = query.eq("professional_id", userId);
  }

  const { data } = await query;
  const rows = data ?? [];
  const todayIso = new Date().toISOString().slice(0, 10);

  const emAberto = rows.filter((r) => r.status === "em_aberto").reduce((sum, r) => sum + r.value, 0);
  const pago = rows.filter((r) => r.status === "pago").reduce((sum, r) => sum + r.value, 0);
  const atrasado = rows
    .filter((r) => r.status === "em_aberto" && r.due_date < todayIso)
    .reduce((sum, r) => sum + r.value, 0);

  return { emAberto, pago, atrasado };
}
