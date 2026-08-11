-- Etapa 43: mesma correção da 0042, aplicada a ai_reports.created_by
-- (0029_ai_reports_and_assistant.sql) — mesma contradição de schema (coluna
-- NOT NULL com FK ON DELETE SET NULL), achada ao varrer o schema inteiro
-- atrás de outras ocorrências do mesmo padrão logo depois de corrigir a
-- 0042. É a única outra ocorrência no banco (conferido em todas as
-- migrations: nenhuma outra coluna NOT NULL tem FK ON DELETE SET NULL).
--
-- Mesma decisão da 0042: ON DELETE RESTRICT em vez de remover o NOT NULL.
-- Relatório de IA também é prontuário (sigilo profissional, 0031) — a
-- autoria precisa continuar sempre rastreável. Um profissional/admin que já
-- gerou relatório não pode mais ser apagado via hard-delete; o caminho
-- correto é status = 'inactive'.

alter table public.ai_reports
  drop constraint ai_reports_created_by_fkey;

alter table public.ai_reports
  add constraint ai_reports_created_by_fkey
  foreign key (created_by) references public.profiles (id) on delete restrict;
