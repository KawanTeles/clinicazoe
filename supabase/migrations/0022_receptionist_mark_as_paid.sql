-- Recepção passa a poder dar baixa em lançamentos financeiros (marcar como
-- pago), além de visualizar. Continua sem poder alterar valor, vencimento,
-- convênio, forma de pagamento ou de quem é o lançamento, e sem poder
-- excluir (nenhuma policy de delete é concedida).

create policy "financial_entries_update_recepcionista"
  on public.financial_entries for update
  to authenticated
  using (public.current_role() = 'recepcionista');

-- A trigger original só liberava admin (tudo) ou o próprio profissional
-- dono do lançamento (somente status/paid_at). Passa a liberar também a
-- recepcionista, com a mesma restrição de campos do profissional.
create or replace function public.prevent_financial_entry_tampering()
returns trigger
language plpgsql
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if public.current_role() <> 'recepcionista' and old.professional_id <> auth.uid() then
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

insert into public.role_permissions (role, permission) values
  ('recepcionista', 'financial.view.own')
on conflict (role, permission) do nothing;
