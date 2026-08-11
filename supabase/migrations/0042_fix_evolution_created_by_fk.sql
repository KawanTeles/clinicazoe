-- Etapa 42: corrige contradição de schema em patient_evolutions.created_by
-- (0025_patient_evolutions.sql) — a coluna é NOT NULL, mas a FK estava
-- ON DELETE SET NULL. Isso passou despercebido até apagar de verdade um
-- profile que já tivesse criado uma evolução (achado ao limpar dados de
-- teste da Etapa 41): o Postgres tenta UPDATE created_by = NULL antes de
-- cascatear o delete e a própria coluna barra com "violates not-null
-- constraint" — o profile fica preso, sem poder ser removido.
--
-- Decisão: ON DELETE RESTRICT em vez de remover o NOT NULL. Evolução
-- clínica é histórico permanente (sem policy de delete desde a 0025) e a
-- autoria precisa continuar sempre rastreável — perder o created_by ao
-- apagar o profile abriria uma exceção nesse princípio. Na prática, um
-- profissional/admin que já registrou evolução não pode mais ser apagado
-- via hard-delete; o caminho correto continua sendo status = 'inactive'
-- (já suportado em profiles e professionals).

alter table public.patient_evolutions
  drop constraint patient_evolutions_created_by_fkey;

alter table public.patient_evolutions
  add constraint patient_evolutions_created_by_fkey
  foreign key (created_by) references public.profiles (id) on delete restrict;
