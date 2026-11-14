-- Etapa 79: modelos de evolução com tópicos editáveis + rascunho no servidor.
--
-- Duas coisas que andam juntas:
--
-- 1) MODELOS. Hoje os 7 campos da evolução estão escritos à mão dentro do
--    componente React (EvolutionForm.tsx, array FIELDS) — não existe modelo no
--    banco. O padrão de fábrica passa a ser UM tópico só, "Evolução", de texto
--    livre; quem quiser mais tópicos cria um modelo (por área ou pessoal).
--
-- 2) RASCUNHO. Em patient_evolutions o INSERT *é* a assinatura: o nome do
--    profissional é congelado por gatilho e não existe policy de UPDATE desde
--    a 0069. Isso é o núcleo da confiabilidade do prontuário e não vai ser
--    afrouxado. Só que sem um estado intermediário não há onde pendurar anexo
--    antes de assinar (etapa 80) e a coordenação não tem como saber que
--    alguém começou a escrever (etapa 81) — hoje o rascunho vive só no
--    localStorage do navegador do terapeuta e some se ele trocar de aparelho.
--
--    Em vez de devolver policy de UPDATE à tabela assinada, o rascunho ganha
--    tabela PRÓPRIA e mutável. Ao assinar, uma transação copia para
--    patient_evolutions (o INSERT imutável de sempre) e apaga o rascunho.
--    Nenhuma garantia existente é tocada.

-- ---------------------------------------------------------------------------
-- 1) Modelos
-- ---------------------------------------------------------------------------
create table public.evolution_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- global  -> fallback da clínica inteira (o padrão de fábrica)
  -- area    -> padrão de uma especialidade
  -- personal-> modelo de um profissional, só para o uso dele
  scope text not null check (scope in ('global', 'area', 'personal')),
  specialty_id uuid references public.specialties (id) on delete cascade,
  owner_professional_id uuid references public.professionals (id) on delete cascade,
  -- Bumpada pelo gatilho sempre que os tópicos mudam. A evolução assinada
  -- guarda este número (patient_evolutions.template_version) para dizer QUAL
  -- versão do modelo foi usada.
  version integer not null default 1,
  status text not null default 'active' check (status in ('active', 'archived')),
  is_factory_default boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Cada abrangência exige exatamente o seu vínculo, e nenhum outro.
  constraint evolution_templates_scope_target check (
    (scope = 'global'   and specialty_id is null and owner_professional_id is null)
    or (scope = 'area'     and specialty_id is not null and owner_professional_id is null)
    or (scope = 'personal' and specialty_id is null and owner_professional_id is not null)
  )
);

alter table public.evolution_templates enable row level security;

-- Um só padrão de fábrica, e um só modelo de área por especialidade ativa.
create unique index evolution_templates_single_factory_idx
  on public.evolution_templates (is_factory_default)
  where is_factory_default;

create unique index evolution_templates_one_active_area_idx
  on public.evolution_templates (specialty_id)
  where scope = 'area' and status = 'active';

create index evolution_templates_owner_idx
  on public.evolution_templates (owner_professional_id)
  where scope = 'personal';

