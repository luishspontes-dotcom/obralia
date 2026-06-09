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
- `OPENAI_API_KEY`, para leitura visual server-only de plantas no Orcamento IA
- `OPENAI_MODEL`, opcional; padrao do codigo: `gpt-5.5`
- `SENTRY_DSN`
- `NEXT_PUBLIC_SENTRY_DSN`, se monitoramento client-side for habilitado

Nunca usar prefixo `NEXT_PUBLIC_` para tokens de ClickUp, Asana, Diario, OpenAI
ou service role.

## Orcamento IA por planta

Para considerar o fluxo de planta 10/10:

- O template default precisa ter 104 itens de `budget_template_items`, derivados
  da planilha de referencia FER E MACIEL.
- O envio de novo estudo deve exigir ao menos uma planta em PDF.
- Com `OPENAI_API_KEY`, o estudo deve registrar `source_summary.plan_analysis.status = analyzed`.
- Sem `OPENAI_API_KEY`, o estudo deve ficar funcional, mas com status
  `missing_key` na leitura da planta e confianca reduzida.
- O total para a referencia FER E MACIEL, usando 424,56 m2 de area construida,
  24,31 m2 de piscina, 3 pavimentos e subsolo, deve fechar em R$ 1.566.669,68.
- Itens de verba fixa devem aparecer como premissa/verba de referencia, nao como
  falha de importacao.

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
