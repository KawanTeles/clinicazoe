"use server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  buildWaitlistClinicNotificationMessage,
  buildWaitlistOfferMessage,
  buildWhatsAppLink,
} from "@/lib/whatsapp";
import { logAudit } from "@/modules/team/services/audit";
import { notifyStaff } from "@/modules/notifications/services/notify";
import { checkRateLimit } from "@/lib/rate-limit";
import { findCompatibleWaitlistEntries } from "./waitlist-queries";
import type { Modality, WaitlistPeriod } from "@/lib/supabase/types";

async function requirePatient() {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "paciente") {
    throw new Error("Acesso negado.");
  }
  return session;
}

async function requireStaff() {
  const session = await getCurrentUser();
  if (!session || !["admin", "recepcionista"].includes(session.profile.role)) {
    throw new Error("Acesso negado.");
  }
  return session;
}

export interface CreateWaitlistEntryInput {
  specialtyId: string;
  professionalId?: string;
  insuranceId: string;
  modality?: Modality;
  periodPreference?: WaitlistPeriod;
  preferredDays: number[];
  notes?: string;
  patientName: string;
  patientPhone: string;
  patientEmail?: string;
}

export async function createWaitlistEntry(
  input: CreateWaitlistEntryInput,
): Promise<{ error: string | null; whatsappLink?: string | null }> {
  const session = await requirePatient();

  const rateLimit = checkRateLimit(`waitlist:${session.user.id}`, 5, 60_000);
  if (!rateLimit.allowed) {
    return { error: `Muitas tentativas. Aguarde ${rateLimit.retryAfterSeconds}s e tente de novo.` };
  }

  const supabase = await createClient();

  const { data: entry, error } = await supabase
    .from("waitlist_entries")
    .insert({
      patient_id: session.user.id,
      patient_name: input.patientName,
      patient_phone: input.patientPhone,
      patient_email: input.patientEmail ?? null,
      specialty_id: input.specialtyId,
      professional_id: input.professionalId ?? null,
      insurance_id: input.insuranceId,
      modality: input.modality ?? null,
      period_preference: input.periodPreference ?? null,
      preferred_days: input.preferredDays,
      notes: input.notes ?? null,
      status: "aguardando",
    })
    .select("id")
    .single();

  if (error || !entry) {
    return { error: "Não foi possível registrar sua solicitação. Tente novamente." };
  }

  await logAudit({
    actorId: session.user.id,
    action: "waitlist.created",
    entity: "waitlist_entries",
    entityId: entry.id,
  });

  const [{ data: specialty }, { data: professionalProfile }, { data: insurance }, { data: clinic }] =
    await Promise.all([
      supabase.from("specialties").select("name").eq("id", input.specialtyId).single(),
      input.professionalId
        ? supabase.from("profiles").select("full_name").eq("id", input.professionalId).single()
        : Promise.resolve({ data: null as { full_name: string } | null }),
      supabase.from("insurances").select("name").eq("id", input.insuranceId).single(),
      supabase.from("clinic_settings").select("whatsapp_number").eq("id", 1).single(),
    ]);

  const message = buildWaitlistClinicNotificationMessage({
    patientName: input.patientName,
    patientPhone: input.patientPhone,
    specialtyName: specialty?.name ?? "",
    professionalName: professionalProfile?.full_name ?? null,
    insuranceName: insurance?.name ?? "",
    modality: input.modality,
    periodPreference: input.periodPreference,
    preferredDays: input.preferredDays,
    notes: input.notes,
  });

  const whatsappLink = buildWhatsAppLink(clinic?.whatsapp_number, message);

  await notifyStaff({
    type: "waitlist.created",
    title: "Nova solicitação na Lista de Espera",
    message: `${input.patientName} entrou na Lista de Espera para ${specialty?.name ?? "uma especialidade"}.`,
    entity: "waitlist_entries",
    entityId: entry.id,
  });

  return { error: null, whatsappLink };
}

/** Chamada ao abrir a página /waitlist: marca as entradas "aguardando" ainda
 * não vistas como vistas, o que zera o badge vermelho da sidebar sem alterar
 * o status/fila de atendimento em si. */
export async function markWaitlistAsSeen(): Promise<void> {
  const session = await getCurrentUser();
  if (!session || !["admin", "recepcionista"].includes(session.profile.role)) return;

  const supabase = await createClient();
  await supabase
    .from("waitlist_entries")
    .update({ viewed_at: new Date().toISOString() })
    .eq("status", "aguardando")
    .is("viewed_at", null);
}

