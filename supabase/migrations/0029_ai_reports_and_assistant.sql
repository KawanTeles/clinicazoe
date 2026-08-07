-- Etapa 29: Relatórios IA e Assistente do Prontuário.
--
-- ai_reports guarda tudo relacionado a um relatório gerado por IA — geração,
-- edição, duplicação e "salvar no prontuário" são só operações sobre a mesma
-- linha (status draft -> finalized), sem tabela extra.
--
-- Regras de acesso (reforçadas por RLS):
--   profissional -> cria/edita/duplica só os próprios relatórios
--                   (professional_id = auth.uid()).
--   admin         -> só visualiza (nunca gera nem edita), mesmo padrão já
--                    usado em patient_evolutions.
--   recepcionista/paciente -> nenhuma policy -> acesso zero.
--   ninguém        -> nenhuma policy de delete -> histórico nunca é perdido.

create table public.ai_reports (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  professional_id uuid not null references public.professionals (id) on delete cascade,
  template text not null check (template in (
    'clinico', 'resumo_terapeutico', 'evolucao_consolidada',
    'convenio', 'escola', 'encaminhamento', 'alta'
  )),
  period_start date,
  period_end date,
  evolution_ids uuid[] not null default '{}',
  title text not null,
  content text not null default '',
  status text not null default 'draft' check (status in ('draft', 'finalized')),
  created_by uuid not null references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_reports enable row level security;

create index ai_reports_patient_idx on public.ai_reports (patient_id, created_at desc);
create index ai_reports_professional_idx on public.ai_reports (professional_id, created_at desc);

create trigger ai_reports_set_updated_at
  before update on public.ai_reports
  for each row execute function public.set_updated_at();

create policy "ai_reports_select_own_or_admin"
  on public.ai_reports for select
  to authenticated
  using (professional_id = auth.uid() or public.is_admin());

create policy "ai_reports_insert_own"
  on public.ai_reports for insert
  to authenticated
  with check (professional_id = auth.uid() and created_by = auth.uid());

create policy "ai_reports_update_own"
  on public.ai_reports for update
  to authenticated
  using (professional_id = auth.uid())
  with check (professional_id = auth.uid());

-- Sem policy de delete para nenhum papel.

alter table public.ai_settings
  add column reports_enabled boolean not null default true,
  add column patient_assistant_enabled boolean not null default true;

insert into public.role_permissions (role, permission) values
  ('admin', 'ai.reports.use'),
  ('profissional', 'ai.reports.use'),
  ('profissional', 'ai.patient_assistant.use')
on conflict (role, permission) do nothing;
