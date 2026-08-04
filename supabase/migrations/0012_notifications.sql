-- Etapa 11: notificações internas (consultas novas, cancelamentos,
-- remarcações, financeiro). Sempre gravadas via service role a partir das
-- Server Actions que já existem — nenhuma policy de INSERT para o client.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  entity text,
  entity_id text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create index notifications_user_unread_idx
  on public.notifications (user_id, read_at, created_at desc);

create policy "notifications_select_own"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

create policy "notifications_update_own"
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
