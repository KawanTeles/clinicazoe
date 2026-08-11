-- Etapa 48: fecha o Achado Crítico C1 da varredura de segurança — profiles/
-- professionals têm policy de DELETE liberada para admin desde a Etapa 1,
-- mas as tabelas de histórico clínico/financeiro referenciam patient_id/
-- professional_id com "on delete cascade". As Etapas 42/43 já haviam
-- blindado a coluna created_by (NOT NULL não pode ter "set null"), mas
-- nunca a coluna-sujeito do próprio registro — então excluir um profile ou
-- professional ainda apagava em cascata prontuário e financeiro inteiros,
-- furando exatamente o princípio de "histórico permanente" que o restante
-- do projeto já respeita (patient_evolutions/ai_reports/financial_* nunca
-- tiveram policy de delete de propósito).
--
-- Nomes de constraint confirmados via information_schema antes de escrever
-- esta migration (mesmo método da Etapa 42/43) — nenhum nome foi assumido.
--
-- Efeito prático: excluir de verdade (DELETE, via admin.auth.admin.deleteUser)
-- um profissional ou paciente só continua funcionando se ele nunca teve
-- nenhum registro nas tabelas abaixo. Caso contrário, a exclusão falha com
-- violação de constraint — o caminho correto passa a ser sempre desativar
-- (status = 'inactive'), igual ao resto do sistema já faz.
--
-- Fora do escopo: waitlist_entries.professional_id continua "on delete set
-- null" — é nullable (profissional de preferência, opcional), não é o
-- mesmo problema de NOT NULL+cascade das demais. notifications.user_id
-- também fica de fora, de propósito (ver comentário mais abaixo, antes das
-- tabelas de patient_evolution_versions em diante).

alter table public.ai_reports
  drop constraint ai_reports_patient_id_fkey,
  drop constraint ai_reports_professional_id_fkey;
alter table public.ai_reports
  add constraint ai_reports_patient_id_fkey
    foreign key (patient_id) references public.profiles (id) on delete restrict,
  add constraint ai_reports_professional_id_fkey
    foreign key (professional_id) references public.professionals (id) on delete restrict;

alter table public.appointment_series
  drop constraint appointment_series_patient_id_fkey,
  drop constraint appointment_series_professional_id_fkey;
alter table public.appointment_series
  add constraint appointment_series_patient_id_fkey
    foreign key (patient_id) references public.profiles (id) on delete restrict,
  add constraint appointment_series_professional_id_fkey
    foreign key (professional_id) references public.professionals (id) on delete restrict;

alter table public.appointments
  drop constraint appointments_patient_id_fkey,
  drop constraint appointments_professional_id_fkey;
alter table public.appointments
  add constraint appointments_patient_id_fkey
    foreign key (patient_id) references public.profiles (id) on delete restrict,
  add constraint appointments_professional_id_fkey
    foreign key (professional_id) references public.professionals (id) on delete restrict;

alter table public.clinical_documents
  drop constraint clinical_documents_patient_id_fkey,
  drop constraint clinical_documents_professional_id_fkey;
alter table public.clinical_documents
  add constraint clinical_documents_patient_id_fkey
    foreign key (patient_id) references public.profiles (id) on delete restrict,
  add constraint clinical_documents_professional_id_fkey
    foreign key (professional_id) references public.professionals (id) on delete restrict;

alter table public.financial_entries
  drop constraint financial_entries_patient_id_fkey,
  drop constraint financial_entries_professional_id_fkey;
alter table public.financial_entries
  add constraint financial_entries_patient_id_fkey
    foreign key (patient_id) references public.profiles (id) on delete restrict,
  add constraint financial_entries_professional_id_fkey
    foreign key (professional_id) references public.professionals (id) on delete restrict;

-- notifications.user_id fica de fora de propósito (decisão confirmada):
-- notify()/notifyStaff() gravam uma linha para TODO admin/recepcionista
-- ativo a cada evento de agendamento — notificação é alerta efêmero de UI,
-- não histórico clínico/financeiro, e restringir aqui bloquearia excluir
-- quase qualquer conta de staff ativa sem relação com o risco que esta
-- migration resolve. Continua "on delete cascade" como sempre foi.

alter table public.patient_evolution_versions
  drop constraint patient_evolution_versions_professional_id_fkey;
alter table public.patient_evolution_versions
  add constraint patient_evolution_versions_professional_id_fkey
    foreign key (professional_id) references public.professionals (id) on delete restrict;

alter table public.patient_evolutions
  drop constraint patient_evolutions_patient_id_fkey,
  drop constraint patient_evolutions_professional_id_fkey;
alter table public.patient_evolutions
  add constraint patient_evolutions_patient_id_fkey
    foreign key (patient_id) references public.profiles (id) on delete restrict,
  add constraint patient_evolutions_professional_id_fkey
    foreign key (professional_id) references public.professionals (id) on delete restrict;

alter table public.patient_messages
  drop constraint patient_messages_patient_id_fkey;
alter table public.patient_messages
  add constraint patient_messages_patient_id_fkey
    foreign key (patient_id) references public.profiles (id) on delete restrict;

alter table public.session_transcriptions
  drop constraint session_transcriptions_patient_id_fkey,
  drop constraint session_transcriptions_professional_id_fkey;
alter table public.session_transcriptions
  add constraint session_transcriptions_patient_id_fkey
    foreign key (patient_id) references public.profiles (id) on delete restrict,
  add constraint session_transcriptions_professional_id_fkey
    foreign key (professional_id) references public.professionals (id) on delete restrict;

alter table public.waitlist_entries
  drop constraint waitlist_entries_patient_id_fkey;
alter table public.waitlist_entries
  add constraint waitlist_entries_patient_id_fkey
    foreign key (patient_id) references public.profiles (id) on delete restrict;
