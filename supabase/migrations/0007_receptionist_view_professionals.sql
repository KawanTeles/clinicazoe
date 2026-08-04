-- Etapa 2: recepcionista pode visualizar profissionais ativos e suas agendas
-- (mas nunca editar — as policies de escrita continuam admin-only).

create policy "profiles_select_active_professionals_staff"
  on public.profiles for select
  to authenticated
  using (role = 'profissional' and status = 'active');

create policy "professionals_select_active_staff"
  on public.professionals for select
  to authenticated
  using (status = 'active');

insert into public.role_permissions (role, permission) values
  ('recepcionista', 'professionals.view')
on conflict (role, permission) do nothing;
