-- Etapa 27: ajustes na Lista de Espera — acesso restrito a admin/recepção
-- (profissional deixa de enxergar o módulo por completo, não só no menu) e
-- rastreio de "visto" para o badge da sidebar poder zerar sozinho quando a
-- equipe abre o módulo, sem depender apenas da mudança de status.

alter table public.waitlist_entries add column viewed_at timestamptz;

drop policy "waitlist_entries_select" on public.waitlist_entries;

create policy "waitlist_entries_select"
  on public.waitlist_entries for select
  to authenticated
  using (
    patient_id = auth.uid()
    or public.is_admin()
    or public.current_role() = 'recepcionista'
  );

delete from public.role_permissions
  where role = 'profissional' and permission = 'waitlist.view';