create trigger evolution_templates_set_updated_at
  before update on public.evolution_templates
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2) Tópicos do modelo
-- ---------------------------------------------------------------------------
create table public.evolution_template_topics (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.evolution_templates (id) on delete cascade,
  label text not null,
  -- Dica de preenchimento mostrada abaixo do campo (opcional).
  hint text,
  display_order integer not null default 0,
  -- Ocultar em vez de apagar: um tópico que já foi usado em evolução assinada
  -- some do formulário sem sumir do histórico.
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.evolution_template_topics enable row level security;

create index evolution_template_topics_template_idx
  on public.evolution_template_topics (template_id, display_order);

create trigger evolution_template_topics_set_updated_at
  before update on public.evolution_template_topics
  for each row execute function public.set_updated_at();

-- Mexeu em tópico, a versão do modelo anda. É isso que permite a uma evolução
-- antiga dizer "usei a v2 deste modelo" mesmo depois de alguém editar os
-- tópicos — sem precisar versionar a tabela inteira.
create or replace function public.evolution_templates_bump_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template uuid;
begin
  v_template := coalesce(new.template_id, old.template_id);

  update public.evolution_templates
     set version = version + 1,
         updated_at = now()
   where id = v_template;

  return coalesce(new, old);
end;
$$;

create trigger evolution_template_topics_bump_version
  after insert or update or delete on public.evolution_template_topics
  for each row execute function public.evolution_templates_bump_version();

-- O padrão de fábrica é o último recurso da resolução de modelo (pessoal ->
-- área -> fábrica). Sem ele, um profissional sem modelo próprio e sem modelo
-- de área ficaria sem formulário nenhum.
create or replace function public.evolution_templates_protect_factory()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' and old.is_factory_default then
    raise exception 'O modelo padrão de fábrica não pode ser excluído.';
  end if;

  if tg_op = 'UPDATE' and old.is_factory_default then
    if new.is_factory_default is distinct from true then
      raise exception 'O modelo padrão de fábrica não pode deixar de ser o padrão.';
    end if;
    if new.status <> 'active' then
      raise exception 'O modelo padrão de fábrica não pode ser arquivado.';
    end if;
    if new.scope <> 'global' then
      raise exception 'O modelo padrão de fábrica é sempre de abrangência global.';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger evolution_templates_protect_factory
  before update or delete on public.evolution_templates
  for each row execute function public.evolution_templates_protect_factory();

-- ---------------------------------------------------------------------------
-- 3) Colunas novas na evolução assinada
-- ---------------------------------------------------------------------------
alter table public.patient_evolutions
  -- Conteúdo tópico a tópico, com o RÓTULO CONGELADO no momento da
  -- assinatura: [{"label": "...", "content": "...", "order": 0}]. É o registro
  -- autoritativo do que os tópicos eram — renomear o tópico no modelo depois
  -- não reescreve evolução nenhuma.
  add column topic_contents jsonb,
  add column template_id uuid references public.evolution_templates (id) on delete set null,
  add column template_version integer,
  -- Qual versão do prompt gerou o rascunho da IA. Hoje o prompt é uma
  -- constante em código e não ficava registrado em lugar nenhum.
  add column ai_prompt_version text;

comment on column public.patient_evolutions.topic_contents is
  'Conteudo por topico com o rotulo congelado na assinatura. NULL nas evolucoes anteriores a etapa 79 e nas do modo detalhado (que usam as 7 colunas fixas). clinical_evolution continua sendo a versao oficial e legivel, e e dela que dependem impressao, relatorios de IA e adendos.';

-- Mesma coluna nas versões pré-assinatura (0041), senão o snapshot do gatilho
-- de versionamento perderia o conteúdo por tópico.
alter table public.patient_evolution_versions
  add column topic_contents jsonb;

-- O gatilho de snapshot da 0041 lista as colunas uma a uma — sem reescrevê-lo
-- aqui, topic_contents seria uma coluna que nunca é preenchida, ou seja,
-- schema que mente. Esse caminho só é alcançável pela service role (desde a
-- 0069 patient_evolutions não tem policy de UPDATE para ninguém), então isto é
-- defesa em profundidade, não correção de bug ativo — mas defesa em
-- profundidade que não cobre uma coluna nova não defende nada.
create or replace function public.patient_evolutions_snapshot_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next_version int;
begin
  if new.session_summary is not distinct from old.session_summary
     and new.clinical_evolution is not distinct from old.clinical_evolution
     and new.objectives is not distinct from old.objectives
     and new.interventions is not distinct from old.interventions
     and new.patient_response is not distinct from old.patient_response
     and new.home_guidance is not distinct from old.home_guidance
     and new.observations is not distinct from old.observations
     and new.topic_contents is not distinct from old.topic_contents then
    return new;
  end if;

  select coalesce(max(version_number), 0) + 1
    into v_next_version
    from public.patient_evolution_versions
   where evolution_id = old.id;

  insert into public.patient_evolution_versions (
    evolution_id, version_number, professional_id,
    session_summary, clinical_evolution, objectives, interventions,
    patient_response, home_guidance, observations, topic_contents,
    edited_by, edited_at
  ) values (
    old.id, v_next_version, old.professional_id,
    old.session_summary, old.clinical_evolution, old.objectives, old.interventions,
    old.patient_response, old.home_guidance, old.observations, old.topic_contents,
    auth.uid(), now()
  );

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) Rascunho
-- ---------------------------------------------------------------------------
create table public.evolution_drafts (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  patient_id uuid not null references public.profiles (id) on delete cascade,
  professional_id uuid not null references public.professionals (id) on delete cascade,
  specialty_id uuid references public.specialties (id) on delete set null,
  template_id uuid references public.evolution_templates (id) on delete set null,
  template_version integer,
  topic_contents jsonb not null default '[]'::jsonb,
  raw_summary_input text,
  ai_prompt_version text,
  created_by uuid not null references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Um rascunho por profissional por atendimento — espelha a unique de
  -- patient_evolutions (appointment_id, professional_id) da 0037, que é o que
  -- faz atendimento conjugado ter uma evolução por profissional.
  unique (appointment_id, professional_id)
);

