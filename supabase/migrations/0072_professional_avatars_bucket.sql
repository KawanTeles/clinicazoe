-- Etapa 72: separa a foto de profissional (pública, aparece em
-- /profissionais e na home) da foto de paciente/staff (privada) dentro do
-- antigo bucket único "avatars" (Etapa 1).
--
-- Antes desta migration, TODO avatar (profissional, paciente, recepcionista,
-- admin) vivia no mesmo bucket privado, servido só por signed URL (TTL de
-- 1h) — a foto de profissional, que é institucional e aparece no site
-- público, pagava o mesmo preço de privacidade de uma foto de paciente: URL
-- que muda a cada hora, impossível de cachear no navegador/CDN. Abrir o
-- bucket "avatars" inteiro resolveria o cache, mas também exporia foto de
-- paciente sem exigir login — dado pessoal (LGPD), não institucional.
--
-- Solução: bucket novo, público, só para avatar de profissional. O bucket
-- "avatars" original continua existindo, privado, para paciente/
-- recepcionista/admin (policies da Etapa 1 inalteradas). O código
-- (src/lib/supabase/avatar-upload.ts) decide o bucket de destino pelo role
-- do profile no momento do upload; a migração dos arquivos já existentes é
-- feita por script (scripts/optimize-and-migrate-images.mjs), não aqui —
-- mover bytes entre buckets exige a Storage API, não SQL puro.
--
-- MIME único (webp): a partir desta migration, todo upload de avatar passa
-- pelo pipeline de otimização (resize + conversão para WebP, Etapa 72 no
-- código) antes de chegar ao Storage — não há motivo para aceitar outro
-- formato já salvo aqui.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('professional-avatars', 'professional-avatars', true, 2097152, array['image/webp'])
on conflict (id) do nothing;

create policy "professional_avatars_select_public"
  on storage.objects for select
  using (bucket_id = 'professional-avatars');

-- Mesmo padrão de "pasta = dono" da Etapa 1: o profissional só escreve na
-- própria pasta. Admin escreve via service role (bypassa RLS), não precisa
-- de policy própria aqui.
create policy "professional_avatars_insert_owner"
  on storage.objects for insert
  with check (
    bucket_id = 'professional-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "professional_avatars_update_owner"
  on storage.objects for update
  using (
    bucket_id = 'professional-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "professional_avatars_delete_owner_or_admin"
  on storage.objects for delete
  using (
    bucket_id = 'professional-avatars'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );
