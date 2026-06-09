# Auditoria Diario de Obras -> Obralia - 2026-06-09

Escopo: verificacao atual da organizacao `Meu Viver Construtora` no Supabase e QA
local do frontend em desktop/mobile depois da transicao visual para o padrao do
Diario de Obras.

## Resultado do banco

- Obras no banco: 58
- Obras oficiais visiveis do Diario: 55
- Obras legadas excluidas das telas principais: 3 (`AGENDAS (operacional)`,
  `ATA SEMANAL (operacional)`, `MEDICOES (operacional)`)
- RDOs oficiais do Diario: 3.328
- Itens WBS oficiais do Diario: 2.992
- Midias oficiais do Diario: 23.767
- Fotos: 23.634
- Videos: 124
- Anexos: 9
- Acessos/usuarios importados/pendentes: 45

## Capas e fotos

- Obras oficiais com capa: 52 de 55
- Obras oficiais sem capa na importacao atual:
  - `CARMEM E ANDRE`
  - `LAUREM E VOLNEY`
  - `teste`

Essas tres obras nao devem ser tratadas como falha automatica de renderizacao:
elas nao possuem `cover_url` oficial gravado apos a importacao atual.

## Integridade relacional

Auditoria via `scripts/audit/diario-current-audit.mjs`:

- RDO sem obra conhecida: 0
- WBS sem obra conhecida: 0
- WBS com pai ausente: 0
- Midia sem obra conhecida: 0
- Midia com RDO ausente: 0
- Midia com WBS ausente: 0
- Atividade com RDO ausente: 0
- Atividade com WBS ausente: 0
- Mao de obra com RDO ausente: 0
- Equipamento com RDO ausente: 0
- Midia sem `storage_path`: 0
- Duplicidade por `external_provider + external_id`: 0 em obras, RDOs, WBS e midias

## Cadastros Diario

Snapshot atual em `external_accounts` (`Diario de Obras`):

- Usuarios: 45
- Usuarios cliente/obra: 34
- Usuarios administrador: 2
- Usuarios personalizado: 9
- Equipamentos: 15
- Tipos de ocorrencias: 11
- Mao de obra padrao: 13
- Mao de obra personalizada: 3
- Categorias de mao de obra: 3

## Frontend e mobile

Correcoes feitas nesta auditoria:

- Menus do topo controlados por estado React.
- Fecha ao clicar fora.
- Fecha com `Escape`.
- Fecha apos clicar em item de menu.
- Apenas um menu fica aberto por vez.
- Dropdown mobile deixa de ser cortado pela barra horizontal do topo.
- Dropdown mobile fica dentro da viewport.
- Layout interno da obra deixa de expandir para 1210px em viewport de 390px.
- Detalhe da obra e detalhe do orcamento ficam sem overflow horizontal em 390px.

QA local:

- `/cadastros/modelos-relatorios`: sem overlay, menu abre/fecha corretamente.
- `/usuarios`: navegacao por item de menu funcionando.
- `/obras/44444444-4444-4444-4444-0da69295d854`: mobile sem overflow horizontal.
- `/obras/44444444-4444-4444-4444-0da69295d854/orcamento-ia/0f1f7780-9485-4019-8818-bfa2fda3341b`:
  mobile sem overflow horizontal e botao de apagar presente.

## Limite honesto

Esta auditoria confirma consistencia interna do Obralia e da importacao gravada
no Supabase. Ela nao substitui uma reconciliacao linha a linha contra uma nova
exportacao/API externa do Diario de Obras feita no mesmo minuto da auditoria.
