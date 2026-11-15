-- Etapa 85: Programas terapêuticos (ABA) com coleta de dados tentativa a
-- tentativa e gráfico de % de independência por sessão (Parte 4 do pedido
-- original).
--
-- Decisão já confirmada com o usuário: o primeiro formato de coleta é
-- tentativa a tentativa com nível de ajuda (independente / dica verbal /
-- dica gestual / dica física / incorreta) — é o formato mais usado em
-- ensino de habilidade nova (discrete trial training) e já cobre a maioria
-- dos programas de aquisição. Frequência/duração (mais usado em redução de
-- comportamento) fica para uma etapa futura, se pedido.
--
-- Cada SESSÃO de coleta é uma linha com CONTADORES (não uma linha por
-- tentativa) — o terapeuta soma as tentativas em tempo real (ex.: toca
-- "independente" 5 vezes) e salva um total por sessão. Isso é o que a tela
-- de coleta realmente precisa, sem a sobrecarga de uma linha por tentativa
-- isolada.
--
-- Mesmo espírito de sigilo profissional do resto do prontuário: programa e
-- dado de sessão são conteúdo clínico (descrevem o alvo terapêutico e o
-- desempenho do paciente) — nem admin, nem Coordenação, nem recepção têm
-- policy de select em nenhuma das duas tabelas. Diferente de
-- patient_evolutions, aqui QUALQUER profissional vinculado ao paciente
-- (principal ou coterapeuta, em qualquer atendimento) pode ler E escrever —
-- um programa é um plano de equipe, implementado por vários terapeutas ao
-- longo do tempo, não um registro de autoria única.

-- ---------------------------------------------------------------------------
-- 1) Programa (o alvo terapêutico).
-- ---------------------------------------------------------------------------
create table public.therapeutic_programs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  -- Quem CRIOU o programa — não é "dono" exclusivo (qualquer vinculado edita
  -- e coleta dado), mas fica registrado quem propôs o alvo originalmente.
  professional_id uuid not null references public.professionals (id) on delete restrict,
  name text not null,
  description text,
  mastery_criteria text,
  status text not null default 'active'
    check (status in ('active', 'mastered', 'paused', 'discontinued')),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.therapeutic_programs enable row level security;

create index therapeutic_programs_patient_idx
  on public.therapeutic_programs (patient_id, status);

create trigger therapeutic_programs_set_updated_at
  before update on public.therapeutic_programs
  for each row execute function public.set_updated_at();

-- Confere vínculo com o paciente na criação, e trava id/patient_id/
-- professional_id/created_by depois — só nome, descrição, critério e status
-- podem mudar num update (o programa é um plano vivo, não um registro
-- assinado; mas QUEM o criou e DE QUEM é o paciente nunca mudam).
create or replace function public.therapeutic_programs_validate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if not exists (
      select 1 from public.appointments a
       where a.patient_id = new.patient_id
         and (a.professional_id = auth.uid() or public.is_appointment_cotherapist(a.id))
    ) then
      raise exception 'Só é possível criar programa para um paciente já vinculado ao profissional.';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.patient_id <> old.patient_id
       or new.professional_id <> old.professional_id
       or new.created_by <> old.created_by then
      raise exception 'Não é possível trocar paciente, profissional ou autor do programa.';
    end if;
  end if;

  return new;
end;
$$;

create trigger therapeutic_programs_validate_biu
  before insert or update on public.therapeutic_programs
  for each row execute function public.therapeutic_programs_validate();

create policy "therapeutic_programs_select"
  on public.therapeutic_programs for select
  to authenticated
  using (
    exists (
      select 1 from public.appointments a
       where a.patient_id = therapeutic_programs.patient_id
         and (a.professional_id = auth.uid() or public.is_appointment_cotherapist(a.id))
    )
  );

create policy "therapeutic_programs_insert"
  on public.therapeutic_programs for insert
  to authenticated
  with check (created_by = auth.uid());

