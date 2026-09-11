-- Etapa 65: variante mobile da foto de capa/fachada da hero (Etapa 61) —
-- a foto pensada para telas largas pode não enquadrar bem em telas
-- estreitas. Opcional: sem essa foto configurada, o site cai de volta para
-- a mesma foto do desktop (facade_image_path), sem quebrar quem ainda não
-- configurou a versão mobile.

alter table public.clinic_settings
  add column facade_image_mobile_path text;
