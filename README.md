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