alter table public.evolution_drafts enable row level security;

create index evolution_drafts_professional_idx
  on public.evolution_drafts (professional_id, updated_at desc);

create index evolution_drafts_patient_idx
  on public.evolution_drafts (patient_id);

create trigger evolution_drafts_set_updated_at
  before update on public.evolution_drafts
  for each row execute function public.set_updated_at();

-- Mesma validação de patient_evolutions_validate (0025): o rascunho tem de
-- pertencer de fato à consulta referenciada, e a consulta tem de ter
-- acontecido. Sem isso, dava pra abrir rascunho de consulta de outro
-- profissional ou de consulta futura.
create or replace function public.evolution_drafts_validate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  appt record;
begin
  select professional_id, patient_id, status
    into appt
    from public.appointments
   where id = new.appointment_id;

  if appt is null then
    raise exception 'Atendimento não encontrado.';
  end if;

  if appt.patient_id <> new.patient_id then
    raise exception 'O rascunho não pertence ao paciente deste atendimento.';
  end if;

  -- Principal da consulta OU coterapeuta (atendimento conjugado).
  if appt.professional_id <> new.professional_id
     and not exists (
       select 1
         from public.appointment_professionals ap
        where ap.appointment_id = new.appointment_id
          and ap.professional_id = new.professional_id
     ) then
    raise exception 'O profissional não está vinculado a este atendimento.';
  end if;

  if appt.status not in ('confirmada', 'concluida') then
    raise exception 'Só é possível rascunhar evolução de atendimento realizado.';
  end if;

  if tg_op = 'UPDATE' then
    if new.appointment_id is distinct from old.appointment_id
       or new.patient_id is distinct from old.patient_id
       or new.professional_id is distinct from old.professional_id then
      raise exception 'Não é possível trocar consulta, paciente ou profissional do rascunho.';
    end if;
  end if;

  return new;
end;
$$;

create trigger evolution_drafts_validate
  before insert or update on public.evolution_drafts
  for each row execute function public.evolution_drafts_validate();

-- ---------------------------------------------------------------------------
-- 5) RLS
-- ---------------------------------------------------------------------------

-- Rascunho é do autor e de mais ninguém. Diferente do TEXTO da evolução
-- assinada (que a 0069 abriu para todo profissional vinculado ao paciente),
-- um registro ainda não assinado não é prontuário — é anotação em andamento.
-- Nem colega vinculado, nem admin, nem coordenação, nem recepção leem.
-- A coordenação vai saber apenas que EXISTE rascunho, pela view de status da
-- etapa 81 — nunca pelo conteúdo.
create policy "evolution_drafts_select_own"
  on public.evolution_drafts for select
  to authenticated
  using (professional_id = auth.uid());

create policy "evolution_drafts_insert_own"
  on public.evolution_drafts for insert
  to authenticated
  with check (professional_id = auth.uid() and created_by = auth.uid());

