-- Permite agendar um atendimento sem valor definido ("pendente"), pedido do
-- cliente (Parte 2): hoje appointments.value é NOT NULL, então a equipe é
-- obrigada a escolher/calcular um valor na hora de agendar mesmo quando o
-- profissional ainda não tem preço cadastrado para aquele convênio/modalidade
-- (ou produto particular). A aplicação (booking-actions.ts,
-- recurrence-actions.ts) passa a aceitar value = null nesses casos só nos
-- fluxos de equipe (createAppointmentForPatient, createGroupAppointment,
-- createRecurringAppointments e variantes) — o autoagendamento do paciente
-- (createAppointment, público ou logado) continua exigindo valor calculável,
-- não muda aqui.
--
-- financial_entries.value continua NOT NULL de propósito: o lançamento
-- financeiro só é criado quando o valor existe (confirmAppointment, em
-- booking-actions.ts, pula a criação enquanto appointment.value for null, e
-- updateAppointmentValue cria o lançamento retroativamente quando alguém
-- definir o valor depois). Isso é o que garante que um atendimento pendente
-- de valor fica automaticamente fora dos totais do financeiro, sem precisar
-- de um status novo nem de filtro extra nas telas existentes.
alter table public.appointments
  alter column value drop not null;
