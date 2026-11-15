-- Etapa 86: Biblioteca de protocolos/avaliação (Parte 5 do pedido original)
-- — construtor + import CSV, nascendo VAZIA de propósito. Nenhum instrumento
-- de terceiro (VB-MAPP, ABLLS-R, Portage, Denver II etc.) é pré-carregado:
-- a pesquisa de alternativas de domínio público (item Q7) não achou nenhum
-- protocolo de ABA genuíno sem risco de direito autoral — os candidatos
-- achados (marcos do CDC americano, Caderneta do Ministério da Saúde) são
-- telas de desenvolvimento geral, não protocolo de ABA, e o usuário decidiu
-- deixar a biblioteca vazia por agora. Esta migration só cria a estrutura;
-- quem decide o que entra é o próprio usuário, pelo construtor ou por CSV.
--
-- Mesmo modelo de abrangência de evolution_templates (Etapa 79): global
-- (padrão da clínica), area (por especialidade) ou personal (do próprio
-- profissional) — reaproveitado de propósito, mesma UI mental que
-- "Modelos de Evolução" já ensinou à equipe. Sem "padrão de fábrica" aqui:
-- diferente do modelo de evolução, não existe protocolo obrigatório — zero
-- protocolo é um estado válido e esperado.

-- ---------------------------------------------------------------------------
-- 1) Modelo de protocolo.
-- ---------------------------------------------------------------------------
create table public.protocol_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  scope text not null check (scope in ('global', 'area', 'personal')),
  specialty_id uuid references public.specialties (id) on delete cascade,
  owner_professional_id uuid references public.professionals (id) on delete cascade,
  -- Bumpada pelo gatilho sempre que os itens mudam — mesmo motivo de
  -- evolution_templates.version: uma avaliação já respondida guarda esta
  -- versão para saber qual conjunto de itens foi usado.
  version integer not null default 1,
  -- active/inactive, não active/archived — convenção do projeto (ver 0080;
  -- toda outra tabela do banco usa este par, inclusive o tipo TS Status).
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint protocol_templates_scope_target check (
    (scope = 'global'   and specialty_id is null and owner_professional_id is null)
    or (scope = 'area'     and specialty_id is not null and owner_professional_id is null)
    or (scope = 'personal' and specialty_id is null and owner_professional_id is not null)
  )
);

alter table public.protocol_templates enable row level security;

create index protocol_templates_owner_idx
  on public.protocol_templates (owner_professional_id)
  where scope = 'personal';

create index protocol_templates_specialty_idx
  on public.protocol_templates (specialty_id)
  where scope = 'area';

create trigger protocol_templates_set_updated_at
  before update on public.protocol_templates
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2) Itens do protocolo (o construtor monta isto; o import CSV também grava
--    aqui — uma linha de CSV por item).
-- ---------------------------------------------------------------------------
create table public.protocol_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.protocol_templates (id) on delete cascade,
  -- Agrupamento livre (ex.: "Linguagem", "Motor grosso") — opcional, exibido
  -- como cabeçalho de seção na tela de avaliação quando preenchido.
  domain text,
  label text not null,
  display_order integer not null default 0,
  -- Ocultar em vez de apagar: um item já usado em avaliação respondida some
  -- do construtor sem sumir da resposta histórica (resposta guarda o label
  -- direto, não só o id — ver patient_protocol_assessments.responses).
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.protocol_items enable row level security;

create index protocol_items_template_idx
  on public.protocol_items (template_id, display_order);

create trigger protocol_items_set_updated_at
  before update on public.protocol_items
  for each row execute function public.set_updated_at();

create or replace function public.protocol_templates_bump_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template uuid;
begin
  v_template := coalesce(new.template_id, old.template_id);
  update public.protocol_templates
     set version = version + 1, updated_at = now()
   where id = v_template;
  return coalesce(new, old);
end;
$$;

create trigger protocol_items_bump_version
  after insert or update or delete on public.protocol_items
  for each row execute function public.protocol_templates_bump_version();

-- ---------------------------------------------------------------------------
-- 3) RLS dos modelos/itens — cópia do padrão de evolution_templates (0079),
--    sem o conceito de padrão de fábrica.
-- ---------------------------------------------------------------------------
create policy "protocol_templates_select"
  on public.protocol_templates for select
  to authenticated
  using (
    (
      public.current_role() = 'profissional'
      or public.is_admin()
      or public.is_coordinator()
    )
    and (scope in ('global', 'area') or owner_professional_id = auth.uid())
  );