create policy "evolution_drafts_update_own"
  on public.evolution_drafts for update
  to authenticated
  using (professional_id = auth.uid())
  with check (professional_id = auth.uid());

-- Rascunho PODE ser apagado — é o que o descarte e a própria assinatura
-- fazem. É a diferença deliberada em relação a patient_evolutions, que não
-- tem policy de delete para ninguém.
create policy "evolution_drafts_delete_own"
  on public.evolution_drafts for delete
  to authenticated
  using (professional_id = auth.uid());

-- Modelos: leitura para a equipe clínica e para quem administra os padrões.
-- Modelo pessoal só aparece para o dono.
create policy "evolution_templates_select"
  on public.evolution_templates for select
  to authenticated
  using (
    (
      public.current_role() = 'profissional'
      or public.is_admin()
      or public.is_coordinator()
    )
    and (scope in ('global', 'area') or owner_professional_id = auth.uid())
  );

-- Modelo pessoal: o próprio profissional cria, edita e apaga o dele.
create policy "evolution_templates_write_own"
  on public.evolution_templates for all
  to authenticated
  using (scope = 'personal' and owner_professional_id = auth.uid())
  with check (scope = 'personal' and owner_professional_id = auth.uid());

-- Padrão da área e global: admin e Coordenação (decisão Q1 — o modelo de
-- evolução é instrumento de gestão clínica e não dá acesso a dado de
-- paciente nenhum).
create policy "evolution_templates_write_shared"
  on public.evolution_templates for all
  to authenticated
  using (scope in ('global', 'area') and (public.is_admin() or public.is_coordinator()))
  with check (scope in ('global', 'area') and (public.is_admin() or public.is_coordinator()));

-- Tópicos herdam o acesso do modelo pai. O exists() não fecha ciclo: as
-- policies de evolution_templates não consultam evolution_template_topics de
-- volta (o problema de recursão 42P17 da 0039/0040).
create policy "evolution_template_topics_select"
  on public.evolution_template_topics for select
  to authenticated
  using (
    exists (
      select 1 from public.evolution_templates t
       where t.id = evolution_template_topics.template_id
    )
  );

create policy "evolution_template_topics_write"
  on public.evolution_template_topics for all
  to authenticated
  using (
    exists (
      select 1 from public.evolution_templates t
       where t.id = evolution_template_topics.template_id
         and (
           (t.scope = 'personal' and t.owner_professional_id = auth.uid())
           or (t.scope in ('global', 'area') and (public.is_admin() or public.is_coordinator()))
         )
    )
  )
  with check (
    exists (
      select 1 from public.evolution_templates t
       where t.id = evolution_template_topics.template_id
         and (
           (t.scope = 'personal' and t.owner_professional_id = auth.uid())
           or (t.scope in ('global', 'area') and (public.is_admin() or public.is_coordinator()))
         )
    )
  );

-- ---------------------------------------------------------------------------
-- 6) Permissões
-- ---------------------------------------------------------------------------
insert into public.role_permissions (role, permission) values
  ('profissional', 'evolution_templates.manage.own'),
  ('admin', 'evolution_templates.manage.shared'),
  ('coordenacao', 'evolution_templates.manage.shared')
on conflict (role, permission) do nothing;

-- ---------------------------------------------------------------------------
-- 7) Padrão de fábrica: UM tópico, "Evolução", texto livre.
--    Com um tópico só, o texto gravado em clinical_evolution é exatamente o
--    que o terapeuta escreveu — idêntico ao de hoje. Nada no histórico
--    existente muda de comportamento.
-- ---------------------------------------------------------------------------
with modelo as (
  insert into public.evolution_templates (name, scope, is_factory_default)
  values ('Evolução', 'global', true)
  returning id
)
insert into public.evolution_template_topics (template_id, label, display_order)
select id, 'Evolução', 0 from modelo;

-- O gatilho de bump subiu a versão ao inserir o tópico acima. O padrão de
-- fábrica nasce na v1 — ninguém o editou ainda.
update public.evolution_templates
   set version = 1
 where is_factory_default;
