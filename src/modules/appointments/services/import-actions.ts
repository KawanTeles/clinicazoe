"use server";

import { getCurrentUser, requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/modules/team/services/audit";
import { insuranceRequiresModality, PARTICULAR_INSURANCE_NAME } from "@/lib/constants";
import { resolveAppointmentValue } from "./booking-queries";
import { isPatientConflictError, isSlotFullError } from "./booking-errors";
import type { AppointmentStatus, Modality, ParticularProduct, PaymentMethod } from "@/lib/supabase/types";

async function requireStaff() {
  const session = await getCurrentUser();
  if (!session || !["admin", "recepcionista"].includes(session.profile.role)) {
    throw new Error("Acesso negado.");
  }
  return session;
}

/** Uma linha crua, exatamente como chega da planilha (todos os campos como
 * texto — a validação/conversão de tipo acontece em resolveImportRow). Os
 * nomes de coluna esperados (cabeçalho do CSV, minúsculo) são:
 * telefone_paciente, profissional, data, hora, duracao_minutos (opcional),
 * convenio (opcional, vazio = Particular), modalidade (aba/comum, obrigatório
 * se o convênio exigir), produto_particular (consulta/pacote, obrigatório se
 * Particular), forma_pagamento (opcional), valor (opcional), pago (sim/nao,
 * opcional), status (opcional: confirmada/concluida/faltou/
 * faltou_justificada/cancelada), observacoes (opcional). */
export interface ImportRowInput {
  rowNumber: number;
  telefone_paciente?: string;
  profissional?: string;
  data?: string;
  hora?: string;
  duracao_minutos?: string;
  convenio?: string;
  modalidade?: string;
  produto_particular?: string;
  forma_pagamento?: string;
  valor?: string;
  pago?: string;
  status?: string;
  observacoes?: string;
}

export interface ValidatedImportRow {
  rowNumber: number;
  ok: boolean;
  errors: string[];
  raw: ImportRowInput;
  resolved?: {
    patientId: string;
    patientName: string;
    professionalId: string;
    professionalName: string;
    insuranceId: string;
    insuranceName: string;
    scheduleSlotId: string;
    appointmentDate: string;
    startTime: string;
    endTime: string;
    paymentMethod: PaymentMethod;
    modality: Modality | null;
    particularProduct: ParticularProduct | null;
    value: number | null;
    paid: boolean;
    status: AppointmentStatus;
    notes: string | null;
  };
}

const VALID_STATUSES: AppointmentStatus[] = [
  "confirmada",
  "concluida",
  "faltou",
  "faltou_justificada",
  "cancelada",
];
const VALID_PAYMENT_METHODS: PaymentMethod[] = ["cartao", "pix", "dinheiro", "convenio"];
const ACTIVE_STATUSES_FOR_CONFLICT: AppointmentStatus[] = ["pendente", "confirmada", "concluida", "faltou", "faltou_justificada"];

function onlyDigits(value: string | undefined | null): string {
  return (value ?? "").replace(/\D/g, "");
}

// Troca por extenso em vez de depender de um range de unicode pra "marcas
// diacríticas combinantes" (frágil de digitar/revisar) — cobre os acentos
// que de fato aparecem em nomes em português.
const ACCENTED_CHARS: Record<string, string> = {
  á: "a", à: "a", â: "a", ã: "a", ä: "a",
  é: "e", è: "e", ê: "e", ë: "e",
  í: "i", ì: "i", î: "i", ï: "i",
  ó: "o", ò: "o", ô: "o", õ: "o", ö: "o",
  ú: "u", ù: "u", û: "u", ü: "u",
  ç: "c", ñ: "n",
};

function normalizeName(value: string | undefined | null): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .split("")
    .map((char) => ACCENTED_CHARS[char] ?? char)
    .join("")
    .replace(/\s+/g, " ");
}

