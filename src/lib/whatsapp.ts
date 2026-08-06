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

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cartao: "Cartão",
  pix: "PIX",
  dinheiro: "Dinheiro",
  convenio: "Convênio",
};

export function appendClinicFooter(message: string, clinicPhone?: string | null): string {
  const phoneStr = clinicPhone ? clinicPhone.trim() : "(11) 99999-9999";
  const footer = `\n\n------------------------------------\n\nEm caso de dúvidas, entre em contato com a Clínica Zoe.\n\n📞 Atendimento da Clínica Zoe:\n${phoneStr}\n\nSerá um prazer atender você!`;
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
  clinicPhone?: string | null;
}) {
  const date = dateFormatter.format(new Date(`${params.appointmentDate}T00:00:00`));
  const attendance = getAttendanceInfo(params.insuranceName, params.paymentMethod);

  let attendanceLines = `📄 Tipo de Atendimento: ${attendance.attendanceType}\n`;
  if (attendance.isConvenio) {
    attendanceLines += `🏥 Convênio: ${attendance.insuranceName}\n`;
  } else {
    attendanceLines += `💳 Forma de Pagamento: ${attendance.paymentMethodLabel}\n`;
  }

  const baseMessage = (
    `Novo agendamento (Pendente)\n` +
    `Paciente: ${params.patientName}\n` +
    `Telefone: ${params.patientPhone}\n` +
    `Especialidade: ${params.specialtyName}\n` +
    `Profissional: ${params.professionalName}\n` +
    `Data/Hora: ${date} às ${params.startTime.slice(0, 5)}\n` +
    `💰 Valor da Consulta: ${formatCurrency(params.value)}\n` +
    attendanceLines.trim()
  );
  return appendClinicFooter(baseMessage, params.clinicPhone);
}

export function buildCancellationMessage(params: {
  patientName: string;
  professionalName: string;
  appointmentDate: string;
  startTime: string;
  rescheduled: boolean;
  clinicPhone?: string | null;
}) {
  const date = dateFormatter.format(new Date(`${params.appointmentDate}T00:00:00`));
  const baseMessage = (
    `${params.rescheduled ? "Remarcação" : "Cancelamento"} de consulta\n` +
    `Paciente: ${params.patientName}\n` +
    `Profissional: ${params.professionalName}\n` +
    `Data/Hora original: ${date} às ${params.startTime.slice(0, 5)}\n` +
    `Status: ${params.rescheduled ? "paciente vai reagendar" : "cancelada pelo paciente"}`
  );
  return appendClinicFooter(baseMessage, params.clinicPhone);
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
    `Lembrete de consulta\n` +
    `Profissional: ${params.professionalName}\n` +
    `Data/Hora: ${date} às ${params.startTime.slice(0, 5)}\n` +
    `Local: ${params.clinicName}${params.clinicAddress ? " — " + params.clinicAddress : ""}`
  );
  return appendClinicFooter(baseMessage, params.clinicPhone);
}

export function buildRescheduleMessage(params: {
  patientName: string;
  professionalName: string;
  newDate: string;
  newStartTime: string;
  clinicPhone?: string | null;
}) {
  const date = dateFormatter.format(new Date(`${params.newDate}T00:00:00`));
  const baseMessage = (
    `Olá, ${params.patientName}.\n\n` +
    `Sua consulta foi reagendada.\n\n` +
    `📅 Nova data: ${date}\n` +
    `🕒 Novo horário: ${params.newStartTime.slice(0, 5)}\n` +
    `👨‍⚕️ Profissional: ${params.professionalName}\n\n` +
    `Caso tenha dúvidas, entre em contato com a Clínica Zoe.`
  );
  return appendClinicFooter(baseMessage, params.clinicPhone);
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
    `Sua consulta foi agendada com sucesso.\n\n` +
    `📅 Data: ${date}\n` +
    `🕒 Horário: ${params.startTime.slice(0, 5)}\n` +
    `👨‍⚕️ Profissional: ${params.professionalName}\n` +
    `📍 ${params.clinicName}`
  );
  return appendClinicFooter(baseMessage, params.clinicPhone);
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
    `Olá, sua solicitação de consulta não foi aprovada.\n\n` +
    `Profissional: ${params.professionalName}\n` +
    `Data/Hora solicitada: ${date} às ${params.startTime.slice(0, 5)}\n\n` +
    `Por favor, entre em contato com a ${params.clinicName} para mais informações.`
  );
  return appendClinicFooter(baseMessage, params.clinicPhone);
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
    `Olá, sua consulta foi aprovada.\n\n` +
    `Profissional: ${params.professionalName}\n` +
    `Data/Hora: ${date} às ${params.startTime.slice(0, 5)}\n` +
    `Local: ${params.clinicName}${params.clinicAddress ? " — " + params.clinicAddress : ""}\n` +
    `Valor: ${formatCurrency(params.value)}`
  );
  return appendClinicFooter(baseMessage, params.clinicPhone);
}
