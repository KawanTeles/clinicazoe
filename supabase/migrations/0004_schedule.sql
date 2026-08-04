-- Etapa 5 (escopo reduzido): horários recorrentes por profissional, com
-- filtro de convênios aceitos por horário. Férias/bloqueios/exceções ficam
-- para uma etapa futura.

create table public.schedule_slots (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

alter table public.schedule_slots enable row level security;

create trigger schedule_slots_set_updated_at
  before update on public.schedule_slots
  for each row execute function public.set_updated_at();

create policy "schedule_slots_select"
  on public.schedule_slots for select
  to authenticated
  using (status = 'active' or public.is_admin() or professional_id = auth.uid());

create policy "schedule_slots_write_admin_only"
  on public.schedule_slots for all
  using (public.is_admin())
  with check (public.is_admin());

-- Convênios aceitos por horário. Sem nenhuma linha aqui = aceita todos os
-- convênios ativos (evita ter que marcar "todos" manualmente toda vez).
create table public.schedule_slot_insurances (
  slot_id uuid not null references public.schedule_slots (id) on delete cascade,
  insurance_id uuid not null references public.insurances (id) on delete cascade,
  primary key (slot_id, insurance_id)
);

alter table public.schedule_slot_insurances enable row level security;

create policy "schedule_slot_insurances_select"
  on public.schedule_slot_insurances for select
  to authenticated
  using (true);

create policy "schedule_slot_insurances_write_admin_only"
  on public.schedule_slot_insurances for all
  using (public.is_admin())
  with check (public.is_admin());

insert into public.role_permissions (role, permission) values
  ('admin', 'schedule.manage')
on conflict (role, permission) do nothing;
