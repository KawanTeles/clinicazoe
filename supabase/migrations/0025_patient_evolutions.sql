-- Etapa 25: Evolução do Paciente (Prontuário Evolutivo) — a cada consulta
-- realizada, o profissional responsável registra como foi o atendimento.
-- Formam um histórico clínico permanente e cronológico por paciente.
--
-- Regras de acesso (reforçadas por RLS, não só pela UI):
--   admin          -> vê tudo, nunca cria/edita/exclui.
--   profissional   -> cria e edita só as próprias evoluções (professional_id
--                     = auth.uid()); só existem para consultas onde ele é o
--                     profissional, então "só pacientes vinculados a ele" já
--                     sai de graça.
--   recepcionista  -> nenhuma policy de select/insert/update -> acesso zero.
--   paciente       -> nenhuma policy de select/insert/update -> acesso zero.
--   ninguém        -> nenhuma policy de delete para nenhum papel -> histórico
--                     nunca é perdido, nem por admin, nem pelo profissional.

create table public.patient_evolutions (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments (id) on delete cascade,
  patient_id uuid not null references public.profiles (id) on delete cascade,
  professional_id uuid not null references public.professionals (id) on delete cascade,
  specialty_id uuid references public.specialties (id) on delete set null,
  session_summary text,
  clinical_evolution text not null,
  objectives text,
  interventions text,
  patient_response text,
  home_guidance text,
  observations text,
  created_by uuid not null references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.patient_evolutions enable row level security;

create index patient_evolutions_patient_idx
  on public.patient_evolutions (patient_id, created_at desc);

create index patient_evolutions_professional_idx
  on public.patient_evolutions (professional_id, created_at desc);

-- Valida, em insert e update, que a evolução pertence de fato à consulta
-- referenciada (mesmo paciente, mesmo profissional) e que a consulta já
-- aconteceu (confirmada/concluída); em update, impede trocar consulta,
-- paciente ou profissional depois de criada. Mesmo espírito de
-- prevent_appointment_tampering (0009_appointments.sql).
create or replace function public.patient_evolutions_validate()
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
    raise exception 'Consulta não encontrada.';
  end if;

  if new.professional_id <> appt.professional_id or new.patient_id <> appt.patient_id then
    raise exception 'A evolução deve pertencer ao profissional e ao paciente da consulta.';
  end if;

  if appt.status not in ('confirmada', 'concluida') then
    raise exception 'Só é possível registrar evolução para consultas realizadas.';
  end if;

  if tg_op = 'UPDATE' then
    if new.appointment_id <> old.appointment_id
       or new.patient_id <> old.patient_id
       or new.professional_id <> old.professional_id then
      raise exception 'Não é permitido alterar a consulta, o paciente ou o profissional de uma evolução existente.';
    end if;
  end if;

  return new;
end;
$$;

create trigger patient_evolutions_validate_biu
  before insert or update on public.patient_evolutions
  for each row execute function public.patient_evolutions_validate();

-- Quem editou e quando são sempre decididos pelo servidor, nunca pelo valor
-- enviado pelo client (evita spoofing de autoria).
create or replace function public.patient_evolutions_track_editor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_by = auth.uid();
  new.updated_at = now();
  return new;
end;
$$;

create trigger patient_evolutions_set_editor
  before update on public.patient_evolutions
  for each row execute function public.patient_evolutions_track_editor();

create policy "patient_evolutions_select_own_or_admin"
  on public.patient_evolutions for select
  to authenticated
  using (professional_id = auth.uid() or public.is_admin());

create policy "patient_evolutions_insert_own"
  on public.patient_evolutions for insert
  to authenticated
  with check (
    professional_id = auth.uid()
    and created_by = auth.uid()
    and exists (
      select 1 from public.appointments
      where appointments.id = appointment_id
        and appointments.professional_id = auth.uid()
    )
  );

create policy "patient_evolutions_update_own"
  on public.patient_evolutions for update
  to authenticated
  using (professional_id = auth.uid())
  with check (professional_id = auth.uid());

-- Sem policy de delete para nenhum papel: nem admin, nem profissional podem
-- excluir (só service role, fora do fluxo normal da aplicação).

insert into public.role_permissions (role, permission) values
  ('profissional', 'evolutions.create'),
  ('profissional', 'evolutions.edit.own'),
  ('profissional', 'evolutions.view.own'),
  ('admin', 'evolutions.view.all')
on conflict (role, permission) do nothing;
