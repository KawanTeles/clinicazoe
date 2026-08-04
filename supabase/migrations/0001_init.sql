-- Etapa 1: fundação — perfis, permissões por cargo, profissionais (esqueleto),
-- configurações da clínica, auditoria, RLS e storage privado de avatares.

-- ---------------------------------------------------------------------------
-- Extensões
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helpers genéricos (sem dependência de tabelas)
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  phone text,
  avatar_path text,
  role text not null default 'paciente'
    check (role in ('admin', 'recepcionista', 'profissional', 'paciente')),
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Lê o cargo do usuário autenticado sem recursão de RLS (security definer).
-- Depende de public.profiles, por isso vem depois da tabela.
create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role() = 'admin', false);
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Cria o profile automaticamente quando um usuário é criado no Supabase Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'role', 'paciente')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Impede que um usuário não-admin altere seu próprio cargo/status.
create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
as $$
begin
  if (new.role is distinct from old.role or new.status is distinct from old.status)
     and not public.is_admin() then
    raise exception 'Somente administradores podem alterar cargo ou status.';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_role_self_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_self_escalation();

create policy "profiles_select_self_or_admin"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

create policy "profiles_update_self_or_admin"
  on public.profiles for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy "profiles_delete_admin_only"
  on public.profiles for delete
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- role_permissions — matriz de permissões configurável (sem hardcode)
-- ---------------------------------------------------------------------------
create table public.role_permissions (
  id bigint generated always as identity primary key,
  role text not null
    check (role in ('admin', 'recepcionista', 'profissional', 'paciente')),
  permission text not null,
  allowed boolean not null default true,
  created_at timestamptz not null default now(),
  unique (role, permission)
);

alter table public.role_permissions enable row level security;

create policy "role_permissions_select_authenticated"
  on public.role_permissions for select
  to authenticated
  using (true);

create policy "role_permissions_write_admin_only"
  on public.role_permissions for all
  using (public.is_admin())
  with check (public.is_admin());

insert into public.role_permissions (role, permission) values
  ('admin', 'dashboard.view'),
  ('admin', 'profile.edit.self'),
  ('admin', 'users.manage'),
  ('admin', 'professionals.manage'),
  ('admin', 'settings.manage'),
  ('admin', 'audit.view'),
  ('recepcionista', 'dashboard.view'),
  ('recepcionista', 'profile.edit.self'),
  ('profissional', 'dashboard.view'),
  ('profissional', 'profile.edit.self'),
  ('paciente', 'dashboard.view'),
  ('paciente', 'profile.edit.self');

-- ---------------------------------------------------------------------------
-- professionals — esqueleto (tela de gestão chega na Etapa 3)
-- ---------------------------------------------------------------------------
create table public.professionals (
  id uuid primary key references public.profiles (id) on delete cascade,
  specialty_id uuid,
  license_number text,
  bio text,
  agenda_color text not null default '#2F8F83',
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.professionals enable row level security;

create trigger professionals_set_updated_at
  before update on public.professionals
  for each row execute function public.set_updated_at();

create policy "professionals_select_self_or_admin"
  on public.professionals for select
  using (id = auth.uid() or public.is_admin());

create policy "professionals_update_self_or_admin"
  on public.professionals for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy "professionals_insert_admin_only"
  on public.professionals for insert
  with check (public.is_admin());

create policy "professionals_delete_admin_only"
  on public.professionals for delete
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- clinic_settings — linha única
-- ---------------------------------------------------------------------------
create table public.clinic_settings (
  id smallint primary key default 1 check (id = 1),
  name text not null default 'ClinicaZoe',
  whatsapp_number text,
  address text,
  logo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clinic_settings enable row level security;

create trigger clinic_settings_set_updated_at
  before update on public.clinic_settings
  for each row execute function public.set_updated_at();

create policy "clinic_settings_select_authenticated"
  on public.clinic_settings for select
  to authenticated
  using (true);

create policy "clinic_settings_write_admin_only"
  on public.clinic_settings for all
  using (public.is_admin())
  with check (public.is_admin());

insert into public.clinic_settings (id, name) values (1, 'ClinicaZoe');

-- ---------------------------------------------------------------------------
-- audit_logs — inserido apenas via service role (server-side)
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_logs enable row level security;

create policy "audit_logs_select_admin_only"
  on public.audit_logs for select
  using (public.is_admin());

-- Sem policy de INSERT/UPDATE/DELETE para authenticated: apenas a service role
-- (que ignora RLS) grava auditoria a partir de Server Actions confiáveis.

-- ---------------------------------------------------------------------------
-- Storage: bucket privado de avatares
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;

create policy "avatars_select_owner_or_admin"
  on storage.objects for select
  using (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

create policy "avatars_insert_owner"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_update_owner"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_delete_owner_or_admin"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );
