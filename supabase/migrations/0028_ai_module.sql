-- Etapa 28: Fundação do módulo de Inteligência Artificial.
--
-- ai_settings é uma linha única (mesmo padrão de clinic_settings) com a
-- configuração do provedor de IA da clínica: provedor escolhido, chave de
-- API (sempre criptografada — nunca texto puro, nunca exposta ao frontend),
-- toggles de recursos e limites de uso.
--
-- Acesso: só admin, em qualquer operação (nem profissional lê a linha
-- direto — a tela de Evolução recebe apenas um subconjunto seguro de flags
-- via query que usa o client de service role, o mesmo padrão já usado por
-- logAudit() para gravar em audit_logs apesar de não haver policy de insert
-- para authenticated).
--
-- Não criamos tabela de log de uso: as chamadas de IA reaproveitam
-- audit_logs (ai.evolution.improved etc.) com metadata técnica, sem
-- conteúdo clínico — e essa mesma tabela é usada para contar o consumo
-- mensal contra monthly_request_limit.

create table public.ai_settings (
  id smallint primary key default 1 check (id = 1),
  provider text not null default 'mock' check (provider in ('mock', 'openai', 'anthropic', 'gemini')),
  model text,
  api_key_ciphertext text,
  api_key_last4 text,
  connection_status text not null default 'not_configured'
    check (connection_status in ('not_configured', 'connected', 'error')),
  connection_tested_at timestamptz,
  ai_enabled boolean not null default false,
  evolution_assistant_enabled boolean not null default true,
  show_review_notice boolean not null default true,
  monthly_request_limit integer,
  limit_action text not null default 'block' check (limit_action in ('block', 'warn', 'allow')),
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_settings enable row level security;

create trigger ai_settings_set_updated_at
  before update on public.ai_settings
  for each row execute function public.set_updated_at();

create policy "ai_settings_admin_only"
  on public.ai_settings for all
  using (public.is_admin())
  with check (public.is_admin());

insert into public.ai_settings (id) values (1);

insert into public.role_permissions (role, permission) values
  ('admin', 'ai.settings.manage'),
  ('profissional', 'ai.evolution_assistant.use')
on conflict (role, permission) do nothing;
