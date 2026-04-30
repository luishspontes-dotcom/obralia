# obralia/sistema

> **Obralia** — sistema operacional da obra. SaaS multi-tenant para construtoras de alto padrão.

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind v3** + tokens do design system Obralia
- **Supabase** (Postgres + Auth + Storage + Realtime + Edge Functions)
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
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase API keys (server-only; necessário para convites de usuários; NUNCA exponha no client) |
| `NEXT_PUBLIC_APP_URL` | `https://www.obralia.com.br` em prod |

## Banco

O schema versionado fica em [`supabase/migrations`](./supabase/migrations).
Depois de vincular o projeto Supabase, aplique com:

```bash
npx supabase link --project-ref bhhscygbhaqyewejlgug
npx supabase db push
```

## Branches

- `main` → deploy production em `app.obralia.app`
- `develop` → deploy staging
- `feature/*` → preview por PR

## Sprint 1 — fundação (em curso)

- [x] Schema multi-tenant + RLS no Supabase
- [x] Storage buckets (media/avatars/exports)
- [x] Auth signup trigger
- [ ] Tokens.css completo
- [ ] Login com magic link
- [ ] Layout shell (Rail + Sidebar + Topbar)
- [ ] Tela `/inicio` com saudação e inbox vazia
- [ ] Deploy em `app.obralia.app`

Roadmap completo em [`projeto-v2/docs/03-roadmap.md`](../docs/03-roadmap.md).
