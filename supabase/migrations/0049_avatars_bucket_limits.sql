-- Etapa 49: fecha o Achado M1 da varredura de segurança — o bucket
-- `avatars` (Etapa 1) nunca teve `file_size_limit`/`allowed_mime_types`
-- configurados no Storage. A validação de 3MB/PNG-JPEG-WEBP sempre existiu
-- só em JavaScript (profile-client.ts, roda no browser, sem Server Action
-- no meio; e também duplicada em team-actions.ts/user-actions.ts para os
-- uploads feitos por admin) — qualquer usuário autenticado, inclusive
-- paciente, podia contornar isso chamando a API REST do Storage
-- diretamente com o próprio JWT, subindo qualquer tipo/tamanho de arquivo
-- na própria pasta do bucket.
--
-- Mesmo limite já aplicado no código (3MB = 3 * 1024 * 1024 bytes,
-- image/png, image/jpeg, image/webp), agora também no nível do
-- Postgres/Storage — mesmo padrão já usado nos buckets clinical-documents
-- (Etapa 45) e session-audio (Etapa 47), só que via UPDATE em vez de
-- INSERT porque o bucket já existe desde a Etapa 1. Aditiva: não muda
-- nenhuma policy de storage.objects, não muda o fluxo de upload existente
-- — só adiciona a segunda camada que o Storage já reforça por conta
-- própria, sem depender do client se comportar.

update storage.buckets
set file_size_limit = 3145728, -- 3 * 1024 * 1024
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
where id = 'avatars';
