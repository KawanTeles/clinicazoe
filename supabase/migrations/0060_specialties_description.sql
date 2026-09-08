-- Etapa 60: descrição curta por especialidade, exibida no carrossel da home
-- (substitui o texto fixo "Atendimento presencial e online" por um resumo
-- real do que a especialidade faz). Opcional — null/vazio simplesmente omite
-- a linha no card, sem quebrar o layout.

alter table public.specialties
  add column description text;
