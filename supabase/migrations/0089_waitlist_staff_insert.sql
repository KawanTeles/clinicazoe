-- A Lista de Espera só podia ser criada pelo próprio paciente
-- (waitlist_entries_insert_patient_own, migration 0026). Com a remoção do
-- login/portal do paciente, esse era o único jeito de entrar fila — sem uma
-- policy de insert pra equipe, o módulo trava sem ninguém conseguir
-- adicionar ninguém. Mesmo critério de waitlist_entries_update_staff.
create policy "waitlist_entries_insert_staff"
  on public.waitlist_entries for insert
  to authenticated
  with check (public.is_admin() or public.current_role() = 'recepcionista');