/** "25/12/2025" -> "2025-12-25". Retorna null se o formato não bater. */
function parseDateBr(value: string | undefined): string | null {
  const match = (value ?? "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, d, m, y] = match;
  const day = Number(d);
  const month = Number(m);
  const year = Number(y);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  // Confere que a data é real (ex.: rejeita 31/02/2025) construindo-a e comparando de volta.
  const date = new Date(`${iso}T00:00:00`);
  if (date.getFullYear() !== year || date.getMonth() + 1 !== month || date.getDate() !== day) return null;
  return iso;
}

/** "14:30" ou "14:30:00" -> "14:30:00". Retorna null se o formato não bater. */
function parseTimeBr(value: string | undefined): string | null {
  const match = (value ?? "").trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const [, h, m, s] = match;
  const hour = Number(h);
  const minute = Number(m);
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${s ?? "00"}`;
}

function addMinutesToTime(startTime: string, minutes: number): string {
  const [h, m, s] = startTime.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const endH = Math.floor(total / 60) % 24;
  const endM = total % 60;
  return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}:${String(s ?? 0).padStart(2, "0")}`;
}

interface ImportContext {
  patientsByPhone: Map<string, { id: string; fullName: string }>;
  professionalsByName: Map<string, { id: string; fullName: string }>;
  insurancesByName: Map<string, { id: string; name: string }>;
  particularInsuranceId: string | null;
}

async function buildImportContext(): Promise<ImportContext> {
  const admin = createAdminClient();

  const [{ data: patients }, { data: professionals }, { data: insurances }] = await Promise.all([
    admin.from("profiles").select("id, full_name, phone").eq("role", "paciente"),
    admin.from("profiles").select("id, full_name").eq("role", "profissional").eq("status", "active"),
    admin.from("insurances").select("id, name"),
  ]);

  const patientsByPhone = new Map<string, { id: string; fullName: string }>();
  for (const p of patients ?? []) {
    const phone = onlyDigits(p.phone);
    if (phone) patientsByPhone.set(phone, { id: p.id, fullName: p.full_name });
  }

  const professionalsByName = new Map<string, { id: string; fullName: string }>();
  for (const p of professionals ?? []) {
    professionalsByName.set(normalizeName(p.full_name), { id: p.id, fullName: p.full_name });
  }

  const insurancesByName = new Map<string, { id: string; name: string }>();
  let particularInsuranceId: string | null = null;
  for (const i of insurances ?? []) {
    insurancesByName.set(normalizeName(i.name), { id: i.id, name: i.name });
    if (i.name === PARTICULAR_INSURANCE_NAME) particularInsuranceId = i.id;
  }

  return { patientsByPhone, professionalsByName, insurancesByName, particularInsuranceId };
}

/** Resolve e valida uma linha da planilha contra o contexto já carregado
 * (pacientes/profissionais/convênios) — não grava nada, só checa se a linha
 * TEM COMO ser lançada. Checagem de conflito de horário é lida diretamente
 * do banco (appointments ativos) + das próprias linhas já resolvidas deste
 * mesmo lote (occupiedSlots), porque duas linhas do mesmo arquivo podem
 * disputar o mesmo horário sem nenhuma delas existir ainda no banco. */
async function resolveImportRow(
  raw: ImportRowInput,
  context: ImportContext,
  occupiedSlots: Map<string, number>,
  admin: ReturnType<typeof createAdminClient>,
): Promise<ValidatedImportRow> {
  const errors: string[] = [];

  const phone = onlyDigits(raw.telefone_paciente);
  const patient = phone ? context.patientsByPhone.get(phone) : undefined;
  if (!phone) errors.push("Telefone do paciente não informado.");
  else if (!patient) errors.push(`Nenhum paciente cadastrado com o telefone "${raw.telefone_paciente}".`);

  const professionalName = normalizeName(raw.profissional);
  const professional = professionalName ? context.professionalsByName.get(professionalName) : undefined;
  if (!raw.profissional?.trim()) errors.push("Profissional não informado.");
  else if (!professional) errors.push(`Nenhum profissional ativo chamado "${raw.profissional}".`);

  const appointmentDate = parseDateBr(raw.data);
  if (!appointmentDate) errors.push(`Data inválida: "${raw.data ?? ""}" (use DD/MM/AAAA).`);

  const startTime = parseTimeBr(raw.hora);
  if (!startTime) errors.push(`Hora inválida: "${raw.hora ?? ""}" (use HH:MM).`);

  const insuranceName = raw.convenio?.trim() ? normalizeName(raw.convenio) : normalizeName(PARTICULAR_INSURANCE_NAME);
  const insurance = context.insurancesByName.get(insuranceName);
  if (!insurance) errors.push(`Convênio "${raw.convenio}" não encontrado.`);

  const requiresModality = insurance ? insuranceRequiresModality(insurance.name) : false;
  let modality: Modality | null = null;
  let particularProduct: ParticularProduct | null = null;

  if (requiresModality) {
    const m = raw.modalidade?.trim().toLowerCase();
    if (m !== "aba" && m !== "comum") {
      errors.push(`Modalidade inválida para convênio "${insurance?.name}": "${raw.modalidade ?? ""}" (use aba ou comum).`);
    } else {
      modality = m;
    }
  } else if (insurance) {
    const p = raw.produto_particular?.trim().toLowerCase();
    if (p !== "consulta" && p !== "pacote") {
      errors.push(`Produto particular inválido: "${raw.produto_particular ?? ""}" (use consulta ou pacote).`);
    } else {
      particularProduct = p;
    }
  }

  let paymentMethod: PaymentMethod | null = null;
  const rawPayment = raw.forma_pagamento?.trim().toLowerCase();
  if (rawPayment) {
    if (!VALID_PAYMENT_METHODS.includes(rawPayment as PaymentMethod)) {
      errors.push(`Forma de pagamento inválida: "${raw.forma_pagamento}" (use cartao, pix, dinheiro ou convenio).`);
    } else {
      paymentMethod = rawPayment as PaymentMethod;
    }
  } else {
    paymentMethod = requiresModality ? "convenio" : null;
    if (!paymentMethod) errors.push("Forma de pagamento não informada (obrigatória para atendimento particular).");
  }

  let value: number | null = null;
  const rawValue = raw.valor?.trim().replace(",", ".");
  if (rawValue) {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed < 0) {
      errors.push(`Valor inválido: "${raw.valor}".`);
    } else {
      value = parsed;
    }
  } else if (professional && insurance) {
    const pricing = await resolveAppointmentValue(professional.id, insurance.id, modality ?? undefined, particularProduct ?? undefined);
    value = pricing.value;
  }

  const paidRaw = raw.pago?.trim().toLowerCase();
  const paid = paidRaw === "sim" || paidRaw === "true" || paidRaw === "1";

  let status: AppointmentStatus;
  const rawStatus = raw.status?.trim().toLowerCase();
  if (rawStatus) {
    if (!VALID_STATUSES.includes(rawStatus as AppointmentStatus)) {
      errors.push(`Status inválido: "${raw.status}" (use confirmada, concluida, faltou, faltou_justificada ou cancelada).`);
      status = "confirmada";
    } else {
      status = rawStatus as AppointmentStatus;
    }
  } else {
    const todayIso = new Date().toISOString().slice(0, 10);
    status = appointmentDate && appointmentDate < todayIso ? "concluida" : "confirmada";
  }

  let scheduleSlotId: string | null = null;
  let endTime: string | null = null;
  const durationOverride = raw.duracao_minutos?.trim() ? Number(raw.duracao_minutos) : null;

  if (professional && appointmentDate && startTime) {
    const dayOfWeek = new Date(`${appointmentDate}T00:00:00`).getDay();
    // schedule_slots representa a JANELA de trabalho do dia (ex.: 08:00–17:00
    // em UMA linha só), não um horário discreto por linha — os horários
    // realmente agendáveis dentro dela são calculados em tempo real
    // (generateSlotInstances, em getAvailableTimes/getMonthAvailability).
    // Pra achar a janela certa de um horário específico, o horário pedido
    // precisa CAIR dentro dela (start_time <= pedido < end_time), não bater
    // exatamente com o start_time da janela.
    const { data: slots } = await admin
      .from("schedule_slots")
      .select("id, end_time, capacity")
      .eq("professional_id", professional.id)
      .eq("day_of_week", dayOfWeek)
      .lte("start_time", startTime)
      .gt("end_time", startTime)
      .limit(1);
    const slot = slots?.[0] ?? null;

    if (!slot) {
      errors.push(
        `Não existe horário cadastrado na grade de ${professional.fullName} para esse dia da semana e hora (verifique em Horários).`,
      );
    } else {
      scheduleSlotId = slot.id;
      endTime =
        durationOverride && Number.isFinite(durationOverride) && durationOverride > 0
          ? addMinutesToTime(startTime, durationOverride)
          : slot.end_time;

      if (status !== "cancelada") {
        const slotKey = `${professional.id}|${appointmentDate}|${startTime}`;
        const alreadyInThisBatch = occupiedSlots.get(slotKey) ?? 0;

        const { count: existingCount } = await admin
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("professional_id", professional.id)
          .eq("appointment_date", appointmentDate)
          .eq("start_time", startTime)
          .in("status", ACTIVE_STATUSES_FOR_CONFLICT);

        if ((existingCount ?? 0) + alreadyInThisBatch >= slot.capacity) {
          errors.push(
            `Horário sem vaga: ${professional.fullName} já tem ${(existingCount ?? 0) + alreadyInThisBatch} atendimento(s) ativo(s) em ${raw.data} às ${raw.hora} (capacidade ${slot.capacity}).`,
          );
        } else {
          occupiedSlots.set(slotKey, alreadyInThisBatch + 1);
        }

        if (patient) {
          const { count: patientConflictCount } = await admin
            .from("appointments")
            .select("id", { count: "exact", head: true })
            .eq("patient_id", patient.id)
            .eq("appointment_date", appointmentDate)
            .eq("start_time", startTime)
            .in("status", ACTIVE_STATUSES_FOR_CONFLICT);

          if ((patientConflictCount ?? 0) > 0) {
            errors.push(`${patient.fullName} já tem outro atendimento ativo em ${raw.data} às ${raw.hora}.`);
          }
        }
      }
    }
  }

  if (errors.length > 0 || !patient || !professional || !insurance || !appointmentDate || !startTime || !paymentMethod || !scheduleSlotId || !endTime) {
    return { rowNumber: raw.rowNumber, ok: false, errors, raw };
  }

  return {
    rowNumber: raw.rowNumber,
    ok: true,
    errors: [],
    raw,
    resolved: {
      patientId: patient.id,
      patientName: patient.fullName,
      professionalId: professional.id,
      professionalName: professional.fullName,
      insuranceId: insurance.id,
      insuranceName: insurance.name,
      scheduleSlotId,
      appointmentDate,
      startTime,
      endTime,
      paymentMethod,
      modality,
      particularProduct,
      value,
      paid,
      status,
      notes: raw.observacoes?.trim() || null,
    },
  };
}

