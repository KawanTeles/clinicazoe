-- Etapa 91: geração automática do rascunho na Evolução Rápida — assim que o
-- resumo termina (voz ou texto), o rascunho aparece sozinho, sem precisar
-- clicar em "Gerar evolução". A terapeuta sempre revisa e assina — isso não
-- muda; o que muda é só QUEM aperta o botão de gerar.
--
-- Preferência por profissional, mesmo padrão de professionals.bio: cada
-- profissional liga/desliga a própria geração automática em "Meu Perfil".
-- Padrão LIGADO (pedido do usuário) — só quem desligar explicitamente volta
-- ao fluxo manual de sempre.

alter table public.professionals
  add column quick_evolution_auto_generate boolean not null default true;
