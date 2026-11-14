import "server-only";

import { createClient } from "@/lib/supabase/server";

export type TrackingStatus = "concluida" | "em_rascunho" | "pendente" | "atrasada";

export interface TrackingRow {
  appointmentId: string;
  professionalId: string;
  professionalName: string;
  patientId: string;
  patientName: string;
  specialtyId: string | null;
  specialtyName: string | null;
  appointmentDate: string;
  startTime: string;
  status: TrackingStatus;
}

export interface TrackingFilters {
  dateFrom?: string;
  dateTo?: string;
  professionalId?: string;
  specialtyId?: string;
}

export interface TrackingResult {
  rows: TrackingRow[];
  lateAfterHours: number;
  counts: Record<string, { concluida: number; emRascunho: number; pendente: number; atrasada: number }>;
}

/**
 * Carrega o status de evolução por atendimento para a tela de Acompanhamento.
 *
 * O trabalho pesado — cruzar `patient_evolutions`/`evolution_drafts`, que a
 * Coordenação não tem policy nenhuma para ler direto — acontece dentro da
 * função SECURITY DEFINER `get_evolution_tracking` (Etapa 81). Aqui só se
 * calcula "pendente" vs. "atrasada": a função devolve só "pendente" (porque o
 * prazo é configurável e pode mudar sem nova migration), e este código separa
 * os dois usando `evolution_tracking_settings.late_after_hours`.
 */
export async function getEvolutionTracking(filters: TrackingFilters = {}): Promise<TrackingResult> {
  const supabase = await createClient();

  const [{ data: settings }, { data: rows, error }] = await Promise.all([
    supabase.from("evolution_tracking_settings").select("late_after_hours").eq("id", 1).maybeSingle(),
    supabase.rpc("get_evolution_tracking", {
      p_date_from: filters.dateFrom ?? null,
      p_date_to: filters.dateTo ?? null,
      p_professional_id: filters.professionalId ?? null,
      p_specialty_id: filters.specialtyId ?? null,
    }),
  ]);

  const lateAfterHours = settings?.late_after_hours ?? 48;

  if (error || !rows) {
    // Erro mais comum aqui: chamador sem is_admin()/is_coordinator() — a
    // função recusa com exceção, não com lista vazia. Não deveria acontecer
    // (a página já verifica a permissão antes), mas não derruba a tela.
    return { rows: [], lateAfterHours, counts: {} };
  }

  const agora = Date.now();
  const limiteMs = lateAfterHours * 60 * 60 * 1000;

  const tracking: TrackingRow[] = rows.map((r) => {
    let status: TrackingStatus = r.status;
    if (status === "pendente") {
      // Mesma ausência de fuso horário explícito do resto do projeto (ver
      // dashboard-queries.ts, todayISO()) — não introduz uma convenção nova
      // que o resto do app não tem.
      const fimDoAtendimento = new Date(`${r.appointment_date}T${r.end_time}`).getTime();
      if (agora - fimDoAtendimento > limiteMs) status = "atrasada";
    }
    return {
      appointmentId: r.appointment_id,
      professionalId: r.professional_id,
      professionalName: r.professional_name,
      patientId: r.patient_id,
      patientName: r.patient_name,
      specialtyId: r.specialty_id,
      specialtyName: r.specialty_name,
      appointmentDate: r.appointment_date,
      startTime: r.start_time,
      status,
    };
  });

  const counts: TrackingResult["counts"] = {};
  for (const row of tracking) {
    const bucket = (counts[row.professionalId] ??= { concluida: 0, emRascunho: 0, pendente: 0, atrasada: 0 });
    if (row.status === "concluida") bucket.concluida += 1;
    else if (row.status === "em_rascunho") bucket.emRascunho += 1;
    else if (row.status === "atrasada") bucket.atrasada += 1;
    else bucket.pendente += 1;
  }

  tracking.sort((a, b) => (a.appointmentDate === b.appointmentDate ? 0 : a.appointmentDate < b.appointmentDate ? 1 : -1));

  return { rows: tracking, lateAfterHours, counts };
}

export interface TrackingProfessionalOption {
  id: string;
  name: string;
}

/** Lista de profissionais para o filtro — mesmo conjunto que a tela de
 * Equipe considera "corpo clínico" (ativo), não exige a Coordenação ter
 * acesso a professionals além do que já tem via RLS (select liberado a
 * qualquer autenticado ativo desde a 0007/0052). */
export async function getProfessionalOptions(): Promise<TrackingProfessionalOption[]> {
  const supabase = await createClient();

  const { data: professionals } = await supabase.from("professionals").select("id").eq("status", "active");
  const ids = (professionals ?? []).map((p) => p.id);
  if (ids.length === 0) return [];

  const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", ids);

  return (profiles ?? [])
    .map((p) => ({ id: p.id, name: p.full_name }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
