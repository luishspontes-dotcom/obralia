# Testes E2E (Playwright)

Suíte de ponta a ponta do Obrália. Cobre o fluxo crítico: login → obras → RDOs → impressão → formulário de novo RDO.

## Estrutura

| Arquivo | O que cobre | Precisa de login? |
| --- | --- | --- |
| `smoke.spec.ts` | Página de login, redirects de rotas protegidas, headers de segurança, API de health/invites | Parcial (último teste) |
| `auth.spec.ts` | Senha inválida mostra erro; login válido redireciona pra `/inicio` | Sim (faz o próprio login) |
| `obras.spec.ts` | `/obras` lista cards; abrir obra mostra header + sidebar | Sim (storageState) |
| `rdo.spec.ts` | Lista de RDOs com paginação (>50), detalhe (clima/mão de obra/atividades), página de impressão | Sim (storageState) |
| `rdo-form.spec.ts` | `/obras/[id]/rdos/novo` renderiza os cards Dados gerais (horários), Clima, Mão de obra, Equipamentos, Materiais e Atividades — **só asserções de presença, nada é submetido** | Sim (storageState) |
| `auth.setup.ts` | Projeto `setup`: loga 1x e salva o `storageState` compartilhado em `test-results/.auth/user.json` (pasta já ignorada pelo git) | — |
| `support/helpers.ts` | Helpers compartilhados (credenciais, descoberta de obras/RDOs) | — |

### Projetos do Playwright

- `setup` — roda `auth.setup.ts` e grava o storageState (login acontece **uma única vez**).
- `chromium` — testes anônimos ou que exercitam o login (`smoke`, `auth`).
- `chromium-auth` — testes autenticados (`obras`, `rdo`, `rdo-form`); depende do `setup` e reusa a sessão salva.

## Variáveis de ambiente

| Variável | Obrigatória? | Descrição |
| --- | --- | --- |
| `E2E_BASE_URL` | Não | URL de um ambiente já no ar (ex.: deploy na Vercel). Quando definida, o Playwright **não** sobe servidor local. Sem ela, roda `npm run build && npm run test:e2e` contra `http://127.0.0.1:3000`. |
| `E2E_EMAIL` | Para testes autenticados | E-mail do usuário de teste (Supabase Auth). |
| `E2E_PASSWORD` | Para testes autenticados | Senha do usuário de teste. |
| `E2E_AUTH_EMAIL` / `E2E_AUTH_PASSWORD` | Não | Nomes legados — aceitos como fallback de `E2E_EMAIL`/`E2E_PASSWORD`. |
| `PLAYWRIGHT_BASE_URL` | Não | Compat com o fluxo antigo (mantém o webServer local). |

Sem `E2E_EMAIL`/`E2E_PASSWORD`, os testes autenticados são **pulados com mensagem clara** (nada falha).

## Rodando localmente

```bash
# contra um deploy
E2E_BASE_URL=https://seu-deploy.vercel.app \
E2E_EMAIL=usuario@teste.com \
E2E_PASSWORD=... \
npm run test:e2e

# contra build local (precisa de build antes)
npm run build
E2E_EMAIL=... E2E_PASSWORD=... npm run test:e2e

# com navegador visível / modo UI
npm run test:e2e:headed
npm run test:e2e:ui
```

## Secrets do GitHub Actions (job `e2e` opcional)

O job `e2e` do `.github/workflows/ci.yml` **só roda se os três secrets existirem** (um job `e2e-gate` checa a presença — sem secrets, o job é pulado e o CI continua verde). Configure em *Settings → Secrets and variables → Actions*:

| Secret | Valor |
| --- | --- |
| `E2E_BASE_URL` | URL do ambiente a testar (ex.: `https://obralia.vercel.app`) |
| `E2E_EMAIL` | E-mail do usuário de teste |
| `E2E_PASSWORD` | Senha do usuário de teste |

Recomendação: crie um usuário dedicado de QA com papel de leitura/escrita mínimo — os testes **não submetem formulários nem alteram dados** (apenas o login real é executado).

## Pré-requisitos de dados do ambiente alvo

Os specs descobrem as obras dinamicamente (nenhum ID fica hardcoded), mas o ambiente precisa ter:

- pelo menos **1 obra** visível pro usuário de teste (`obras.spec.ts`, `rdo-form.spec.ts`);
- pelo menos **1 obra com RDOs**, e entre os 3 RDOs mais recentes um com **mão de obra e atividades preenchidas** (`rdo.spec.ts`);
- pra exercitar a paginação, **1 obra com mais de 50 RDOs** — senão o teste de paginação é pulado com aviso.
