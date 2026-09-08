-- Etapa 57: galeria de fotos da clínica, gerenciável em Configurações.
-- Tabela própria (não misturada com clinic_settings, que é linha única de
-- configuração, não uma coleção) — uma linha por foto, com display_order
-- para a mesma lógica de reordenação manual já usada em insurances (Etapa
-- 55). O carrossel público (home e /estrutura) passa a ler daqui; sem
-- nenhuma linha com status='active', continua mostrando o placeholder
-- "Foto em breve" (fallback no código, não no banco).

create table public.clinic_gallery_images (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,
  alt_text text,
  display_order integer not null default 0,
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clinic_gallery_images enable row level security;

create trigger clinic_gallery_images_set_updated_at
  before update on public.clinic_gallery_images
  for each row execute function public.set_updated_at();

create policy "clinic_gallery_images_select_active_or_admin"
  on public.clinic_gallery_images for select
  to authenticated
  using (status = 'active' or public.is_admin());

create policy "clinic_gallery_images_write_admin_only"
  on public.clinic_gallery_images for all
  using (public.is_admin())
  with check (public.is_admin());

-- Bucket público (fotos institucionais, não dado sensível — mesmo raciocínio
-- de clinic-assets na Etapa 12), só o admin escreve. Limite de arquivo e
-- MIME types já aplicados na criação do bucket (reforço de limite no nível
-- do Storage, mesmo padrão adotado depois para avatars na Etapa 49).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'clinic-gallery', 'clinic-gallery', true, 5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

create policy "clinic_gallery_select_public"
  on storage.objects for select
  using (bucket_id = 'clinic-gallery');

create policy "clinic_gallery_write_admin_only"
  on storage.objects for all
  using (bucket_id = 'clinic-gallery' and public.is_admin())
  with check (bucket_id = 'clinic-gallery' and public.is_admin());
