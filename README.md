# ClinicaZoe

Sistema de gestão para clínica (agenda, pacientes, financeiro, relatórios com IA,
transcrição de áudio, portal do cliente). Aplicação single-tenant, self-hosted.

**Stack:** [Next.js 16](https://nextjs.org) (App Router, Turbopack) + [Supabase](https://supabase.com)
(Postgres, Auth, Storage, Row Level Security) + TypeScript + Tailwind CSS.
Deploy via [PM2](https://pm2.keymetrics.io/) em servidor próprio — **não** usa
Vercel nem nenhuma plataforma serverless (rate-limit e outros caches em memória
assumem um único processo Node de longa duração; veja `ecosystem.config.js`).

## Requisitos

- Node.js `>=20.9.0` (piso mínimo exigido pelo próprio Next.js 16 — veja `engines` em `package.json`)
- Uma conta/projeto no [Supabase](https://supabase.com)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`npx supabase`, não precisa instalar globalmente)

## Setup local

```bash
git clone <repo>
cd clinicazoe
npm install

cp .env.example .env.local
# preencha .env.local com as credenciais do seu projeto Supabase
# (Project Settings -> API) e gere AI_SECRET_KEY com: openssl rand -hex 32

npx supabase login
npx supabase link --project-ref <seu-project-ref>
npx supabase db push   # aplica todas as migrations em supabase/migrations/

npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). Crie o primeiro usuário
admin com o script abaixo antes de logar pela primeira vez.

## Scripts utilitários

Rodam com `node --env-file=.env.local scripts/<nome>.mjs` (precisam de
`NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` no `.env.local`).

- **`scripts/create-admin.mjs`** — cria (ou promove) um usuário administrador.
  ```bash
  node --env-file=.env.local scripts/create-admin.mjs admin@clinica.com "senha-forte" "Nome Completo"
  ```
- **`scripts/prepare-production.mjs`** — limpa dados de demonstração/teste do
  banco antes da entrega ao cliente, preservando estrutura, migrations,
  policies, triggers, buckets e a conta do administrador informada. Roda em
  modo dry-run por padrão (só mostra o que seria removido); use `--yes` para
  executar de fato.
  ```bash
  node --env-file=.env.local scripts/prepare-production.mjs admin@clinica.com          # dry-run
  node --env-file=.env.local scripts/prepare-production.mjs admin@clinica.com --yes    # executa
  ```

## Banco de dados e migrations

Migrations vivem em `supabase/migrations/`, numeradas sequencialmente
(`0001_init.sql`, `0002_...`, ...). O projeto está linkado a um projeto
Supabase remoto via `supabase/config.toml` — não há stack local via Docker
(`supabase start`) em uso.

**Checklist para aplicar migrations em produção:**

1. Escreva a migration como um novo arquivo `NNNN_descricao.sql` (próximo
   número sequencial). Nunca edite uma migration já aplicada.
2. Revise o SQL manualmente antes de aplicar — principalmente mudanças de RLS
   (`USING`/`WITH CHECK`) e de constraints (`ON DELETE CASCADE` vs `RESTRICT`
   têm consequências bem diferentes; confirme nomes exatos de constraint via
   `information_schema`/`pg_constraint` antes de alterar uma existente, nunca
   assuma o nome).
3. Aplique com `npx supabase db push` (pede confirmação, lista as migrations
   pendentes antes de aplicar).
4. **Se o histórico do CLI sair de sincronia com o banco remoto** (migration
   aplicada manualmente ou por outro caminho, e o CLI não reconhece) — isso já
   aconteceu neste projeto — o sintoma é `db push` reclamar de migration já
   aplicada ou tentar reaplicar algo que já existe. Resolva com:
   ```bash
   npx supabase migration repair <version> --status applied
   ```
   e confirme depois com uma leitura read-only (`npx supabase db query --linked --file <consulta.sql>`).
5. Nunca rode `supabase db reset` contra o projeto remoto de produção — ele
   recria o banco do zero a partir das migrations, descartando todos os dados.

## Deploy em produção

```bash
npm run build
pm2 start ecosystem.config.js
pm2 save        # persiste a lista de processos para sobreviver a reboot
```

Para atualizar depois de um deploy novo:

```bash
git pull
npm install                 # se houver mudança de dependências
npx supabase db push        # aplica migrations pendentes ANTES do restart
npm run build
pm2 restart clinicazoe
```

`ecosystem.config.js` fixa `instances: 1` — não é um valor de tuning, é um
requisito: rate-limit e outros caches do processo (`src/lib/rate-limit.ts`)
são em memória e por processo, então rodar em modo cluster multiplicaria os
limites reais por instância sem nenhum aviso.

**Depois de todo deploy, purgue o cache da CDN da Hostinger** — hPanel →
site → **Desempenho → CDN → "Limpar cache"**. O domínio fica atrás da hCDN
da própria Hostinger, que respeita o `Cache-Control: s-maxage=31536000` das
rotas estáticas do Next literalmente (sem entender `stale-while-revalidate`).
Sem o purge manual, o `pm2 restart` atualiza o servidor de origem mas
visitantes continuam recebendo a resposta em cache antiga por até 1 ano —
já aconteceu (24/08/2026): produção com o build novo no ar, mas mobile no
PageSpeed Insights continuava refletindo a versão anterior até a CDN ser
purgada.

## CI/CD

Não há workflow de CI configurado hoje (`.github/workflows` não existe).
Recomendado, quando for priorizado: um workflow simples disparado em push/PR
rodando `npm run lint`, `npx tsc --noEmit` e `npm run build` — pega erros de
tipo/lint/build antes do merge, sem precisar de infraestrutura extra (não
depende de acesso ao banco Supabase, então roda sem segredos adicionais).

## Estrutura do projeto

- `src/app/` — rotas (App Router). Pastas com `_` no início são privadas/excluídas do roteamento.
- `src/modules/` — lógica de domínio (queries, Server Actions, componentes) organizada por área (agenda, pacientes, financeiro, IA, etc.).
- `src/lib/` — utilitários compartilhados (client Supabase, rate-limit, auth).
- `supabase/migrations/` — todo o schema, RLS e triggers do banco, em ordem sequencial.
