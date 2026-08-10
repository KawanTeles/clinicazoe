-- Etapa 34: índices identificados na auditoria de performance — consultas
-- por paciente e por status em appointments/financial_entries cresciam sem
-- índice dedicado (só existia professional_id+date em appointments e
-- professional_id isolado em financial_entries). Aditivo, sem alterar dado
-- nem comportamento.

create index appointments_patient_idx on public.appointments (patient_id);
create index appointments_status_idx on public.appointments (status);

create index financial_entries_patient_idx on public.financial_entries (patient_id);
create index financial_entries_status_idx on public.financial_entries (status);
create index financial_entries_due_date_idx on public.financial_entries (due_date);
