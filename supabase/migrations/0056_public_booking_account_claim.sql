-- Suporte ao agendamento público sem login (claimPublicPatientAccount).
--
-- password_pending: true SOMENTE para os usuários Auth criados pelo próprio
-- fluxo público (createPublicAppointment), que nascem sem senha. É o que
-- autoriza claimPublicPatientAccount a definir uma senha sem sessão — sem
-- essa flag, qualquer patientId (inclusive contas antigas com senha própria,
-- que têm o default `false`) poderia ter a senha sobrescrita por quem
-- soubesse o telefone do paciente. Default `false` cobre todo paciente já
-- existente (autocadastro, Google, ou cadastrado pela recepção) sem precisar
-- de backfill.
-- account_claimed_at: marca quando o claim foi concluído, pra impedir
-- reclaim duplicado. Não altera nenhuma policy existente — as duas colunas
-- só são lidas/escritas via service role.

alter table public.profiles
  add column account_claimed_at timestamptz null default null,
  add column password_pending boolean not null default false;
