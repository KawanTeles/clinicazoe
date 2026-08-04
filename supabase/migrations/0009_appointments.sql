-- Etapa 6: consultas agendadas pelo paciente.

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  professional_id uuid not null references public.professionals (id) on delete cascade,
  specialty_id uuid references public.specialties (id) on delete set null,
  insurance_id uuid not null references public.insurances (id) on delete restrict,
  schedule_slot_id uuid not null references public.schedule_slots (id) on delete restrict,
  appointment_date date not null,
  start_time time not null,
  end_time time not null,
  payment_method text not null
    check (payment_method in ('cartao', 'pix', 'dinheiro', 'convenio')),
  value numeric(10, 2) not null check (value >= 0),
  status text not null default 'pendente'
    check (status in ('pendente', 'confirmada', 'cancelada', 'remarcada', 'concluida', 'faltou')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.appointments enable row level security;

create index appointments_professional_date_idx
  on public.appointments (professional_id, appointment_date);

create trigger appointments_set_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

-- Paciente só pode cancelar a própria consulta (nunca confirmar, remarcar
-- por conta própria ou mexer em consulta de outra pessoa). Staff tem via
-- livre; a policy de UPDATE só decide quem pode TENTAR, este trigger decide
-- o que a tentativa pode de fato mudar.
create or replace function public.prevent_appointment_tampering()
returns trigger
language plpgsql
as $$
begin
  if public.is_admin() or public.current_role() = 'recepcionista' then
    return new;
  end if;

  if old.patient_id <> auth.uid() then
    raise exception 'Não autorizado.';
  end if;

  if new.status <> 'cancelada' then
    raise exception 'Você só pode cancelar sua própria consulta.';
  end if;

  if new.patient_id <> old.patient_id
     or new.professional_id <> old.professional_id
     or new.value <> old.value
     or new.appointment_date <> old.appointment_date
     or new.start_time <> old.start_time then
    raise exception 'Alteração não permitida.';
  end if;

  return new;
end;
$$;

create trigger appointments_prevent_tampering
  before update on public.appointments
  for each row execute function public.prevent_appointment_tampering();

create policy "appointments_select"
  on public.appointments for select
  to authenticated
  using (
    patient_id = auth.uid()
    or professional_id = auth.uid()
    or public.is_admin()
    or public.current_role() = 'recepcionista'
  );

create policy "appointments_insert_patient_own"
  on public.appointments for insert
  to authenticated
  with check (patient_id = auth.uid() and status = 'pendente');

create policy "appointments_update"
  on public.appointments for update
  to authenticated
  using (patient_id = auth.uid() or public.is_admin() or public.current_role() = 'recepcionista');

insert into public.role_permissions (role, permission) values
  ('paciente', 'appointments.book'),
  ('paciente', 'appointments.view.own'),
  ('profissional', 'appointments.view.own'),
  ('admin', 'appointments.manage'),
  ('recepcionista', 'appointments.manage')
on conflict (role, permission) do nothing;
