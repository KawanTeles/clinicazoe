-- Fase 4 das correções pós-auditoria: completa F9 (modelos de avaliação) e
-- F10 (programas terapêuticos/ABA).
--
-- F9 — pontuação/faixas de interpretação, publicar (só modelo publicado
-- fica disponível pra aplicar), e fila "Pedidos de IA" para criação de
-- protocolo em segundo plano. Mantém o que já funcionava: imutabilidade de
-- patient_protocol_assessments (0086, sem policy de update/delete) e
-- versionamento (bump automático ao mudar itens).
--
-- F10 — critério de domínio estruturado (campos numéricos), pra o sistema
-- comparar com os registros e avisar quando for atingido. O texto livre já
-- cadastrado (mastery_criteria) NÃO é tocado — continua existindo e
-- funcionando como "observação" sempre que não houver critério estruturado,
-- ou junto dele.

-- ---------------------------------------------------------------------------
-- 0) Avaliação aplicada: pontuação total + rótulo de interpretação
--    CONGELADOS no momento da assinatura (mesmo princípio de
--    professional_name_snapshot em patient_evolutions) — mudar a pontuação
--    dos itens ou as faixas do protocolo depois NUNCA reescreve o resultado
--    de uma avaliação já respondida. A pontuação por subescala não é
--    congelada à parte: é recalculada na tela a partir de
--    responses[].point_value (também congelado, ver comentário mais abaixo
--    no tipo ProtocolAssessmentResponse em supabase/types.ts), então nunca
--    muda mesmo sem uma coluna própria.
-- ---------------------------------------------------------------------------
alter table public.patient_protocol_assessments
  add column total_score numeric,
  add column interpretation_label text;

comment on column public.patient_protocol_assessments.total_score is
  'Pontuação total calculada e congelada no momento de submitProtocolAssessment. Null em avaliações salvas antes de existir pontuação (F9) ou em protocolos sem scoring_enabled.';
comment on column public.patient_protocol_assessments.interpretation_label is
  'Rótulo da faixa de interpretação que bateu com total_score, congelado no momento da assinatura — nunca recalculado contra as faixas atuais do protocolo.';

-- ---------------------------------------------------------------------------
-- 1) Protocolos: publicar (draft -> disponível) + pontuação.
-- ---------------------------------------------------------------------------
alter table public.protocol_templates
  add column published_at timestamptz,
  add column scoring_enabled boolean not null default false;

comment on column public.protocol_templates.published_at is
  'Null = rascunho, só visível/editável por quem gerencia. Preenchido = publicado, disponível para aplicar em pacientes (getAvailableProtocolTemplates passa a exigir published_at is not null, além de status=active).';

alter table public.protocol_items
  add column point_value numeric not null default 1 check (point_value >= 0);

comment on column public.protocol_items.point_value is
  'Pontos somados quando o item é marcado como atingido (achieved=true) — só importa quando protocol_templates.scoring_enabled é true. Default 1 preserva o comportamento antigo (contagem simples) sem precisar de migração de dado.';

-- ---------------------------------------------------------------------------
-- 2) Faixas de interpretação — por subescala (domain preenchido) ou pela
--    pontuação TOTAL (domain null). Several faixas por modelo, sem
--    sobreposição verificada em banco (confiança na tela do construtor,
--    mesmo nível de confiança que o resto do construtor manual já tem).
-- ---------------------------------------------------------------------------
create table public.protocol_interpretation_bands (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.protocol_templates (id) on delete cascade,
  domain text,
  min_score numeric not null,
  max_score numeric not null,
  label text not null,
  description text,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  check (max_score >= min_score)
);

alter table public.protocol_interpretation_bands enable row level security;

create index protocol_interpretation_bands_template_idx
  on public.protocol_interpretation_bands (template_id, domain);

-- Mesmo nível de abertura de protocol_items_select (0086): item/faixa de
-- protocolo não é conteúdo clínico de paciente, é definição de modelo — só
-- a aplicação a um paciente (patient_protocol_assessments) é sigilosa.
create policy "protocol_interpretation_bands_select"
  on public.protocol_interpretation_bands for select
  to authenticated
  using (exists (select 1 from public.protocol_templates t where t.id = protocol_interpretation_bands.template_id));

