-- Etapa 83: ditado por voz — grava ao vivo pelo microfone, em vez de só
-- transcrever arquivo já gravado em outro app (que já existia desde a 0046).
--
-- Dois ajustes, ambos decididos pelo usuário antes desta migration:
--   1. Troca whisper-1 por gpt-4o-mini-transcribe (feito só em código — mesmo
--      endpoint, mesma chave, nenhuma migration necessária para isso).
--   2. Glossário de termos da área (TEA, TDAH, ABA, nomes de protocolos...),
--      editável pelo admin, enviado como parâmetro `prompt` da API — melhora
--      o reconhecimento de termos técnicos sem custo adicional.
--
-- Campo único (texto livre, não lista estruturada): é exatamente o que o
-- parâmetro `prompt` da API espera — um texto de contexto, não uma lista
-- validável item a item. Uma tabela normalizada aqui seria complexidade sem
-- benefício real.

alter table public.ai_settings
  add column transcription_glossary text;

comment on column public.ai_settings.transcription_glossary is
  'Texto livre com termos/siglas da área (TEA, TDAH, ABA, nomes de protocolos) enviado como "prompt" de contexto para a API de transcrição — melhora o reconhecimento sem custo adicional. NULL/vazio = nenhum hint enviado.';