/** Lê e valida todas as linhas da planilha — não grava nada no banco. Chame
 * isso pra montar a pré-visualização; a confirmação (confirmImportBatch)
 * recebe exatamente a lista de ValidatedImportRow que o usuário revisou. */
export async function previewImportRows(rawRows: ImportRowInput[]): Promise<{ rows: ValidatedImportRow[]; error: string | null }> {
  await requireStaff();

  if (rawRows.length === 0) return { rows: [], error: "A planilha não tem nenhuma linha de dados." };
  if (rawRows.length > 500) return { rows: [], error: "Máximo de 500 linhas por importação — divida em arquivos menores." };

  const admin = createAdminClient();
  const context = await buildImportContext();
  const occupiedSlots = new Map<string, number>();

  const rows: ValidatedImportRow[] = [];
  for (const raw of rawRows) {
    rows.push(await resolveImportRow(raw, context, occupiedSlots, admin));
  }

  return { rows, error: null };
}

/** Grava só as linhas marcadas como `ok` dentre as que o usuário revisou na
 * pré-visualização — linhas com erro ficam de fora, sem travar o resto do
 * lote. Cada linha passa pelo mesmo lock atômico (book_appointment) do
 * agendamento normal, então uma corrida entre a pré-visualização e a
 * confirmação (ex.: o horário foi ocupado por outra via nesse intervalo)
 * ainda é pega aqui — vira falha pontual daquela linha, reportada em
 * `failures`, sem derrubar o lote inteiro. */
