# obralia/sistema

> **Obralia** — sistema operacional da obra. SaaS multi-tenant para construtoras de alto padrão.

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind v3** + tokens do design system Obralia
- **Supabase** (Postgres + Auth + Storage + Realtime)
- **Vercel** para hospedagem
- **Inter** + **Lora** para tipografia

## Setup local

```bash
# 1. Clone
git clone git@github.com:obralia-com-br/sistema.git
cd sistema

# 2. Instale (use pnpm de preferência)
npm install
# ou: pnpm install

# 3. Configure variáveis
cp .env.local.example .env.local
# Edite .env.local com as chaves reais (peça ao Luis)

# 4. Rode
npm run dev
# abre http://localhost:3000
```

## Qualidade local

```bash
npm run typecheck
npm run lint
npm run schema:check
npm run build
npm audit --audit-level=moderate
```

O deploy não deve ignorar TypeScript nem lint. Se qualquer comando acima falhar,
corrija antes de mandar para `main`.

## Estrutura

```
app/
  (auth)/login/         # tela de login (magic link)
  auth/callback/        # callback do Supabase auth
  (app)/                # área autenticada (layout shell)
    inicio/             # home + caixa de entrada
  layout.tsx            # root layout (fontes globais)
  globals.css           # tokens de design system

components/
  layout/Rail, Sidebar, Topbar
  ui/                   # primitives

lib/supabase/
  client.ts             # cliente browser
  server.ts             # cliente server (RSC + Route Handlers)

middleware.ts           # refresh de sessão
```

## Variáveis de ambiente em produção

Configure no Vercel (Production + Preview + Development):

| Var | Origem |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project settings |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase API keys (publishable) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase API keys (server-only; reserve para rotas administrativas; NUNCA exponha no client) |
| `NEXT_PUBLIC_APP_URL` | `https://www.obralia.com.br` em Production |
| `CLICKUP_API_TOKEN` | Token API do ClickUp para backfill/sync de cronogramas e atividades |
| `ASANA_ACCESS_TOKEN` | Personal Access Token/OAuth token do Asana para auditoria/backfill de projetos e tarefas |
| `DIARIO_API_TOKEN` / `DIARIO_AUTH_TOKEN` | Token do Diário de Obras, quando disponível |
| `DIARIO_EMAIL` / `DIARIO_PASSWORD` | Fallback para sessão autenticada do Diário de Obras |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Sentry project settings (opcional; ativa captura de erros server/client) |
| `SENTRY_TRACES_SAMPLE_RATE` / `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | Amostragem de performance do Sentry; padrão recomendado inicial `0.05` |

## Testes E2E

```bash
npm run build
npm run test:e2e
```

Os smoke tests anônimos rodam sempre. O fluxo autenticado roda quando
`E2E_AUTH_EMAIL` e `E2E_AUTH_PASSWORD` estiverem configurados no ambiente ou
nos secrets do GitHub.

## Banco

O schema versionado fica em [`supabase/migrations`](./supabase/migrations).
Depois de vincular o projeto Supabase, aplique com:

```bash
npx supabase link --project-ref bhhscygbhaqyewejlgug
npx supabase db push
```

## Operação

- Healthcheck público: `GET /api/health`
- O healthcheck valida app, variáveis públicas, `SUPABASE_SERVICE_ROLE_KEY`, banco e Storage sem retornar segredos.
- Fotos de campo usam upload direto para o bucket privado `media`, com compressão no navegador e RLS por organização/obra.
- Integrações internas: `/configuracoes/integracoes` mostra credenciais esperadas, contas externas e histórico de sincronização por organização.

## Branches

- `main` → deploy production em `https://www.obralia.com.br`
- branches/PRs → preview no Vercel

## Sprint 1 — fundação (concluída)

- [x] Schema multi-tenant + RLS no Supabase
- [x] Storage buckets (media/avatars/exports)
- [x] Auth signup trigger
- [x] Tokens.css completo
- [x] Login com magic link
- [x] Layout shell (Rail + Sidebar + Topbar)
- [x] Tela `/inicio` com saudação e inbox vazia
- [x] Deploy em `https://www.obralia.com.br`

Roadmap completo em [`projeto-v2/docs/03-roadmap.md`](../docs/03-roadmap.md).
