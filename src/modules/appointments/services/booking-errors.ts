/** Helpers puros de classificação de erro do book_appointment() RPC
 * (migrações 0066/0067) — extraídos de booking-queries.ts porque aquele
 * arquivo tem "use server" no topo, e o Next.js exige que TODA função
 * exportada de um arquivo "use server" seja async (é tratada como Server
 * Action); estas duas são só checagem de string, nunca chamadas do client
 * diretamente, então vivem aqui como funções síncronas normais. */

/** Mensagem levantada por public.book_appointment() (migração 0066) quando o
 * slot já está no limite de capacity no momento do INSERT — a checagem
 * fica atômica dentro da função (lock por profissional+data+horário), então
 * isso só acontece nos casos raros de corrida que a pré-checagem da
 * aplicação (getAvailableTimes, chamada antes do RPC) não pegou. Usado
 * pelos 3 pontos de criação de agendamento (createAppointment,
 * createAppointmentForPatient, createPublicAppointment) pra traduzir o erro
 * do banco numa mensagem amigável em vez de deixar estourar o texto cru do
 * Postgres. */
export function isSlotFullError(error: { message?: string } | null): boolean {
  return error?.message?.includes("SLOT_FULL") ?? false;
}

/** Mensagem levantada por public.book_appointment() (migração 0067) quando o
 * paciente já tem outro atendimento ativo no mesmo horário fora da mesma
 * sessão conjugada. */
export function isPatientConflictError(error: { message?: string } | null): boolean {
  return error?.message?.includes("PATIENT_CONFLICT") ?? false;
}
