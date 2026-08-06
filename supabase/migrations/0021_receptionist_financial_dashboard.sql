-- Recepção passa a visualizar os indicadores financeiros do Dashboard
-- (somente leitura). Nenhuma policy de insert/update/delete é concedida:
-- a recepção continua sem poder alterar, excluir ou editar lançamentos
-- financeiros nem configurações financeiras.
--
-- Usamos uma permissão dedicada ("financial.view.dashboard"), em vez de
-- reaproveitar "financial.view.own" (que controla o item de menu/página
-- /financial, restrita a admin e profissional) para não abrir um link de
-- menu que redirecionaria a recepção para fora da página.

create policy "financial_entries_select_recepcionista"
  on public.financial_entries for select
  to authenticated
  using (public.current_role() = 'recepcionista');

insert into public.role_permissions (role, permission) values
  ('recepcionista', 'financial.view.dashboard')
on conflict (role, permission) do nothing;
