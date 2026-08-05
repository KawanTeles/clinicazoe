-- Etapa 13: consultas recorrentes. Cada ocorrência continua sendo uma linha
-- normal em appointments (mesmas policies, mesmo trigger de tampering,
-- mesma integração com financial_entries/notifications) — appointment_series
-- só guarda a regra de repetição que gerou essas linhas, para permitir
-- editar/excluir "esta", "esta e as próximas" ou "toda a sequência".

create table public.appointment_series (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  professional_id uuid not null references public.professionals (id) on delete cascade,
  specialty_id uuid references public.specialties (id) on delete set null,
  insurance_id uuid not null references public.insurances (id) on delete restrict,
  payment_method text not null
    check (payment_method in ('cartao', 'pix', 'dinheiro', 'convenio')),
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  frequency text not null check (frequency in ('weekly', 'biweekly', 'monthly')),
  start_date date not null,
  end_date date,
  max_occurrences int check (max_occurrences > 0),
  status text not null default 'active' check (status in ('active', 'cancelled')),
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date),
  check (end_time > start_time)
);

alter table public.appointment_series enable row level security;

create index appointment_series_professional_idx
  on public.appointment_series (professional_id);

create index appointment_series_patient_idx
  on public.appointment_series (patient_id);

create trigger appointment_series_set_updated_at
  before update on public.appointment_series
  for each row execute function public.set_updated_at();

-- Mesma visibilidade de appointments_select: paciente, profissional da série
-- ou staff.
create policy "appointment_series_select"
  on public.appointment_series for select
  to authenticated
  using (
    patient_id = auth.uid()
    or professional_id = auth.uid()
    or public.is_admin()
    or public.current_role() = 'recepcionista'
  );

-- Só staff cria e exclui recorrência. Editar (reagendar dia/horário) também é
-- permitido ao profissional responsável pela própria série — nunca a outro
-- profissional, e o trigger abaixo impede que ele mexa em paciente, convênio,
-- forma de pagamento ou especialidade.
create policy "appointment_series_write_staff_only"
  on public.appointment_series for all
  using (public.is_admin() or public.current_role() = 'recepcionista')
  with check (public.is_admin() or public.current_role() = 'recepcionista');

create policy "appointment_series_update_professional_own"
  on public.appointment_series for update
  to authenticated
  using (professional_id = auth.uid())
  with check (professional_id = auth.uid());

alter table public.appointments
  add column series_id uuid references public.appointment_series (id) on delete set null,
  add column reminder_sent_at timestamptz;

create index appointments_series_idx
  on public.appointments (series_id);

-- Profissional só edita (nunca exclui) as próprias ocorrências recorrentes.
create policy "appointments_update_professional_own"
  on public.appointments for update
  to authenticated
  using (professional_id = auth.uid());

-- Estende o trigger de 0009/0013: staff continua com via livre; paciente
-- continua só podendo cancelar/remarcar a própria consulta; agora o
-- profissional responsável por uma ocorrência recorrente também pode
-- reagendar data/horário da própria consulta, mas não pode alterar
-- paciente, profissional, convênio, forma de pagamento ou valor.
create or replace function public.prevent_appointment_tampering()
returns trigger
language plpgsql
as $$
begin
  if public.is_admin() or public.current_role() = 'recepcionista' then
    return new;
  end if;

  if old.professional_id = auth.uid() and old.series_id is not null then
    if new.patient_id <> old.patient_id
       or new.professional_id <> old.professional_id
       or new.value <> old.value
       or new.insurance_id <> old.insurance_id
       or new.payment_method <> old.payment_method then
      raise exception 'Você só pode alterar data/horário desta consulta.';
    end if;
    return new;
  end if;

  if old.patient_id <> auth.uid() then
    raise exception 'Não autorizado.';
  end if;

  if new.status not in ('cancelada', 'remarcada') then
    raise exception 'Você só pode cancelar ou remarcar sua própria consulta.';
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

-- Mesma ideia para a série: staff livre; profissional só pode mexer em
-- dia/horário/duração/status da própria série, nunca em paciente, convênio,
-- forma de pagamento ou especialidade.
create or replace function public.prevent_series_tampering()
returns trigger
language plpgsql
as $$
begin
  if public.is_admin() or public.current_role() = 'recepcionista' then
    return new;
  end if;

  if old.professional_id <> auth.uid() then
    raise exception 'Não autorizado.';
  end if;

  if new.patient_id <> old.patient_id
     or new.professional_id <> old.professional_id
     or new.insurance_id <> old.insurance_id
     or new.payment_method <> old.payment_method
     or new.specialty_id is distinct from old.specialty_id then
    raise exception 'Você só pode alterar dia, horário, duração ou status desta recorrência.';
  end if;

  return new;
end;
$$;

create trigger appointment_series_prevent_tampering
  before update on public.appointment_series
  for each row execute function public.prevent_series_tampering();

insert into public.role_permissions (role, permission) values
  ('admin', 'appointments.recurring.manage'),
  ('recepcionista', 'appointments.recurring.manage'),
  ('profissional', 'appointments.recurring.edit.own')
on conflict (role, permission) do nothing;
