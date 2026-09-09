-- Etapa 61: campo simples para a foto de capa/fachada exibida na hero da
-- home, no lugar do card "Centro Clínico Integrado". Reaproveita o mesmo
-- bucket público "clinic-assets" e o mesmo padrão de logo_path (Etapa 16) —
-- não usa a tabela clinic_gallery_images (Etapa 57) porque aqui é sempre uma
-- única imagem de capa, não uma coleção reordenável.

alter table public.clinic_settings
  add column facade_image_path text;