export async function confirmImportBatch(
  rows: ValidatedImportRow[],
  label: string,
): Promise<{ batchId: string | null; successCount: number; failures: { rowNumber: number; error: string }[]; error: string | null }> {
  const session = await requireStaff();

  const rateLimit = checkRateLimit(`import-batch:${session.user.id}`, 5, 60_000);
  if (!rateLimit.allowed) {
    return { batchId: null, successCount: 0, failures: [], error: `Muitas tentativas. Aguarde ${rateLimit.retryAfterSeconds}s e tente de novo.` };
  }

  const validRows = rows.filter((r) => r.ok && r.resolved);
  if (validRows.length === 0) {
    return { batchId: null, successCount: 0, failures: [], error: "Nenhuma linha válida pra importar." };
  }

  const admin = createAdminClient();
  // UPDATE em appointments (abaixo, pra gravar observações) passa pela
  // trigger prevent_appointment_tampering, que decide com base em
  // auth.uid()/is_admin() — funções que só enxergam a sessão autenticada.
  // Via service role (admin) essas funções voltam null e a trigger cai no
  // branch errado (bloqueia achando que é o paciente tentando mexer fora do
  // permitido). O client de sessão abaixo resolve is_admin()/current_role()
  // corretamente porque carrega o cookie do staff autenticado.
  const sessionClient = await createClient();

  const { data: batch, error: batchError } = await admin
    .from("appointment_import_batches")
    .insert({ label: label.trim() || "Importação sem nome", row_count: validRows.length, created_by: session.user.id })
    .select("id")
    .single();

  if (batchError || !batch) {
    return { batchId: null, successCount: 0, failures: [], error: "Não foi possível criar o lote de importação." };
  }

  const failures: { rowNumber: number; error: string }[] = [];
  let successCount = 0;

  for (const row of validRows) {
    const r = row.resolved!;
    const { data: appointment, error } = await admin.rpc("book_appointment", {
      p_patient_id: r.patientId,
      p_professional_id: r.professionalId,
      p_specialty_id: null,
      p_insurance_id: r.insuranceId,
      p_schedule_slot_id: r.scheduleSlotId,
      p_appointment_date: r.appointmentDate,
      p_start_time: r.startTime,
      p_end_time: r.endTime,
      p_payment_method: r.paymentMethod,
      p_value: r.value,
      p_modality: r.modality,
      p_particular_product: r.particularProduct,
      p_source: "importado",
      p_status: r.status,
      p_import_batch_id: batch.id,
    });

    if (error || !appointment) {
      const message = isSlotFullError(error)
        ? "Horário ficou sem vaga entre a pré-visualização e a confirmação."
        : isPatientConflictError(error)
          ? "Paciente passou a ter outro atendimento no mesmo horário entre a pré-visualização e a confirmação."
          : "Falha ao gravar esta linha.";
      failures.push({ rowNumber: row.rowNumber, error: message });
      continue;
    }

    if (r.notes) {
      await sessionClient.from("appointments").update({ notes: r.notes }).eq("id", appointment.id);
    }

    if (r.value != null) {
      await admin.from("financial_entries").insert({
        appointment_id: appointment.id,
        patient_id: r.patientId,
        professional_id: r.professionalId,
        insurance_id: r.insuranceId,
        value: r.value,
        payment_method: r.paymentMethod,
        modality: r.modality,
        particular_product: r.particularProduct,
        due_date: r.appointmentDate,
        status: r.paid ? "pago" : "em_aberto",
        paid_at: r.paid ? new Date().toISOString() : null,
      });
    }

    successCount++;
  }

  if (successCount === 0) {
    await admin.from("appointment_import_batches").delete().eq("id", batch.id);
  } else if (successCount !== validRows.length) {
    await admin.from("appointment_import_batches").update({ row_count: successCount }).eq("id", batch.id);
  }

  await logAudit({
    actorId: session.user.id,
    action: "appointment.import_batch_created",
    entity: "appointment_import_batches",
    entityId: batch.id,
    metadata: { label, attempted: validRows.length, successCount, failureCount: failures.length },
  });

  return { batchId: successCount > 0 ? batch.id : null, successCount, failures, error: null };
}