create policy "protocol_templates_write_own"
  on public.protocol_templates for all
  to authenticated
  using (scope = 'personal' and owner_professional_id = auth.uid())
  with check (scope = 'personal' and owner_professional_id = auth.uid());

create policy "protocol_templates_write_shared"
  on public.protocol_templates for all
  to authenticated
  using (scope in ('global', 'area') and (public.is_admin() or public.is_coordinator()))
  with check (scope in ('global', 'area') and (public.is_admin() or public.is_coordinator()));

create policy "protocol_items_select"
  on public.protocol_items for select
  to authenticated
  using (
    exists (select 1 from public.protocol_templates t where t.id = protocol_items.template_id)
  );

create policy "protocol_items_write"
  on public.protocol_items for all
  to authenticated
  using (
    exists (
      select 1 from public.protocol_templates t
       where t.id = protocol_items.template_id
         and (
           (t.scope = 'personal' and t.owner_professional_id = auth.uid())
           or (t.scope in ('global', 'area') and (public.is_admin() or public.is_coordinator()))
         )
    )
  )
  with check (
    exists (
      select 1 from public.protocol_templates t
       where t.id = protocol_items.template_id
         and (
           (t.scope = 'personal' and t.owner_professional_id = auth.uid())
           or (t.scope in ('global', 'area') and (public.is_admin() or public.is_coordinator()))
         )
    )
  );

-- ---------------------------------------------------------------------------
-- 4) Aplicação do protocolo a um paciente — imutável como o resto do
--    prontuário (insert-only), com o rótulo/domínio de cada item CONGELADO
--    na resposta (mesmo princípio de patient_evolutions.topic_contents): um
--    protocolo editado depois nunca reescreve avaliação já respondida.
-- ---------------------------------------------------------------------------
create table public.patient_protocol_assessments (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.protocol_templates (id) on delete restrict,
  template_name text not null,
  template_version integer not null,
  patient_id uuid not null references public.profiles (id) on delete cascade,
  professional_id uuid not null references public.professionals (id) on delete restrict,
  assessment_date date not null default current_date,
  -- [{"domain": "...", "label": "...", "achieved": true, "notes": "..."}]
  responses jsonb not null,
  notes text,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(responses) = 'array' and jsonb_array_length(responses) > 0)
);

alter table public.patient_protocol_assessments enable row level security;

create index patient_protocol_assessments_patient_idx
  on public.patient_protocol_assessments (patient_id, assessment_date desc);

create or replace function public.patient_protocol_assessments_validate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.appointments a
     where a.patient_id = new.patient_id
       and (a.professional_id = new.professional_id
            or exists (
              select 1 from public.appointment_professionals ap
               where ap.appointment_id = a.id and ap.professional_id = new.professional_id
            ))
  ) then
    raise exception 'Só é possível avaliar um paciente já vinculado ao profissional.';
  end if;
  return new;
end;
$$;

create trigger patient_protocol_assessments_validate_bi
  before insert on public.patient_protocol_assessments
  for each row execute function public.patient_protocol_assessments_validate();

create policy "patient_protocol_assessments_select"
  on public.patient_protocol_assessments for select
  to authenticated
  using (
    exists (
      select 1 from public.appointments a
       where a.patient_id = patient_protocol_assessments.patient_id
         and (a.professional_id = auth.uid() or public.is_appointment_cotherapist(a.id))
    )
  );

create policy "patient_protocol_assessments_insert"
  on public.patient_protocol_assessments for insert
  to authenticated
  with check (professional_id = auth.uid() and created_by = auth.uid());

-- Sem policy de update/delete: avaliação respondida é registro clínico,
-- mesmo princípio de patient_evolutions/program_data_sessions.

-- ---------------------------------------------------------------------------
-- 5) Permissões.
-- ---------------------------------------------------------------------------
insert into public.role_permissions (role, permission) values
  ('profissional', 'protocol_templates.manage.own'),
  ('admin', 'protocol_templates.manage.shared'),
  ('coordenacao', 'protocol_templates.manage.shared'),
  ('profissional', 'protocol_assessments.manage')
on conflict (role, permission) do nothing;
