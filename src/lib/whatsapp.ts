/**
 * Monta um link "clique para conversar" do WhatsApp (wa.me) com mensagem
 * pré-preenchida. Não envia nada sozinho — quem abrir o link ainda precisa
 * clicar em enviar. Sem custo, sem credenciais de API.
 */
export function buildWhatsAppLink(phone: string | null | undefined, message: string): string | null {
  if (!phone) return null;

  const digitsOnly = phone.replace(/\D/g, "");
  if (!digitsOnly) return null;

  const withCountryCode = digitsOnly.startsWith("55") ? digitsOnly : `55${digitsOnly}`;
  return `https://wa.me/${withCountryCode}?text=${encodeURIComponent(message)}`;
}

/**
 * Formata um número de telefone cru (com ou sem DDI 55) para exibição visual
 * no padrão internacional: "+55 82 XXXXX-XXXX". Se o formato não bater com o
 * padrão esperado (DDI + DDD + número), cai num fallback seguro com apenas o
 * prefixo "+" para nunca quebrar a renderização.
 */
export function formatWhatsAppDisplay(phone: string | null | undefined): string | null {
  if (!phone) return null;

  const digitsOnly = phone.replace(/\D/g, "");
  if (!digitsOnly) return null;

  const withCountryCode = digitsOnly.startsWith("55") ? digitsOnly : `55${digitsOnly}`;
  const match = withCountryCode.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  if (!match) return `+${withCountryCode}`;

  const [, ddd, part1, part2] = match;
  return `+55 ${ddd} ${part1}-${part2}`;
}

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });
const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

import { getAttendanceInfo } from "./attendance";
import type { Modality, ParticularProduct } from "./supabase/types";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cartao: "Cartão",
  pix: "PIX",
  dinheiro: "Dinheiro",
  convenio: "Convênio",
};

const DEFAULT_CLINIC_NAME = "Espaço Zoe";

export function appendClinicFooter(message: string, clinicPhone?: string | null, clinicName?: string | null): string {
  const name = clinicName?.trim() || DEFAULT_CLINIC_NAME;
  const phoneStr = clinicPhone?.trim();
  const phoneLine = phoneStr ? `\n📞 Atendimento da ${name}:\n${phoneStr}\n` : `\n📞 Atendimento da ${name}\n`;
  const footer = `\n\n------------------------------------\n\nEm caso de dúvidas, entre em contato com a ${name}.\n${phoneLine}\nSerá um prazer atender você!`;
  return `${message}${footer}`;
}

export function buildBookingMessage(params: {
  patientName: string;
  patientPhone: string;
  specialtyName: string;
  professionalName: string;
  insuranceName: string;
  appointmentDate: string;
  startTime: string;
  value: number;
  paymentMethod: string;
  modality?: Modality | null;
  particularProduct?: ParticularProduct | null;
  clinicPhone?: string | null;
  clinicName?: string | null;
}) {
  const date = dateFormatter.format(new Date(`${params.appointmentDate}T00:00:00`));
  const attendance = getAttendanceInfo(params.insuranceName, params.paymentMethod, params.modality, params.particularProduct);

  let attendanceLines = `📄 Tipo de Atendimento: ${attendance.attendanceType}\n`;
  if (attendance.isConvenio) {
    attendanceLines += `🏥 Convênio: ${attendance.insuranceName}\n`;
    if (attendance.modalityLabel) attendanceLines += `🧩 Modalidade: ${attendance.modalityLabel}\n`;
  } else {
    attendanceLines += `💳 Forma de Pagamento: ${attendance.paymentMethodLabel}\n`;
    if (attendance.particularProductLabel) attendanceLines += `📦 ${attendance.particularProductLabel}\n`;
  }

  const baseMessage = (
    `Novo agendamento (Pendente)\n` +
    `Paciente: ${params.patientName}\n` +
    `Telefone: ${params.patientPhone}\n` +
    `Especialidade: ${params.specialtyName}\n` +
    `Profissional: ${params.professionalName}\n` +
    `Data/Hora: ${date} às ${params.startTime.slice(0, 5)}\n` +
    `💰 Valor do Atendimento: ${formatCurrency(params.value)}\n` +
    attendanceLines.trim()
  );
  return appendClinicFooter(baseMessage, params.clinicPhone, params.clinicName);
}

