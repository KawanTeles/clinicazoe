-- Etapa 26: Lista de Espera — pacientes que não encontraram horário
-- disponível no fluxo de agendamento podem entrar numa fila; a equipe é
-- avisada e, ao surgir vaga compatível (inclusive por cancelamento), pode
-- transformar o registro em agendamento.

create table public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  patient_name text not null,
  patient_phone text not null,
  patient_email text,
  specialty_id uuid not null references public.specialties (id) on delete restrict,
  professional_id uuid references public.professionals (id) on delete set null,
  insurance_id uuid not null references public.insurances (id) on delete restrict,
  modality text check (modality in ('aba', 'comum')),
  period_preference text check (period_preference in ('manha', 'tarde', 'noite')),
  preferred_days smallint[] not null default '{}',
  notes text,
  status text not null default 'aguardando'
    check (status in ('aguardando', 'contato_realizado', 'vaga_oferecida', 'agendado', 'cancelado', 'sem_interesse')),
  appointment_id uuid references public.appointments (id) on delete set null,
  contacted_by uuid references public.profiles (id) on delete set null,
  contacted_at timestamptz,
  offered_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.waitlist_entries enable row level security;

create index waitlist_entries_status_idx on public.waitlist_entries (status);
create index waitlist_entries_professional_idx on public.waitlist_entries (professional_id);
create index waitlist_entries_specialty_idx on public.waitlist_entries (specialty_id);

create trigger waitlist_entries_set_updated_at
  before update on public.waitlist_entries
  for each row execute function public.set_updated_at();

create policy "waitlist_entries_select"
  on public.waitlist_entries for select
  to authenticated
  using (
    patient_id = auth.uid()
    or public.is_admin()
    or public.current_role() in ('recepcionista', 'profissional')
  );

create policy "waitlist_entries_insert_patient_own"
  on public.waitlist_entries for insert
  to authenticated
  with check (patient_id = auth.uid() and status = 'aguardando');

create policy "waitlist_entries_update_staff"
  on public.waitlist_entries for update
  to authenticated
  using (public.is_admin() or public.current_role() = 'recepcionista');

insert into public.role_permissions (role, permission) values
  ('admin', 'waitlist.manage'),
  ('recepcionista', 'waitlist.manage'),
  ('profissional', 'waitlist.view'),
  ('paciente', 'waitlist.join')
on conflict (role, permission) do nothing;
