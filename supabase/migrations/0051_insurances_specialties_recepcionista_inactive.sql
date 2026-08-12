-- Etapa 51: fecha o Achado M8 da varredura de segurança — insurances/
-- specialties (Etapas 3/5) só liberavam registros inativos pra admin,
-- deixando a recepcionista sem enxergar convênio/especialidade já
-- desativado ao renderizar uma consulta antiga que referencia um deles. A
-- Etapa 44 já resolveu exatamente esse mesmo problema para
-- financial_categories, com o comentário reconhecendo a lacuna aqui — esta
-- migration aplica o mesmo padrão nas duas tabelas que ficaram de fora.

drop policy "insurances_select_active_or_admin" on public.insurances;
create policy "insurances_select_active_or_admin"
  on public.insurances for select
  to authenticated
  using (status = 'active' or public.is_admin() or public.current_role() = 'recepcionista');

drop policy "specialties_select_active_or_admin" on public.specialties;
create policy "specialties_select_active_or_admin"
  on public.specialties for select
  to authenticated
  using (status = 'active' or public.is_admin() or public.current_role() = 'recepcionista');
