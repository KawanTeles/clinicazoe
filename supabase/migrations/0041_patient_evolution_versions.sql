-- Etapa 41: histórico de versões de patient_evolutions. Cada UPDATE que
-- altera conteúdo clínico grava, via trigger, uma cópia do estado ANTERIOR
-- nesta tabela antes de sobrescrever. A linha em patient_evolutions
-- continua sendo sempre a versão atual — nada muda no fluxo de leitura
-- existente. Fase 1: só leitura (sem restauração) e sem expurgo — mesmo
-- prazo de retenção do prontuário (5 anos, sem exclusão automática).

create table public.patient_evolution_versions (
  id uuid primary key default gen_random_uuid(),
  evolution_id uuid not null references public.patient_evolutions (id) on delete cascade,
  version_number int not null,
  -- Denormalizado de patient_evolutions só para a RLS não precisar de join
  -- (patient_evolutions já é RLS-scoped por professional_id).
  professional_id uuid not null references public.professionals (id) on delete cascade,
  session_summary text,
  clinical_evolution text not null,
  objectives text,
  interventions text,
  patient_response text,
  home_guidance text,
  observations text,
  -- Quem fez a edição que substituiu esta versão (decidido pelo trigger via
  -- auth.uid(), nunca pelo client — mesmo cuidado de patient_evolutions_track_editor).
  edited_by uuid references public.profiles (id) on delete set null,
  edited_at timestamptz not null default now(),
  unique (evolution_id, version_number)
);

alter table public.patient_evolution_versions enable row level security;

create index patient_evolution_versions_evolution_idx
  on public.patient_evolution_versions (evolution_id, version_number desc);

-- Snapshot automático: roda antes do update em patient_evolutions, só se
-- algum campo de conteúdo mudou de fato (evita ruído em updates que não
-- alteram texto, ex.: se um dia outro campo não-clínico for adicionado).
-- Compara sempre OLD vs NEW dos campos de conteúdo, que nenhum outro
-- trigger de patient_evolutions modifica — então a ordem de disparo em
-- relação a patient_evolutions_set_editor/patient_evolutions_validate_biu
-- não afeta o resultado.
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
     and new.observations is not distinct from old.observations then
    return new;
  end if;

  select coalesce(max(version_number), 0) + 1
    into v_next_version
    from public.patient_evolution_versions
    where evolution_id = old.id;

  insert into public.patient_evolution_versions (
    evolution_id, version_number, professional_id,
    session_summary, clinical_evolution, objectives, interventions,
    patient_response, home_guidance, observations, edited_by, edited_at
  ) values (
    old.id, v_next_version, old.professional_id,
    old.session_summary, old.clinical_evolution, old.objectives, old.interventions,
    old.patient_response, old.home_guidance, old.observations, auth.uid(), now()
  );

  return new;
end;
$$;

create trigger patient_evolutions_snapshot_version_bu
  before update on public.patient_evolutions
  for each row execute function public.patient_evolutions_snapshot_version();

-- RLS: exatamente o mesmo escopo de patient_evolutions_select_own (0031) —
-- só quem escreveu a evolução original enxerga o próprio histórico. Sem
-- exceção para admin (sigilo profissional, mesmo critério da 0031). Sem
-- policy de insert/update/delete para authenticated: só o trigger
-- (security definer) grava aqui; imutável depois de criada, ninguém edita
-- ou apaga uma versão histórica.
create policy "patient_evolution_versions_select_own"
  on public.patient_evolution_versions for select
  to authenticated
  using (professional_id = auth.uid());
