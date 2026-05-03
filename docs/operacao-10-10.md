# Operacao 10/10 - Obralia Meu Viver

Este checklist separa o que o codigo ja valida do que depende de acesso externo
ou credenciais de producao.

## Estado minimo para considerar 10/10

- `npm run typecheck` sem erros.
- `npm run lint` sem erros.
- `npm run schema:check` sem erros.
- `npm audit` sem vulnerabilidades conhecidas.
- `npm run build` concluindo com sucesso.
- `npm run test:e2e` com smoke anonimo verde.
- Fluxo autenticado E2E verde com `E2E_AUTH_EMAIL` e `E2E_AUTH_PASSWORD`.
- `/api/health` em producao com `app`, `env`, `serviceRole`, `database` e `storage` verdadeiros.
- `/configuracoes/auditoria` com nota 10/10 para a organizacao ativa.

## Credenciais server-only esperadas

Configurar apenas no Vercel como variaveis server-only:

- `SUPABASE_SERVICE_ROLE_KEY`
- `CLICKUP_API_TOKEN`
- `ASANA_ACCESS_TOKEN`, se Asana continuar no escopo real
- `DIARIO_API_TOKEN` ou `DIARIO_AUTH_TOKEN`
- `DIARIO_EMAIL` e `DIARIO_PASSWORD`, somente se o Diario nao fornecer token estavel
- `SENTRY_DSN`
- `NEXT_PUBLIC_SENTRY_DSN`, se monitoramento client-side for habilitado

Nunca usar prefixo `NEXT_PUBLIC_` para tokens de ClickUp, Asana, Diario ou service role.

## Auditoria de dados

Usar `/configuracoes/auditoria` depois de entrar como `owner` ou `admin`.

Meta historica da Meu Viver:

- 26 obras
- 956 itens WBS
- 1.129 RDOs
- 3.583 atividades em RDO
- 10.968 fotos/midias

A nota so deve ser tratada como 10/10 quando:

- Os totais batem com a meta historica.
- Os registros possuem `external_provider` ou origem `import` rastreavel.
- Existem contas externas cadastradas em `external_accounts`.
- As credenciais server-only de ClickUp e Diario estao configuradas, ou existe
  snapshot de importacao auditada em `sync_runs`.
- Existe ao menos um `sync_runs.status = success`.

Quando o cliente optar por importacao inicial em vez de sincronizacao continua,
registrar `sync_runs.scope = 'audit'` com `stats.type = 'import_snapshot'`.
Isso prova a importacao auditada sem fingir que existe sync continuo.

## Teste autenticado

Antes de liberar para cliente, criar um usuario admin de auditoria e rodar:

```bash
E2E_AUTH_EMAIL="admin@empresa.com" \
E2E_AUTH_PASSWORD="senha-temporaria" \
npm run test:e2e
```

Depois do teste, trocar ou revogar a senha temporaria.

## Validacao externa

Comparar os totais do Obralia contra as fontes:

- Diario de Obras: obras, RDOs, fotos, videos e anexos.
- ClickUp: spaces/folders/listas/tarefas, status, datas e responsaveis.
- Asana: projetos e tarefas apenas se for fonte oficial do cliente.

Sem tokens/API/exportacao das fontes, a auditoria externa fica inconclusiva.

## Operacao segura

- Rotacionar qualquer senha compartilhada por chat.
- Manter logs sem tokens, cookies ou senhas.
- Corrigir `sync_runs` com erro antes de declarar cutover.
- Manter Diario/ClickUp em somente leitura por pelo menos uma semana apos validacao.
- Ativar Sentry antes do cliente operar sozinho.