export async function markContacted(id: string): Promise<{ error: string | null }> {
  const session = await requireStaff();
  const supabase = await createClient();

  // .select().maybeSingle() detecta bloqueio silencioso (RLS ou o próprio
  // .eq("status", "aguardando") — ex.: dois atendentes marcando a mesma
  // entrada ao mesmo tempo): sem isso, 0 linhas afetadas ainda retorna
  // error: null e a action reportaria sucesso do que não aconteceu (mesmo
  // padrão já corrigido em markAsPaid, financial-actions.ts).
  const { data: updated, error } = await supabase
    .from("waitlist_entries")
    .update({ status: "contato_realizado", contacted_by: session.user.id, contacted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "aguardando")
    .select("id")
    .maybeSingle();

  if (error) return { error: "Não foi possível atualizar o registro." };
  if (!updated) return { error: "Registro não encontrado, sem permissão, ou o status já mudou." };

  await logAudit({ actorId: session.user.id, action: "waitlist.contacted", entity: "waitlist_entries", entityId: id });
  return { error: null };
}

export async function offerSlot(
  id: string,
  input: { date: string; startTime: string },
): Promise<{ error: string | null; whatsappLink?: string | null }> {
  const session = await requireStaff();
  const supabase = await createClient();

  const { data: entry } = await supabase.from("waitlist_entries").select("*").eq("id", id).single();
  if (!entry) return { error: "Registro não encontrado." };

  const { data: updated, error } = await supabase
    .from("waitlist_entries")
    .update({ status: "vaga_oferecida", offered_at: new Date().toISOString() })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) return { error: "Não foi possível registrar a oferta de vaga." };
  if (!updated) return { error: "Registro não encontrado ou você não tem permissão para alterá-lo." };

  await logAudit({ actorId: session.user.id, action: "waitlist.offered", entity: "waitlist_entries", entityId: id });

  const [{ data: specialty }, { data: clinic }] = await Promise.all([
    supabase.from("specialties").select("name").eq("id", entry.specialty_id).single(),
    supabase.from("clinic_settings").select("whatsapp_number").eq("id", 1).single(),
  ]);

  const message = buildWaitlistOfferMessage({
    patientName: entry.patient_name,
    specialtyName: specialty?.name ?? "",
    appointmentDate: input.date,
    startTime: input.startTime,
    clinicPhone: clinic?.whatsapp_number,
  });

  const whatsappLink = buildWhatsAppLink(entry.patient_phone, message);

  return { error: null, whatsappLink };
}

export async function markNoInterest(id: string): Promise<{ error: string | null }> {
  const session = await requireStaff();
  const supabase = await createClient();

  const { data: updated, error } = await supabase
    .from("waitlist_entries")
    .update({ status: "sem_interesse", declined_at: new Date().toISOString() })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) return { error: "Não foi possível atualizar o registro." };
  if (!updated) return { error: "Registro não encontrado ou você não tem permissão para alterá-lo." };

  await logAudit({ actorId: session.user.id, action: "waitlist.no_interest", entity: "waitlist_entries", entityId: id });
  return { error: null };
}

export async function cancelWaitlistEntry(id: string): Promise<{ error: string | null }> {
  const session = await requireStaff();
  const supabase = await createClient();

  const { data: updated, error } = await supabase
    .from("waitlist_entries")
    .update({ status: "cancelado" })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return { error: "Não foi possível cancelar o registro." };
  if (!updated) return { error: "Registro não encontrado ou você não tem permissão para cancelá-lo." };

  await logAudit({ actorId: session.user.id, action: "waitlist.cancelled", entity: "waitlist_entries", entityId: id });
  return { error: null };
}

/** Chamada ao concluir o agendamento iniciado a partir de uma entrada da
 * Lista de Espera — marca como "agendado" e vincula o appointment criado.
 * Não deleta a linha: ela só some da visão padrão por deixar de ser
 * 'aguardando', mesmo espírito do módulo Solicitações. */
export async function convertWaitlistToAppointment(
  id: string,
  appointmentId: string,
): Promise<{ error: string | null }> {
  const session = await requireStaff();
  const supabase = await createClient();

  const { data: updated, error } = await supabase
    .from("waitlist_entries")
    .update({ status: "agendado", accepted_at: new Date().toISOString(), appointment_id: appointmentId })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) return { error: "Não foi possível vincular o agendamento à Lista de Espera." };
  if (!updated) return { error: "Registro não encontrado ou você não tem permissão para alterá-lo." };

  await logAudit({
    actorId: session.user.id,
    action: "waitlist.converted",
    entity: "waitlist_entries",
    entityId: id,
    metadata: { appointmentId },
  });

  return { error: null };
}

/** Chamada a partir do cancelamento de uma consulta (booking-actions.ts):
 * avisa a equipe caso haja alguém compatível esperando pela vaga liberada. */
export async function notifyWaitlistMatches(params: {
  specialtyId: string | null;
  professionalId: string;
  insuranceId: string;
  modality: Modality | null;
  appointmentDate: string;
  startTime: string;
}): Promise<void> {
  const matches = await findCompatibleWaitlistEntries({
    specialtyId: params.specialtyId,
    professionalId: params.professionalId,
    insuranceId: params.insuranceId,
    modality: params.modality,
  });

  if (matches.length === 0) return;

  await notifyStaff({
    type: "waitlist.match",
    title: "Vaga compatível com a Lista de Espera",
    message: `Existe um paciente na Lista de Espera compatível com a vaga disponível em ${params.appointmentDate} às ${params.startTime.slice(0, 5)}. Ver Pacientes.`,
    entity: "waitlist_entries",
    entityId: matches[0].id,
  });
}
