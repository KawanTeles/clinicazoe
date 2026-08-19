-- Etapa 53: permite cancelar/ocultar um lançamento manual do Financeiro sem
-- apagá-lo de verdade (auditoria financeira exige manter o registro) — mesmo
-- princípio de "inativar" já usado em profiles/specialties/insurances, agora
-- aplicado a financial_transactions.status, que hoje só aceita
-- 'em_aberto'/'pago' (migration 0044, constraint
-- financial_transactions_status_check, nome confirmado via pg_constraint
-- antes de alterar).

alter table public.financial_transactions
  drop constraint financial_transactions_status_check;

alter table public.financial_transactions
  add constraint financial_transactions_status_check
  check (status in ('em_aberto', 'pago', 'cancelado'));
