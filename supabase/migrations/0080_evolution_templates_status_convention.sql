-- Etapa 80: corrige o status de evolution_templates para a convenção do
-- projeto.
--
-- A 0079 criou a coluna com check (status in ('active', 'archived')). Está
-- errado: TODA tabela deste banco usa ('active', 'inactive') — profiles,
-- professionals, insurances, specialties, schedule_slots, schedule_blocks — e
-- o tipo TypeScript compartilhado `Status` (src/lib/supabase/types.ts) é
-- exatamente "active" | "inactive". Um valor fora dessa dupla obrigaria um tipo
-- só para esta tabela e, pior, faria `archiveEvolutionTemplate` gravar um valor
-- que a check recusa — erro que só apareceria no primeiro arquivamento real.
--
-- Nenhuma linha usa 'archived' ainda (a 0079 subiu há minutos e o único modelo
-- existente é o padrão de fábrica, que é 'active' e protegido contra
-- arquivamento), então a troca é segura e não precisa de UPDATE de dados.

alter table public.evolution_templates drop constraint evolution_templates_status_check;
alter table public.evolution_templates add constraint evolution_templates_status_check
  check (status in ('active', 'inactive'));
