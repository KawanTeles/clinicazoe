-- Etapa 15: separa solicitações de agendamento feitas pelo próprio paciente
-- (Área do Cliente / site público) das que a equipe já cria diretamente,
-- para alimentar o novo módulo "Solicitações" do painel administrativo.

-- Origem do agendamento. Default 'staff' preserva o comportamento das linhas
-- já existentes (todas criadas até aqui vieram de agendamento manual/paciente
-- sem essa distinção — não há como recuperar a origem retroativamente, então
-- assume-se 'staff' para não esconder nada que já estava visível em Consultas).
alter table public.appointments
  add column source text not null default 'staff'
    check (source in ('paciente', 'site_publico', 'staff'));

-- Novo status para recusa de solicitação — distinto de 'cancelada', que já
-- tem semântica própria (cancelamento pelo paciente/equipe de uma consulta
-- que já existia como pendente ou confirmada).
alter table public.appointments drop constraint appointments_status_check;
alter table public.appointments add constraint appointments_status_check
  check (status in ('pendente', 'confirmada', 'cancelada', 'remarcada', 'concluida', 'faltou', 'recusada'));

insert into public.role_permissions (role, permission) values
  ('admin', 'requests.manage'),
  ('recepcionista', 'requests.manage')
on conflict (role, permission) do nothing;
