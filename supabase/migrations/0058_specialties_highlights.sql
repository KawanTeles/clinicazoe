-- Etapa 58: destaques (checklist) por especialidade, exibidos como lista com
-- ícone de check no card público. Opcional — null/vazio não renderiza nada no
-- site, mantendo o card como está hoje.

alter table public.specialties
  add column highlights text[];
