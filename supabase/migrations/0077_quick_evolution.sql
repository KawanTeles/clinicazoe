-- Etapa 77: "Evolução Rápida" — um único campo de resumo (falado ou
-- digitado) + IA gera o rascunho da evolução, que o profissional revisa e
-- assina. Substitui o fluxo padrão de preencher campo a campo (que continua
-- disponível como "Modo detalhado").
--
-- Duas mudanças de schema, nenhuma delas afeta evoluções já existentes:
--
--   1) patient_evolutions.raw_summary_input: guarda o resumo bruto original
--      (o texto que o profissional ditou/digitou, antes da IA), como trilha
--      de auditoria LGPD. Mesma visibilidade e mesma imutabilidade do resto
--      da evolução — nenhuma policy nova é necessária: já roda sob a RLS de
--      patient_evolutions (select por vínculo ao paciente, Etapa 69; sem
--      policy de update para nenhum papel desde a mesma etapa). Null para
--      evoluções registradas pelo Modo detalhado (não passam por IA) e para
--      todo o histórico anterior a esta migração.
--
--   2) ai_settings.quick_evolution_enabled: toggle do admin, mesmo padrão de
--      transcription_enabled (Etapa 46) — recurso novo, desligado por
--      padrão até o admin habilitar explicitamente.

alter table public.patient_evolutions
  add column raw_summary_input text;

alter table public.ai_settings
  add column quick_evolution_enabled boolean not null default false;
