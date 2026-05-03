# Reconciliacao da importacao - 2026-05-03

Escopo: auditoria interna autenticada da organizacao Meu Viver Construtora no
Supabase/Obralia. Este documento nao substitui uma comparacao linha a linha
contra exportacoes atuais do Diario de Obra, ClickUp e Asana.

## Resultado

A importacao esta consistente internamente e nao ha evidencia de que o excesso
contra a meta historica seja causado por duplicidade de chave externa.

Totais encontrados:

- Obras: 29
- Itens WBS: 4.562
- RDOs: 1.132
- Atividades em RDO: 3.599
- Mao de obra em RDO: 4.310
- Equipamentos em RDO: 66
- Midias: 11.284

## Integridade relacional

Nao foram encontrados registros orfaos:

- WBS sem obra: 0
- RDO sem obra: 0
- Atividade sem RDO: 0
- Atividade com WBS inexistente: 0
- Mao de obra sem RDO: 0
- Equipamento sem RDO: 0
- Midia sem obra: 0
- Midia com RDO inexistente: 0
- Midia com WBS inexistente: 0

## Chaves externas

Duplicidades por chave externa:

- Obras: 0
- WBS: 0
- RDOs: 0
- Midias: 0

Cobertura de origem:

- Obras: 29 com origem `import`; 25 com `external_id`, 4 sem `external_id`.
- WBS: 4.562 com origem `import`; 1.134 com `external_id`, 3.428 sem `external_id`.
- RDOs: 1.129 com origem `import` e `external_id`; 3 com origem `diario_de_obra` e `external_id`.
- Midias: 11.239 com origem `import` sem `external_id`; 45 com origem `diario_de_obra` sem `external_id`.

## Candidatos que exigem cuidado

Estes pontos nao devem ser apagados automaticamente sem comparar com a fonte:

- 3 grupos de RDOs na mesma obra e mesma data, mas sem duplicidade de numero de
  RDO. Podem ser RDOs distintos emitidos no mesmo dia.
- 22 grupos de atividades exatamente repetidas no mesmo RDO, com 44 linhas no
  total e 22 linhas excedentes potenciais. Podem ser duplicidade real ou linhas
  repetidas validas no Diario.
- 436 grupos de WBS com mesmo pai, codigo e nome, gerando 690 linhas excedentes
  potenciais. Como 3.428 WBS nao possuem `external_id`, a limpeza automatica e
  arriscada: uma fusao pode quebrar hierarquia, historico ou atividades ligadas.

## Conclusao

O "mais que a meta" vem principalmente de a meta historica ser menor que a base
importada atual. A base esta integra internamente: nao ha registros orfaos,
duplicidade por chave externa, duplicidade de midia por caminho ou duplicidade
de RDO por numero na mesma obra.

Para afirmar 100% contra os sistemas originais, o proximo passo e uma
reconciliacao externa por exportacao/API:

- Diario de Obra: obras, RDOs, fotos, videos e anexos.
- ClickUp: tarefas/listas/status/datas/responsaveis.
- Asana: projetos/tarefas apenas se for fonte oficial.

Sem essa comparacao externa, a acao segura e manter os dados e tratar os grupos
acima como candidatos, nao como erro confirmado.
