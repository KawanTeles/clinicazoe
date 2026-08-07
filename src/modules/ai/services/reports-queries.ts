import { createClient } from "@/lib/supabase/server";
import type { ReportTemplate } from "./provider-types";

export interface AIReportListItem {
  id: string;
  patientId: string;
  patientName: string;
  professionalName: string;
  template: ReportTemplate;
  title: string;
  status: "draft" | "finalized";
  createdAt: string;
}

export interface AIReportDetail extends AIReportListItem {
  professionalId: string;
  periodStart: string | null;
  periodEnd: string | null;
  evolutionIds: string[];
  content: string;
  updatedAt: string;
}

async function namesById(supabase: Awaited<ReturnType<typeof createClient>>, ids: string[]) {
  if (ids.length === 0) return new Map<string, string>();
  const { data } = await supabase.from("profiles").select("id, full_name").in("id", ids);
  return new Map((data ?? []).map((p) => [p.id, p.full_name]));
}

/** RLS já resolve o escopo: profissional vê só as próprias, admin vê todas. */
export async function listAIReports(): Promise<AIReportListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_reports")
    .select("id, patient_id, professional_id, template, title, status, created_at")
    .order("created_at", { ascending: false });

  const rows = data ?? [];
  const peopleIds = Array.from(new Set(rows.flatMap((r) => [r.patient_id, r.professional_id])));
  const names = await namesById(supabase, peopleIds);

  return rows.map((row) => ({
    id: row.id,
    patientId: row.patient_id,
    patientName: names.get(row.patient_id) ?? "Paciente",
    professionalName: names.get(row.professional_id) ?? "Profissional",
    template: row.template as ReportTemplate,
    title: row.title,
    status: row.status as "draft" | "finalized",
    createdAt: row.created_at,
  }));
}

export async function getAIReport(id: string): Promise<AIReportDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("ai_reports").select("*").eq("id", id).maybeSingle();
  if (!data) return null;

  const names = await namesById(supabase, [data.patient_id, data.professional_id]);

  return {
    id: data.id,
    patientId: data.patient_id,
    patientName: names.get(data.patient_id) ?? "Paciente",
    professionalId: data.professional_id,
    professionalName: names.get(data.professional_id) ?? "Profissional",
    template: data.template as ReportTemplate,
    periodStart: data.period_start,
    periodEnd: data.period_end,
    evolutionIds: data.evolution_ids,
    title: data.title,
    content: data.content,
    status: data.status as "draft" | "finalized",
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}