export function buildCancellationMessage(params: {
  patientName: string;
  professionalName: string;
  appointmentDate: string;
  startTime: string;
  rescheduled: boolean;
  clinicPhone?: string | null;
  clinicName?: string | null;
}) {
  const date = dateFormatter.format(new Date(`${params.appointmentDate}T00:00:00`));
  const baseMessage = (
    `${params.rescheduled ? "Remarcação" : "Cancelamento"} de atendimento\n` +
    `Paciente: ${params.patientName}\n` +
    `Profissional: ${params.professionalName}\n` +
    `Data/Hora original: ${date} às ${params.startTime.slice(0, 5)}\n` +
    `Status: ${params.rescheduled ? "paciente vai reagendar" : "cancelado pelo paciente"}`
  );
  return appendClinicFooter(baseMessage, params.clinicPhone, params.clinicName);
}

export function buildReminderMessage(params: {
  professionalName: string;
  appointmentDate: string;
  startTime: string;
  clinicName: string;
  clinicAddress?: string | null;
  clinicPhone?: string | null;
}) {
  const date = dateFormatter.format(new Date(`${params.appointmentDate}T00:00:00`));
  const baseMessage = (
    `Lembrete de atendimento\n` +
    `Profissional: ${params.professionalName}\n` +
    `Data/Hora: ${date} às ${params.startTime.slice(0, 5)}\n` +
    `Local: ${params.clinicName}${params.clinicAddress ? " — " + params.clinicAddress : ""}`
  );
  return appendClinicFooter(baseMessage, params.clinicPhone, params.clinicName);
}

export function buildRescheduleMessage(params: {
  patientName: string;
  professionalName: string;
  newDate: string;
  newStartTime: string;
  clinicPhone?: string | null;
  clinicName?: string | null;
}) {
  const date = dateFormatter.format(new Date(`${params.newDate}T00:00:00`));
  const name = params.clinicName?.trim() || DEFAULT_CLINIC_NAME;
  const baseMessage = (
    `Olá, ${params.patientName}.\n\n` +
    `Seu atendimento foi reagendado.\n\n` +
    `📅 Nova data: ${date}\n` +
    `🕒 Novo horário: ${params.newStartTime.slice(0, 5)}\n` +
    `👨‍⚕️ Profissional: ${params.professionalName}\n\n` +
    `Caso tenha dúvidas, entre em contato com a ${name}.`
  );
  return appendClinicFooter(baseMessage, params.clinicPhone, params.clinicName);
}

/** Enviada ao paciente quando a recepção/admin cria um agendamento manual
 * pelo painel (fluxo "Novo Agendamento") — diferente de buildBookingMessage,
 * que é dirigida à clínica quando é o próprio paciente quem agenda. */
export function buildStaffBookingConfirmationMessage(params: {
  patientName: string;
  professionalName: string;
  appointmentDate: string;
  startTime: string;
  clinicName: string;
  clinicPhone?: string | null;
}) {
  const date = dateFormatter.format(new Date(`${params.appointmentDate}T00:00:00`));
  const baseMessage = (
    `Olá, ${params.patientName}.\n\n` +
    `Seu atendimento foi agendado com sucesso.\n\n` +
    `📅 Data: ${date}\n` +
    `🕒 Horário: ${params.startTime.slice(0, 5)}\n` +
    `👨‍⚕️ Profissional: ${params.professionalName}\n` +
    `📍 ${params.clinicName}`
  );
  return appendClinicFooter(baseMessage, params.clinicPhone, params.clinicName);
}

/** Enviada ao paciente quando a equipe recusa uma solicitação de agendamento
 * feita pela Área do Cliente ou pelo site público. */
export function buildRejectionMessage(params: {
  professionalName: string;
  appointmentDate: string;
  startTime: string;
  clinicName: string;
  clinicPhone?: string | null;
}) {
  const date = dateFormatter.format(new Date(`${params.appointmentDate}T00:00:00`));
  const baseMessage = (
    `Olá, sua solicitação de atendimento não foi aprovada.\n\n` +
    `Profissional: ${params.professionalName}\n` +
    `Data/Hora solicitada: ${date} às ${params.startTime.slice(0, 5)}\n\n` +
    `Por favor, entre em contato com a ${params.clinicName} para mais informações.`
  );
  return appendClinicFooter(baseMessage, params.clinicPhone, params.clinicName);
}