-- Qualquer profissional vinculado pode ajustar nome/critério/status — o
-- gatilho acima já impede trocar paciente/autor por essa porta.
create policy "therapeutic_programs_update"
  on public.therapeutic_programs for update
  to authenticated
  using (
    exists (
      select 1 from public.appointments a
       where a.patient_id = therapeutic_programs.patient_id
         and (a.professional_id = auth.uid() or public.is_appointment_cotherapist(a.id))
    )
  )
  with check (true);

-- Sem policy de delete: discontinuar é uma mudança de status, nunca some do
-- histórico (mesmo princípio do resto do prontuário).

-- ---------------------------------------------------------------------------
-- 2) Sessão de coleta de dados — contadores por nível de ajuda.
-- ---------------------------------------------------------------------------
create table public.program_data_sessions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.therapeutic_programs (id) on delete restrict,
  patient_id uuid not null references public.profiles (id) on delete cascade,
  professional_id uuid not null references public.professionals (id) on delete restrict,
  appointment_id uuid references public.appointments (id) on delete set null,
  session_date date not null default current_date,
  independent_count integer not null default 0 check (independent_count >= 0),
  verbal_prompt_count integer not null default 0 check (verbal_prompt_count >= 0),
  gestural_prompt_count integer not null default 0 check (gestural_prompt_count >= 0),
  physical_prompt_count integer not null default 0 check (physical_prompt_count >= 0),
  incorrect_count integer not null default 0 check (incorrect_count >= 0),
  notes text,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  check (
    independent_count + verbal_prompt_count + gestural_prompt_count
    + physical_prompt_count + incorrect_count > 0
  )
);

alter table public.program_data_sessions enable row level security;

create index program_data_sessions_program_idx
  on public.program_data_sessions (program_id, session_date);

-- Mesma checagem de vínculo + consistência com o programa referenciado
-- (patient_id/professional_id precisam bater com o do programa e com quem
-- está autenticado).
create or replace function public.program_data_sessions_validate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prog record;
begin
  select patient_id into prog from public.therapeutic_programs where id = new.program_id;
  if prog is null then
    raise exception 'Programa não encontrado.';
  end if;
  if prog.patient_id <> new.patient_id then
    raise exception 'A sessão deve pertencer ao mesmo paciente do programa.';
  end if;

  if not exists (
    select 1 from public.appointments a
     where a.patient_id = new.patient_id
       and (a.professional_id = new.professional_id
            or exists (
              select 1 from public.appointment_professionals ap
               where ap.appointment_id = a.id and ap.professional_id = new.professional_id
            ))
  ) then
    raise exception 'Só é possível registrar sessão para um paciente já vinculado ao profissional.';
  end if;

  return new;
end;
$$;

create trigger program_data_sessions_validate_bi
  before insert on public.program_data_sessions
  for each row execute function public.program_data_sessions_validate();

create policy "program_data_sessions_select"
  on public.program_data_sessions for select
  to authenticated
  using (
    exists (
      select 1 from public.appointments a
       where a.patient_id = program_data_sessions.patient_id
         and (a.professional_id = auth.uid() or public.is_appointment_cotherapist(a.id))
    )
  );

create policy "program_data_sessions_insert"
  on public.program_data_sessions for insert
  to authenticated
  with check (professional_id = auth.uid() and created_by = auth.uid());

-- Sem policy de update/delete: o dado de uma sessão já salva é o registro
-- clínico daquela sessão — não se reescreve depois (mesmo motivo de
-- patient_evolutions não ter update). Corrigir um erro de digitação é uma
-- nova sessão com nota explicando, não uma edição silenciosa do histórico.

-- ---------------------------------------------------------------------------
-- 3) Permissões.
-- ---------------------------------------------------------------------------
insert into public.role_permissions (role, permission) values
  ('profissional', 'therapeutic_programs.manage')
on conflict (role, permission) do nothing;
