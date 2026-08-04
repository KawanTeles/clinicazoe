-- Etapa 2: profissional pode alterar a própria disponibilidade (agenda),
-- mas segue sem poder mexer em preços/convênios/especialidade (isso continua
-- exclusivo do admin via /team).

drop policy "schedule_slots_write_admin_only" on public.schedule_slots;

create policy "schedule_slots_write_admin_or_owner"
  on public.schedule_slots for all
  using (public.is_admin() or professional_id = auth.uid())
  with check (public.is_admin() or professional_id = auth.uid());

drop policy "schedule_slot_insurances_write_admin_only" on public.schedule_slot_insurances;

create policy "schedule_slot_insurances_write_admin_or_owner"
  on public.schedule_slot_insurances for all
  using (
    public.is_admin()
    or exists (
      select 1 from public.schedule_slots
      where schedule_slots.id = schedule_slot_insurances.slot_id
        and schedule_slots.professional_id = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.schedule_slots
      where schedule_slots.id = schedule_slot_insurances.slot_id
        and schedule_slots.professional_id = auth.uid()
    )
  );

insert into public.role_permissions (role, permission) values
  ('profissional', 'schedule.manage.own')
on conflict (role, permission) do nothing;
