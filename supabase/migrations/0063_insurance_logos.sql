-- Etapa 63: logo real por convênio, exibida no lugar do ícone genérico nos
-- cards públicos (Home e /convenios) quando cadastrada. Bucket dedicado
-- (em vez de reaproveitar "clinic-assets", Etapa 16) porque são N arquivos
-- por convênio, não um singleton — mesmo padrão de leitura pública/escrita
-- admin-only.

alter table public.insurances
  add column logo_path text;

insert into storage.buckets (id, name, public)
values ('insurance-logos', 'insurance-logos', true)
on conflict (id) do nothing;

update storage.buckets
set file_size_limit = 2097152, -- 2MB, mesmo teto do logo da clínica (Etapa 16)
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
where id = 'insurance-logos';

create policy "insurance_logos_select_public"
  on storage.objects for select
  using (bucket_id = 'insurance-logos');

create policy "insurance_logos_write_admin_only"
  on storage.objects for all
  using (bucket_id = 'insurance-logos' and public.is_admin())
  with check (bucket_id = 'insurance-logos' and public.is_admin());
