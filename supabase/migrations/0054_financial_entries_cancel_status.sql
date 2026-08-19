-- Etapa 54: cancelar um atendimento confirmado deixava o financial_entries
-- vinculado orfao em 'em_aberto' para sempre (nada sincronizava os dois) —
-- mesmo principio da etapa 53 (financial_transactions), agora aplicado a
-- financial_entries.status, que hoje so aceita 'em_aberto'/'pago'
-- (migration 0010, constraint financial_entries_status_check, nome
-- confirmado via pg_constraint antes de alterar).

alter table public.financial_entries
  drop constraint financial_entries_status_check;

alter table public.financial_entries
  add constraint financial_entries_status_check
  check (status in ('em_aberto', 'pago', 'cancelado'));
