-- Etapa 47: bucket de storage para o áudio de sessão enviado à transcrição
-- (Etapa 46). Não fazia parte da 0046 original — precisa de algum lugar
-- para o arquivo pousar entre o upload e a chamada à API da OpenAI, mesmo
-- sendo removido logo em seguida (sucesso ou falha).
--
-- Mesmo padrão de duas camadas do bucket clinical-documents (Etapa 45):
-- privado, path com o profissional dono como primeira pasta
-- ({professional_id}/{appointment_id}/{arquivo}), então a policy de
-- storage não precisa de join com nenhuma tabela. file_size_limit é o
-- teto rígido de 25MB da própria API do Whisper (decisão de produto: não
-- configurável pelo admin).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'session-audio', 'session-audio', false, 26214400,
  array[
    'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/m4a',
    'audio/wav', 'audio/x-wav', 'audio/webm'
  ]
)
on conflict (id) do nothing;

create policy "session_audio_storage_insert_owner"
  on storage.objects for insert
  with check (bucket_id = 'session-audio' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "session_audio_storage_select_owner"
  on storage.objects for select
  using (bucket_id = 'session-audio' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "session_audio_storage_delete_owner"
  on storage.objects for delete
  using (bucket_id = 'session-audio' and (storage.foldername(name))[1] = auth.uid()::text);
