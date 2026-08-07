-- Etapa 30: completa os requisitos de auditoria e limites de uso de IA que
-- ficaram de fora das etapas anteriores.
--
-- audit_logs.ip: registrado automaticamente por logAudit() a partir do
-- cabeçalho da requisição (x-forwarded-for/x-real-ip), quando disponível —
-- nunca preenchido pelo client.
--
-- ai_settings ganha limite diário (opcional) e limite mensal por usuário
-- (opcional), complementando o limite mensal por clínica já existente.

alter table public.audit_logs
  add column ip text;

alter table public.ai_settings
  add column daily_request_limit integer,
  add column monthly_request_limit_per_user integer;
