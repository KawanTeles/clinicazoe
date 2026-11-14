-- Etapa 82: permissão da tela de Acompanhamento de evoluções.
-- Admin também vê (decisão Q5 do desenho aprovado): é tela de gestão sem
-- conteúdo clínico, e o admin já administra a clínica inteira — e não abre
-- nada, porque a autorização de verdade está DENTRO de get_evolution_tracking
-- (0081), não nesta permissão de UI.

insert into public.role_permissions (role, permission) values
  ('coordenacao', 'evolution_tracking.view'),
  ('admin', 'evolution_tracking.view')
on conflict (role, permission) do nothing;
