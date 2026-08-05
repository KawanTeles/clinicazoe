-- Etapa 14: log de mensagens enviadas ao paciente (histórico), feriados
-- globais da clínica (hoje só existem bloqueios por profissional via
-- schedule_exceptions) e duração opcional por convênio+profissional.

-- Registrado toda vez que um link wa.me é gerado (lembrete, confirmação,
-- cancelamento, novo agendamento) — alimenta a aba "Mensagens enviadas" do
-- histórico do paciente. Só gravado via service role, como notifications.
create table public.patient_messages (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  appointment_id uuid references public.appointments (id) on delete set null,
  type text not null,
  sent_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.patient_messages enable row level security;

create index patient_messages_patient_idx
  on public.patient_messages (patient_id, created_at desc);

create policy "patient_messages_select"
  on public.patient_messages for select
  to authenticated
  using (
    patient_id = auth.uid()
    or public.is_admin()
    or public.current_role() = 'recepcionista'
  );

-- Sem policy de insert/update/delete para authenticated: só service role.

create table public.clinic_holidays (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  description text,
  created_at timestamptz not null default now()
);

alter table public.clinic_holidays enable row level security;

create policy "clinic_holidays_select"
  on public.clinic_holidays for select
  to authenticated
  using (true);

create policy "clinic_holidays_write_admin_only"
  on public.clinic_holidays for all
  using (public.is_admin())
  with check (public.is_admin());

insert into public.role_permissions (role, permission) values
  ('admin', 'holidays.manage')
on conflict (role, permission) do nothing;

-- Override opcional de duração por convênio+profissional (cadeia Convênio →
-- Profissional → Valor → Duração). null cai no consultation_duration_minutes
-- padrão do profissional.
alter table public.professional_insurances
  add column duration_minutes int check (duration_minutes > 0);
