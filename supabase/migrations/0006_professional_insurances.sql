-- Etapa 3: convênios aceitos pelo profissional (independente dos convênios
-- por horário da agenda, que já existem em schedule_slot_insurances).

create table public.professional_insurances (
  professional_id uuid not null references public.professionals (id) on delete cascade,
  insurance_id uuid not null references public.insurances (id) on delete cascade,
  primary key (professional_id, insurance_id)
);

alter table public.professional_insurances enable row level security;

create policy "professional_insurances_select"
  on public.professional_insurances for select
  to authenticated
  using (true);

create policy "professional_insurances_write_admin_only"
  on public.professional_insurances for all
  using (public.is_admin())
  with check (public.is_admin());