const WAITLIST_PERIOD_LABELS: Record<string, string> = {
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
};

const WAITLIST_DAY_LABELS: Record<number, string> = {
  0: "Domingo",
  1: "Segunda",
  2: "Terça",
  3: "Quarta",
  4: "Quinta",
  5: "Sexta",
  6: "Sábado",
};

const MODALITY_LABEL_FALLBACK: Record<Modality, string> = { aba: "ABA", comum: "Comum" };

/** Enviada à clínica quando um paciente entra na Lista de Espera (sem
 * horários compatíveis no fluxo de agendamento). */
export function buildWaitlistClinicNotificationMessage(params: {
  patientName: string;
  patientPhone: string;
  specialtyName: string;
  professionalName?: string | null;
  insuranceName: string;
  modality?: Modality | null;
  periodPreference?: string | null;
  preferredDays?: number[];
  notes?: string | null;
  clinicPhone?: string | null;
  clinicName?: string | null;
}) {
  const daysLabel = (params.preferredDays ?? [])
    .slice()
    .sort((a, b) => a - b)
    .map((d) => WAITLIST_DAY_LABELS[d] ?? String(d))
    .join(", ");

  const baseMessage = (
    `📋 NOVA SOLICITAÇÃO DE LISTA DE ESPERA\n\n` +
    `Nome: ${params.patientName}\n` +
    `Telefone: ${params.patientPhone}\n` +
    `Especialidade: ${params.specialtyName}\n` +
    `Profissional: ${params.professionalName || "Sem preferência"}\n` +
    `Convênio: ${params.insuranceName}\n` +
    `Modalidade: ${params.modality ? MODALITY_LABEL_FALLBACK[params.modality] : "—"}\n` +
    `Período preferido: ${params.periodPreference ? WAITLIST_PERIOD_LABELS[params.periodPreference] ?? params.periodPreference : "Sem preferência"}\n` +
    `Dias disponíveis: ${daysLabel || "Sem preferência"}\n` +
    `Observações: ${params.notes?.trim() || "—"}`
  );
  return appendClinicFooter(baseMessage, params.clinicPhone, params.clinicName);
}

/** Enviada ao paciente pela recepção ao clicar em "Oferecer Vaga" numa
 * entrada da Lista de Espera — mesmo padrão wa.me do restante do sistema. */
export function buildWaitlistOfferMessage(params: {
  patientName: string;
  specialtyName: string;
  appointmentDate: string;
  startTime: string;
  clinicPhone?: string | null;
  clinicName?: string | null;
}) {
  const date = dateFormatter.format(new Date(`${params.appointmentDate}T00:00:00`));
  const name = params.clinicName?.trim() || DEFAULT_CLINIC_NAME;
  const baseMessage = (
    `Olá, ${params.patientName}!\n\n` +
    `Surgiu uma vaga na ${name} para a especialidade de ${params.specialtyName}.\n\n` +
    `Data: ${date}\n` +
    `Horário: ${params.startTime.slice(0, 5)}\n\n` +
    `Caso tenha interesse, responda esta mensagem para confirmarmos seu agendamento.\n\n` +
    `Qualquer dúvida, estamos à disposição.\n\n` +
    `Atenciosamente,\nEquipe ${name}`
  );
  return appendClinicFooter(baseMessage, params.clinicPhone, params.clinicName);
}

export function buildConfirmationMessage(params: {
  professionalName: string;
  appointmentDate: string;
  startTime: string;
  clinicName: string;
  clinicAddress?: string | null;
  value: number;
  clinicPhone?: string | null;
}) {
  const date = dateFormatter.format(new Date(`${params.appointmentDate}T00:00:00`));
  const baseMessage = (
    `Olá, seu atendimento foi aprovado.\n\n` +
    `Profissional: ${params.professionalName}\n` +
    `Data/Hora: ${date} às ${params.startTime.slice(0, 5)}\n` +
    `Local: ${params.clinicName}${params.clinicAddress ? " — " + params.clinicAddress : ""}\n` +
    `Valor: ${formatCurrency(params.value)}`
  );
  return appendClinicFooter(baseMessage, params.clinicPhone, params.clinicName);
}
