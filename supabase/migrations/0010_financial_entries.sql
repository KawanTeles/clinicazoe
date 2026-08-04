-- Etapa 9: lançamento financeiro criado automaticamente na confirmação da consulta.

create table public.financial_entries (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments (id) on delete cascade,
  patient_id uuid not null references public.profiles (id) on delete cascade,
  professional_id uuid not null references public.professionals (id) on delete cascade,
  insurance_id uuid references public.insurances (id) on delete set null,
  value numeric(10, 2) not null check (value >= 0),
  payment_method text not null
    check (payment_method in ('cartao', 'pix', 'dinheiro', 'convenio')),
  due_date date not null,
  status text not null default 'em_aberto' check (status in ('em_aberto', 'pago')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.financial_entries enable row level security;

create index financial_entries_professional_idx on public.financial_entries (professional_id);

create trigger financial_entries_set_updated_at
  before update on public.financial_entries
  for each row execute function public.set_updated_at();

-- Profissional só pode alterar status/paid_at do próprio lançamento
-- (marcar como pago). Nunca valor, vencimento ou de quem é o lançamento.
create or replace function public.prevent_financial_entry_tampering()
returns trigger
language plpgsql
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if old.professional_id <> auth.uid() then
    raise exception 'Não autorizado.';
  end if;

  if new.value <> old.value
     or new.due_date <> old.due_date
     or new.patient_id <> old.patient_id
     or new.professional_id <> old.professional_id
     or new.insurance_id is distinct from old.insurance_id
     or new.payment_method <> old.payment_method then
    raise exception 'Alteração não permitida.';
  end if;

  return new;
end;
$$;

create trigger financial_entries_prevent_tampering
  before update on public.financial_entries
  for each row execute function public.prevent_financial_entry_tampering();

create policy "financial_entries_select"
  on public.financial_entries for select
  to authenticated
  using (professional_id = auth.uid() or public.is_admin());

create policy "financial_entries_update"
  on public.financial_entries for update
  to authenticated
  using (professional_id = auth.uid() or public.is_admin());

-- Sem policy de INSERT/DELETE para authenticated: o lançamento nasce via
-- service role (Server Action) no momento da confirmação da consulta.

insert into public.role_permissions (role, permission) values
  ('admin', 'financial.manage'),
  ('profissional', 'financial.view.own')
on conflict (role, permission) do nothing;
