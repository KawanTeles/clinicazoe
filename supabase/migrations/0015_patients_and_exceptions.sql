-- Etapa 2: profissional pode ver os dados básicos dos próprios pacientes
-- (quem já teve consulta marcada com ele) — nunca de pacientes de outros.
create policy "profiles_select_own_patients_for_professional"
  on public.profiles for select
  to authenticated
  using (
    role = 'paciente'
    and exists (
      select 1 from public.appointments
      where appointments.patient_id = profiles.id
        and appointments.professional_id = auth.uid()
    )
  );

insert into public.role_permissions (role, permission) values
  ('profissional', 'patients.view.own')
on conflict (role, permission) do nothing;

-- Etapa 5: bloqueios/férias — dias em que o profissional fica indisponível,
-- por cima da agenda recorrente.
create table public.schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

alter table public.schedule_exceptions enable row level security;

create index schedule_exceptions_professional_idx
  on public.schedule_exceptions (professional_id, start_date, end_date);

create policy "schedule_exceptions_select"
  on public.schedule_exceptions for select
  to authenticated
  using (true);

create policy "schedule_exceptions_write_admin_or_owner"
  on public.schedule_exceptions for all
  using (public.is_admin() or professional_id = auth.uid())
  with check (public.is_admin() or professional_id = auth.uid());