create policy "protocol_interpretation_bands_write"
  on public.protocol_interpretation_bands for all
  to authenticated
  using (
    exists (
      select 1 from public.protocol_templates t
       where t.id = protocol_interpretation_bands.template_id
         and (
           (t.scope = 'personal' and t.owner_professional_id = auth.uid())
           or (t.scope in ('global', 'area') and (public.is_admin() or public.is_coordinator()))
         )
    )
  )
  with check (
    exists (
      select 1 from public.protocol_templates t
       where t.id = protocol_interpretation_bands.template_id
         and (
           (t.scope = 'personal' and t.owner_professional_id = auth.uid())
           or (t.scope in ('global', 'area') and (public.is_admin() or public.is_coordinator()))
         )
    )
  );

-- ---------------------------------------------------------------------------
-- 3) Fila "Pedidos de IA" — criação de protocolo em segundo plano
--    (requestProtocolTemplateFromAI agenda com `after()` do Next.js e
--    devolve na hora; a tela de Pedidos de IA mostra status via refresh/
--    polling, igual ao sininho de notificações).
-- ---------------------------------------------------------------------------
create table public.protocol_ai_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references public.profiles (id) on delete cascade,
  description text not null,
  specialty_id uuid references public.specialties (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'done', 'error')),
  result_template_id uuid references public.protocol_templates (id) on delete set null,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.protocol_ai_requests enable row level security;

create index protocol_ai_requests_requested_by_idx
  on public.protocol_ai_requests (requested_by, created_at desc);

create trigger protocol_ai_requests_set_updated_at
  before update on public.protocol_ai_requests
  for each row execute function public.set_updated_at();

create policy "protocol_ai_requests_select"
  on public.protocol_ai_requests for select
  to authenticated
  using (requested_by = auth.uid() or public.is_admin());

create policy "protocol_ai_requests_insert"
  on public.protocol_ai_requests for insert
  to authenticated
  with check (requested_by = auth.uid());

-- Sem policy de update/delete pra authenticated: o processamento em segundo
-- plano (marcar processing/done/error, criar o protocolo resultado) usa
-- service role (admin client), igual a todo outro job de IA do sistema.

-- ---------------------------------------------------------------------------
-- 4) Programas terapêuticos: critério de domínio ESTRUTURADO, lado a lado
--    com o texto livre já existente (mastery_criteria, intocado). Cada
--    programa pode ter um critério estruturado (comparado automaticamente
--    contra program_data_sessions) OU só o texto livre de sempre, OU os
--    dois — a decisão de avançar de fase continua manual
--    (updateProgramStatus), isto aqui só avisa.
-- ---------------------------------------------------------------------------
alter table public.therapeutic_programs
  add column mastery_criteria_type text
    check (mastery_criteria_type in ('percentage_independent', 'consecutive_correct_count')),
  add column mastery_criteria_threshold numeric check (mastery_criteria_threshold >= 0),
  add column mastery_criteria_consecutive_sessions integer check (mastery_criteria_consecutive_sessions >= 1);

comment on column public.therapeutic_programs.mastery_criteria is
  'Texto livre original (nunca migrado/apagado) — continua sendo a "observação" do critério, usada sozinha ou junto dos campos estruturados abaixo (mastery_criteria_type/threshold/consecutive_sessions), que são o que o sistema de fato compara contra program_data_sessions pra avisar "critério atingido".';
comment on column public.therapeutic_programs.mastery_criteria_type is
  'percentage_independent: % de respostas independentes sobre o total de tentativas na sessão. consecutive_correct_count: contagem bruta de respostas independentes na sessão (sem calcular %). Null = sem critério estruturado, só o texto livre.';
comment on column public.therapeutic_programs.mastery_criteria_threshold is
  'Valor a bater: percentual (0-100) se type=percentage_independent, contagem mínima se type=consecutive_correct_count.';
comment on column public.therapeutic_programs.mastery_criteria_consecutive_sessions is
  'Quantas sessões SEGUIDAS mais recentes precisam bater o threshold pra considerar o critério atingido.';
