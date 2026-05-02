# Auditoria Obralia / Meu Viver - 2026-05-02

## Resumo executivo

O projeto e um SaaS multi-tenant de gestao de obras, RDOs, fotos, tarefas/EAP, comentarios, convites e integracoes externas. A base tecnica atual e Next.js 15, React 19, Supabase Auth/Postgres/Storage/Realtime e Vercel.

O sistema compila sem ignorar erros de TypeScript, passa lint, contrato de schema, build de producao e `npm audit` com 0 vulnerabilidades conhecidas. As correcoes desta auditoria endureceram controle de escrita, URLs de midia privada, headers de seguranca, healthcheck e respostas de erro.

Nao e correto afirmar, com a evidencia disponivel localmente, que ClickUp e Diario de Obras estao 100% sincronizados de forma continua. Os relatorios historicos afirmam importacao de 26 obras, 1.129 RDOs, 10.968 fotos e 956 itens WBS, mas o Vercel Production nao possui `CLICKUP_API_TOKEN`, `DIARIO_API_TOKEN`, `DIARIO_AUTH_TOKEN`, `DIARIO_EMAIL` ou `DIARIO_PASSWORD`. Isso aponta para importacao pontual no banco, nao para sincronizacao ativa.

## Evidencia confirmada

- Repositorio GitHub em uso: `luishspontes-dotcom/obralia`.
- Vercel Production tem somente `NEXT_PUBLIC_APP_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Variaveis esperadas para conectores estao documentadas e usadas na tela de integracoes: `app/(app)/configuracoes/integracoes/page.tsx:53`.
- A tela de integracoes calcula contagens reais via Supabase por organizacao: `app/(app)/configuracoes/integracoes/page.tsx:111`.
- O schema tem fundacao de integracoes e auditoria: `supabase/migrations/20260501182000_external_sync_foundation.sql`.
- Arquivos locais de ambiente estao ignorados pelo Git: `.gitignore:47`.

## Achados corrigidos

### SEC-001 - Build de producao nao deve ignorar erros de TypeScript

Severidade: Alta.

Impacto: permitir deploy mesmo com erro de tipo reduz a confiabilidade do sistema e pode esconder quebras em rotas protegidas, RLS, formularios e integracoes.

Correcao: removido `typescript.ignoreBuildErrors` do `next.config.ts` e validado `npm run typecheck` + `npm run build`.

### SEC-002 - Headers globais de seguranca ausentes

Severidade: Alta.

Impacto: sem CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy` e `Permissions-Policy`, o app fica mais exposto a clickjacking, abuso de recursos do navegador e XSS com maior raio de dano.

Correcao: headers globais adicionados em `next.config.ts:24`, com `poweredByHeader: false` em `next.config.ts:26`.

### SEC-003 - Midia interna nao deve ser exposta por URL publica

Severidade: Alta.

Impacto: fotos, videos e anexos de obra podem conter dados de cliente, endereco, detalhes construtivos e EXIF. Bucket privado precisa servir midia por URL assinada.

Correcao: midia interna agora passa por assinatura server-side em `lib/supabase/media-url.ts:41`. Acoes de upload usam caminhos tenant-aware em `lib/rdo-actions.ts:105`.

### SEC-004 - Acoes de escrita precisavam de autorizacao por obra/organizacao

Severidade: Alta.

Impacto: esconder botoes no frontend nao basta. Mutacoes de RDO, obra, tarefa, comentario e midia precisam validar permissao no servidor.

Correcao: `requireWritableSite`, `requireWritableRdo` e `requireWritableTask` foram centralizados em `lib/rdo-actions.ts:41`.

### SEC-005 - API de convite retornava erro interno ao usuario

Severidade: Media.

Impacto: mensagens brutas do banco/auth podem revelar detalhes operacionais.

Correcao: respostas da API agora sao genericas, mantendo detalhe apenas no log server-side: `app/api/invites/route.ts:78`.

## Riscos remanescentes

### RISK-001 - Sincronizacao ClickUp/Diario nao esta comprovada como ativa

Severidade: Alta operacional.

Evidencia: Vercel Production nao tem as credenciais dos conectores. O codigo apenas exibe estado/contagem e fundacao de `external_accounts`/`sync_runs`, mas nao ha worker/cron/API ativa que rode backfill continuo.

Acao recomendada: decidir se o produto precisa de sincronizacao continua. Se sim, adicionar credenciais server-only, criar job controlado de backfill/sync, gravar `sync_runs` e comparar contagens contra fonte.

### RISK-002 - Fotos legadas externas podem continuar publicas

Severidade: Media.

Evidencia: `createSignedMediaUrl` assina apenas paths internos do bucket; URLs externas `http(s)` sao preservadas em `lib/supabase/media-url.ts:46`.

Acao recomendada: se as 10.968 fotos importadas estiverem em CDN externa do Diario, migrar objetos para Supabase Storage privado e trocar `storage_path` para paths internos.

### RISK-003 - Auditoria exata de dados depende de acesso autenticado ao banco

Severidade: Media.

Evidencia: `SUPABASE_SERVICE_ROLE_KEY` existe no Vercel Production, mas nao esta disponivel localmente. Sem service role utilizavel ou login admin, nao da para rodar comparacao registro-a-registro entre Supabase, ClickUp e Diario.

Acao recomendada: rodar uma auditoria autenticada de contagens por provider (`sites`, `wbs_items`, `daily_reports`, `media`, `sync_runs`) e salvar o resultado em `sync_runs` com `scope='audit'`.

## Validacao local

- `npm run typecheck`: passou.
- `npm run lint`: passou.
- `npm run schema:check`: passou.
- `npm audit`: 0 vulnerabilidades.
- `npm run build`: passou com Next.js 15.5.15.
