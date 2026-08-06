-- ---------------------------------------------------------------------------
-- clinic_settings — expansão para painel completo de identidade institucional
-- ---------------------------------------------------------------------------

alter table public.clinic_settings
  add column if not exists legal_name text,
  add column if not exists email text,
  add column if not exists website_url text,
  add column if not exists instagram_url text,
  add column if not exists facebook_url text,
  add column if not exists linkedin_url text,
  add column if not exists youtube_url text,
  add column if not exists address_zip text,
  add column if not exists address_street text,
  add column if not exists address_number text,
  add column if not exists address_complement text,
  add column if not exists address_neighborhood text,
  add column if not exists address_city text,
  add column if not exists address_state text,
  add column if not exists address_country text not null default 'Brasil',
  add column if not exists phone_primary text,
  add column if not exists phone_secondary text,
  add column if not exists emergency_phone text,
  add column if not exists maps_url text,
  add column if not exists latitude numeric(9, 6),
  add column if not exists longitude numeric(9, 6),
  -- day: convenção de Date.prototype.getDay() em JS (0 = domingo ... 6 = sábado)
  add column if not exists business_hours jsonb not null default '[
    {"day": 0, "is_open": false, "open_time": "08:00", "close_time": "12:00"},
    {"day": 1, "is_open": true, "open_time": "07:00", "close_time": "20:00"},
    {"day": 2, "is_open": true, "open_time": "07:00", "close_time": "20:00"},
    {"day": 3, "is_open": true, "open_time": "07:00", "close_time": "20:00"},
    {"day": 4, "is_open": true, "open_time": "07:00", "close_time": "20:00"},
    {"day": 5, "is_open": true, "open_time": "07:00", "close_time": "20:00"},
    {"day": 6, "is_open": true, "open_time": "08:00", "close_time": "14:00"}
  ]'::jsonb,
  add column if not exists holiday_open boolean not null default false,
  add column if not exists holiday_open_time text,
  add column if not exists holiday_close_time text;

-- Nenhuma policy nova necessária: as policies existentes (select para
-- `authenticated`, write via `is_admin()`) operam em `select *` / `update`
-- na mesma linha e já cobrem as colunas novas automaticamente.

insert into public.role_permissions (role, permission)
values
  ('admin', 'settings.view'),
  ('recepcionista', 'settings.view')
on conflict (role, permission) do nothing;