/** Desfaz um lote inteiro — exige admin (ação destrutiva em massa, acima do
 * que recepcionista pode fazer em outras telas). Bloqueia se qualquer
 * atendimento do lote já tiver evolução clínica registrada ou lançamento
 * financeiro pago: nesses casos a remoção em massa arriscaria apagar
 * histórico clínico/financeiro real sem revisão — o admin precisa cancelar
 * essas linhas manualmente, uma a uma, pela tela normal de Atendimentos. */
export async function undoImportBatch(batchId: string): Promise<{ error: string | null }> {
  const session = await requireAdmin();
  const admin = createAdminClient();

  const { data: batch } = await admin
    .from("appointment_import_batches")
    .select("id, undone_at")
    .eq("id", batchId)
    .maybeSingle();

  if (!batch) return { error: "Lote não encontrado." };
  if (batch.undone_at) return { error: "Este lote já foi desfeito." };

  const { data: appointments } = await admin.from("appointments").select("id").eq("import_batch_id", batchId);
  const appointmentIds = (appointments ?? []).map((a) => a.id);

  if (appointmentIds.length === 0) {
    await admin.from("appointment_import_batches").update({ undone_at: new Date().toISOString(), undone_by: session.user.id }).eq("id", batchId);
    return { error: null };
  }

  const { count: evolutionsCount } = await admin
    .from("patient_evolutions")
    .select("id", { count: "exact", head: true })
    .in("appointment_id", appointmentIds);

  if ((evolutionsCount ?? 0) > 0) {
    return {
      error: `${evolutionsCount} atendimento(s) deste lote já têm evolução clínica registrada — cancele-os manualmente em Atendimentos antes de desfazer o lote.`,
    };
  }

  const { count: paidCount } = await admin
    .from("financial_entries")
    .select("id", { count: "exact", head: true })
    .in("appointment_id", appointmentIds)
    .eq("status", "pago");

  if ((paidCount ?? 0) > 0) {
    return {
      error: `${paidCount} atendimento(s) deste lote já têm lançamento financeiro marcado como pago — ajuste-os manualmente antes de desfazer o lote.`,
    };
  }

  await admin.from("financial_entries").delete().in("appointment_id", appointmentIds);
  await admin.from("appointments").delete().in("id", appointmentIds);
  await admin
    .from("appointment_import_batches")
    .update({ undone_at: new Date().toISOString(), undone_by: session.user.id })
    .eq("id", batchId);

  await logAudit({
    actorId: session.user.id,
    action: "appointment.import_batch_undone",
    entity: "appointment_import_batches",
    entityId: batchId,
    metadata: { appointmentCount: appointmentIds.length },
  });

  return { error: null };
}

