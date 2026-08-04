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

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });
const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cartao: "Cartão",
  pix: "PIX",
  dinheiro: "Dinheiro",
  convenio: "Convênio",
};

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
}) {
  const date = dateFormatter.format(new Date(`${params.appointmentDate}T00:00:00`));
  return (
    `Novo agendamento (Pendente)\n` +
    `Paciente: ${params.patientName}\n` +
    `Telefone: ${params.patientPhone}\n` +
    `Especialidade: ${params.specialtyName}\n` +
    `Profissional: ${params.professionalName}\n` +
    `Convênio: ${params.insuranceName}\n` +
    `Data/Hora: ${date} às ${params.startTime.slice(0, 5)}\n` +
    `Valor: ${formatCurrency(params.value)}\n` +
    `Forma de pagamento: ${PAYMENT_METHOD_LABELS[params.paymentMethod] ?? params.paymentMethod}`
  );
}

export function buildCancellationMessage(params: {
  patientName: string;
  professionalName: string;
  appointmentDate: string;
  startTime: string;
  rescheduled: boolean;
}) {
  const date = dateFormatter.format(new Date(`${params.appointmentDate}T00:00:00`));
  return (
    `${params.rescheduled ? "Remarcação" : "Cancelamento"} de consulta\n` +
    `Paciente: ${params.patientName}\n` +
    `Profissional: ${params.professionalName}\n` +
    `Data/Hora original: ${date} às ${params.startTime.slice(0, 5)}\n` +
    `Status: ${params.rescheduled ? "paciente vai reagendar" : "cancelada pelo paciente"}`
  );
}

export function buildReminderMessage(params: {
  professionalName: string;
  appointmentDate: string;
  startTime: string;
  clinicName: string;
  clinicAddress?: string | null;
}) {
  const date = dateFormatter.format(new Date(`${params.appointmentDate}T00:00:00`));
  return (
    `Lembrete de consulta\n` +
    `Profissional: ${params.professionalName}\n` +
    `Data/Hora: ${date} às ${params.startTime.slice(0, 5)}\n` +
    `Local: ${params.clinicName}${params.clinicAddress ? " — " + params.clinicAddress : ""}`
  );
}

export function buildConfirmationMessage(params: {
  professionalName: string;
  appointmentDate: string;
  startTime: string;
  clinicName: string;
  clinicAddress?: string | null;
  value: number;
}) {
  const date = dateFormatter.format(new Date(`${params.appointmentDate}T00:00:00`));
  return (
    `Consulta confirmada!\n` +
    `Profissional: ${params.professionalName}\n` +
    `Data/Hora: ${date} às ${params.startTime.slice(0, 5)}\n` +
    `Local: ${params.clinicName}${params.clinicAddress ? " — " + params.clinicAddress : ""}\n` +
    `Valor: ${formatCurrency(params.value)}`
  );
}
