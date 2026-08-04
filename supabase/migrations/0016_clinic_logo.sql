-- Etapa 12: logo da clínica — bucket público (é uma marca, não dado sensível),
-- só o admin escreve.

insert into storage.buckets (id, name, public)
values ('clinic-assets', 'clinic-assets', true)
on conflict (id) do nothing;

create policy "clinic_assets_select_public"
  on storage.objects for select
  using (bucket_id = 'clinic-assets');

create policy "clinic_assets_write_admin_only"
  on storage.objects for all
  using (bucket_id = 'clinic-assets' and public.is_admin())
  with check (bucket_id = 'clinic-assets' and public.is_admin());
