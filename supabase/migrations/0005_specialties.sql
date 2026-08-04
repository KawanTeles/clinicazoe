-- Etapa 2/3: especialidades — mesmo padrão de convênios, configurável pelo admin.

create table public.specialties (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.specialties enable row level security;

create trigger specialties_set_updated_at
  before update on public.specialties
  for each row execute function public.set_updated_at();

create policy "specialties_select_active_or_admin"
  on public.specialties for select
  to authenticated
  using (status = 'active' or public.is_admin());

create policy "specialties_write_admin_only"
  on public.specialties for all
  using (public.is_admin())
  with check (public.is_admin());

alter table public.professionals
  add constraint professionals_specialty_id_fkey
  foreign key (specialty_id) references public.specialties (id) on delete set null;

insert into public.role_permissions (role, permission) values
  ('admin', 'specialties.manage')
on conflict (role, permission) do nothing;
