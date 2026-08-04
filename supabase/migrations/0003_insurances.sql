-- Etapa 4: convênios — totalmente configuráveis pelo admin, nada fixo no código.

create table public.insurances (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.insurances enable row level security;

create trigger insurances_set_updated_at
  before update on public.insurances
  for each row execute function public.set_updated_at();

create policy "insurances_select_active_or_admin"
  on public.insurances for select
  to authenticated
  using (status = 'active' or public.is_admin());

create policy "insurances_write_admin_only"
  on public.insurances for all
  using (public.is_admin())
  with check (public.is_admin());

insert into public.role_permissions (role, permission) values
  ('admin', 'insurances.manage')
on conflict (role, permission) do nothing;

-- "Particular" (atendimento sem convênio) é tratado como uma opção normal,
-- editável/desativável pelo admin como qualquer outro convênio.
insert into public.insurances (name) values ('Particular')
on conflict (name) do nothing;
