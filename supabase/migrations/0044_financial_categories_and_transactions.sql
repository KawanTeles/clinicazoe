-- Etapa 44: financeiro completo — categorias e lançamentos manuais
-- (entrada/saída, despesas fixas/variáveis). Aditivo: não altera
-- financial_entries, que continua sendo só a receita automática de
-- atendimento (fluxo intocado).

-- ---------------------------------------------------------------------------
-- financial_categories — mesmo padrão de insurances/specialties
-- ---------------------------------------------------------------------------
create table public.financial_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('receita', 'despesa')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, kind)
);

alter table public.financial_categories enable row level security;

create trigger financial_categories_set_updated_at
  before update on public.financial_categories
  for each row execute function public.set_updated_at();

-- Select inclui recepcionista (não só admin) — diferente do template de
-- insurances/specialties de propósito: a recepcionista precisa enxergar
-- categorias inativas também, para exibir corretamente lançamentos antigos
-- que referenciam uma categoria já desativada.
create policy "financial_categories_select"
  on public.financial_categories for select
  to authenticated
  using (status = 'active' or public.is_admin() or public.current_role() = 'recepcionista');

-- Insert e update separados (não "for all"): categoria nunca é apagada de
-- verdade, só desativada via status — mesmo princípio de financial_entries
-- (nunca perder histórico) e patient_evolutions (sem policy de delete).
-- Sem policy de delete aqui de propósito.
create policy "financial_categories_insert_admin_only"
  on public.financial_categories for insert
  to authenticated
  with check (public.is_admin());

create policy "financial_categories_update_admin_only"
  on public.financial_categories for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- financial_transactions — lançamentos manuais (entrada/saída), não ligados
-- a appointment. Despesa sempre categorizada; fixa/variável só se aplica a
-- saída.
-- ---------------------------------------------------------------------------
create table public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  direction text not null check (direction in ('entrada', 'saida')),
  category_id uuid not null references public.financial_categories (id) on delete restrict,
  expense_type text check (expense_type in ('fixa', 'variavel')),
  professional_id uuid references public.professionals (id) on delete set null,
  description text not null,
  value numeric(10, 2) not null check (value >= 0),
  payment_method text check (payment_method in ('pix', 'dinheiro', 'cartao', 'transferencia', 'boleto', 'outro')),
  due_date date not null,
  status text not null default 'em_aberto' check (status in ('em_aberto', 'pago')),
  paid_at timestamptz,
  notes text,
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_transactions_expense_type_only_saida
    check (direction = 'saida' or expense_type is null)
);
-- created_by já nasce NOT NULL + ON DELETE RESTRICT (lição da 0042/0043 —
-- corrigir isso de saída em vez de descobrir o bug de novo depois).

alter table public.financial_transactions enable row level security;

create index financial_transactions_due_date_idx on public.financial_transactions (due_date);
create index financial_transactions_status_idx on public.financial_transactions (status);
create index financial_transactions_category_idx on public.financial_transactions (category_id);

-- Valida que a categoria escolhida é compatível com a direção do lançamento
-- (categoria de despesa só em saída, de receita só em entrada) — checagem
-- cross-table que um CHECK simples não cobre, mesmo espírito de
-- patient_evolutions_validate (0025). Em UPDATE, também impede trocar
-- direction ou created_by depois de criado — mesma imutabilidade que
-- patient_evolutions_validate aplica a appointment_id/patient_id/
-- professional_id: a direção e a autoria de um lançamento não mudam depois
-- de registrado (se o lançamento foi um engano, cria-se um novo lançamento
-- de correção; não se reescreve o histórico).
create or replace function public.financial_transactions_validate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text;
begin
  select kind into v_kind from public.financial_categories where id = new.category_id;

  if v_kind is null then
    raise exception 'Categoria financeira não encontrada.';
  end if;

  if (new.direction = 'entrada' and v_kind <> 'receita')
     or (new.direction = 'saida' and v_kind <> 'despesa') then
    raise exception 'A categoria selecionada não é compatível com a direção do lançamento.';
  end if;

  if tg_op = 'UPDATE' then
    if new.direction <> old.direction or new.created_by <> old.created_by then
      raise exception 'Não é permitido alterar a direção ou o autor de um lançamento existente.';
    end if;
  end if;

  return new;
end;
$$;

create trigger financial_transactions_validate_biu
  before insert or update on public.financial_transactions
  for each row execute function public.financial_transactions_validate();

-- Quem editou e quando são sempre decididos pelo servidor (mesmo cuidado de
-- patient_evolutions_track_editor, 0025).
create or replace function public.financial_transactions_track_editor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_by = auth.uid();
  new.updated_at = now();
  return new;
end;
$$;

create trigger financial_transactions_set_editor
  before update on public.financial_transactions
  for each row execute function public.financial_transactions_track_editor();

-- RLS: só admin e recepcionista enxergam/gerenciam despesas e lançamentos
-- manuais — diferente de financial_entries, aqui não existe escopo "só os
-- próprios" para profissional nem acesso de paciente (despesa da clínica
-- não é assunto do profissional individual). professional_id é só
-- referência interna (relatório "despesas ligadas ao profissional X"), sem
-- necessidade de policy própria para o profissional enxergar isso.
create policy "financial_transactions_select"
  on public.financial_transactions for select
  to authenticated
  using (public.is_admin() or public.current_role() = 'recepcionista');

create policy "financial_transactions_insert"
  on public.financial_transactions for insert
  to authenticated
  with check (
    (public.is_admin() or public.current_role() = 'recepcionista')
    and created_by = auth.uid()
  );

create policy "financial_transactions_update"
  on public.financial_transactions for update
  to authenticated
  using (public.is_admin() or public.current_role() = 'recepcionista')
  with check (public.is_admin() or public.current_role() = 'recepcionista');

-- Sem policy de delete: mesmo princípio de financial_entries (0022) — nunca
-- perder histórico financeiro, nem admin apaga.

insert into public.role_permissions (role, permission) values
  ('admin', 'financial.categories.manage'),
  ('admin', 'financial.transactions.manage'),
  ('recepcionista', 'financial.transactions.manage')
on conflict (role, permission) do nothing;