export interface ImportBatchView {
  id: string;
  label: string;
  rowCount: number;
  createdByName: string;
  createdAt: string;
  undoneAt: string | null;
}

export async function listImportBatches(): Promise<ImportBatchView[]> {
  await requireStaff();
  const admin = createAdminClient();

  const { data: batches } = await admin
    .from("appointment_import_batches")
    .select("id, label, row_count, created_by, created_at, undone_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (!batches || batches.length === 0) return [];

  const creatorIds = Array.from(new Set(batches.map((b) => b.created_by)));
  const { data: creators } = await admin.from("profiles").select("id, full_name").in("id", creatorIds);
  const creatorById = new Map((creators ?? []).map((c) => [c.id, c.full_name]));

  return batches.map((b) => ({
    id: b.id,
    label: b.label,
    rowCount: b.row_count,
    createdByName: creatorById.get(b.created_by) ?? "—",
    createdAt: b.created_at,
    undoneAt: b.undone_at,
  }));
}

export interface CreateImportedAppointmentFromIdsInput {
  patientId: string;
  professionalId: string;
  professionalName: string;
  insuranceId: string;
  insuranceName: string;
  date: string;
  startTime: string;
  durationMinutes?: number | null;
  modality?: Modality | null;
  particularProduct?: ParticularProduct | null;
  paymentMethod: PaymentMethod;
  value?: number | null;
  paid?: boolean;
  status: AppointmentStatus;
  notes?: string | null;
}

/** Mesma coisa que createImportedAppointment, mas a partir de IDs já
 * resolvidos (usado pelo formulário "Lançar atendimento já existente", que
 * tem o paciente/profissional/convênio escolhidos por picker, não por texto
 * de planilha) — evita depender de telefone/nome pra casar o registro
 * quando a UI já tem certeza de qual paciente/profissional é. */
export async function createImportedAppointmentFromIds(
  input: CreateImportedAppointmentFromIdsInput,
): Promise<{ error: string | null; appointmentId?: string }> {
  const session = await requireStaff();

  const rateLimit = checkRateLimit(`import-avulso:${session.user.id}`, 20, 60_000);
  if (!rateLimit.allowed) {
    return { error: `Muitas tentativas. Aguarde ${rateLimit.retryAfterSeconds}s e tente de novo.` };
  }

  const admin = createAdminClient();

  const requiresModality = insuranceRequiresModality(input.insuranceName);
  if (requiresModality && !input.modality) return { error: "Selecione a modalidade." };
  if (!requiresModality && !input.particularProduct) return { error: "Selecione o produto particular." };

  const dayOfWeek = new Date(`${input.date}T00:00:00`).getDay();
  // Mesmo cuidado de resolveImportRow (import-actions.ts): schedule_slots é a
  // janela de trabalho (ex.: 08:00–17:00), não um horário discreto — o
  // horário pedido precisa cair dentro da janela, não bater com o start_time
  // dela.
  const requestedTime = `${input.startTime}:00`;
  const { data: slots } = await admin
    .from("schedule_slots")
    .select("id, end_time, capacity")
    .eq("professional_id", input.professionalId)
    .eq("day_of_week", dayOfWeek)
    .lte("start_time", requestedTime)
    .gt("end_time", requestedTime)
    .limit(1);
  const slot = slots?.[0] ?? null;

  if (!slot) {
    return {
      error: `Não existe horário cadastrado na grade de ${input.professionalName} para esse dia da semana e hora (verifique em Horários).`,
    };
  }

  const startTime = `${input.startTime}:00`;
  const endTime =
    input.durationMinutes && input.durationMinutes > 0 ? addMinutesToTime(startTime, input.durationMinutes) : slot.end_time;

  if (input.status !== "cancelada") {
    const { count: existingCount } = await admin
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("professional_id", input.professionalId)
      .eq("appointment_date", input.date)
      .eq("start_time", startTime)
      .in("status", ACTIVE_STATUSES_FOR_CONFLICT);

    if ((existingCount ?? 0) >= slot.capacity) {
      return { error: `Horário sem vaga: ${input.professionalName} já está no limite de capacidade nesse dia e hora.` };
    }

    const { count: patientConflictCount } = await admin
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", input.patientId)
      .eq("appointment_date", input.date)
      .eq("start_time", startTime)
      .in("status", ACTIVE_STATUSES_FOR_CONFLICT);

    if ((patientConflictCount ?? 0) > 0) {
      return { error: "Este paciente já tem outro atendimento ativo nesse dia e hora." };
    }
  }

  // Ao contrário de resolveImportRow (planilha, sem prévia visual de preço),
  // este caminho é usado pelo formulário — que já auto-preenche o campo
  // Valor com o preço da tabela assim que acha um (useEffect no client). Se
  // chegou vazio aqui é porque o usuário apagou de propósito: respeita como
  // pendente, não resolve de novo no servidor (isso ignoraria a decisão
  // deliberada de deixar sem valor mesmo havendo preço cadastrado).
  const value = input.value ?? null;

  const { data: appointment, error } = await admin.rpc("book_appointment", {
    p_patient_id: input.patientId,
    p_professional_id: input.professionalId,
    p_specialty_id: null,
    p_insurance_id: input.insuranceId,
    p_schedule_slot_id: slot.id,
    p_appointment_date: input.date,
    p_start_time: startTime,
    p_end_time: endTime,
    p_payment_method: input.paymentMethod,
    p_value: value,
    p_modality: input.modality ?? null,
    p_particular_product: input.particularProduct ?? null,
    p_source: "importado",
    p_status: input.status,
  });

  if (error || !appointment) {
    if (isSlotFullError(error)) return { error: "Esse horário acabou de ser ocupado. Tente novamente." };
    if (isPatientConflictError(error)) return { error: "Este paciente já tem outro atendimento marcado nesse horário." };
    return { error: "Não foi possível lançar este atendimento." };
  }

  if (input.notes) {
    // Via sessão autenticada (não admin/service role) — ver comentário
    // equivalente em confirmImportBatch sobre a trigger prevent_appointment_tampering.
    const sessionClient = await createClient();
    await sessionClient.from("appointments").update({ notes: input.notes }).eq("id", appointment.id);
  }

  if (value != null) {
    await admin.from("financial_entries").insert({
      appointment_id: appointment.id,
      patient_id: input.patientId,
      professional_id: input.professionalId,
      insurance_id: input.insuranceId,
      value,
      payment_method: input.paymentMethod,
      modality: input.modality ?? null,
      particular_product: input.particularProduct ?? null,
      due_date: input.date,
      status: input.paid ? "pago" : "em_aberto",
      paid_at: input.paid ? new Date().toISOString() : null,
    });
  }

  await logAudit({
    actorId: session.user.id,
    action: "appointment.imported",
    entity: "appointments",
    entityId: appointment.id,
    metadata: { professionalId: input.professionalId, date: input.date, startTime },
  });

  return { error: null, appointmentId: appointment.id };
}
