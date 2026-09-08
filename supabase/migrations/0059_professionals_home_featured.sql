-- Etapa 59: destaque manual de profissionais na home. NULL = não aparece no
-- carrossel/seção de destaque da home; um número = aparece, ordenado por
-- esse valor (mesma ideia de display_order já usada em insurances na Etapa
-- 55, mas aqui é opcional por linha em vez de obrigatório para todas — só
-- uma fração dos profissionais é "a cara" da home, o restante continua
-- listado normalmente em /profissionais).

alter table public.professionals
  add column home_display_order integer null;
