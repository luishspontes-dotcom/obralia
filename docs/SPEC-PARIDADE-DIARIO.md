# SPEC DE PARIDADE — cópia fiel do Diário de Obra (capturado ao vivo, logado, 10/06/2026)

Fonte: web.diariodeobra.app, conta MEU VIVER. Esta spec é a verdade — implementar literalmente.

## TEMA GLOBAL
- Header: indigo `#3F51B5` (Material Indigo 500), texto branco; aba ativa = overlay `rgba(0,0,0,0.2)`
- Botão ADICIONAR: `#FFAB02` texto branco, ícone +, CAIXA ALTA; contextual (na tela Obras = "Adicionar Obra", em Relatórios = adicionar relatório)
- Fonte: Arial/sans 14px; títulos de painel laranja `#FF6F00` (números dos contadores idem)
- Ícones: Material Icons (print, edit, subject, person, groups, construction, warning, check_box, style, apartment, paid, content_copy, home, arrow_back)
- Botões de ação: Imprimir = cinza com 🖨; Editar = VERMELHO com ✏; excluir = ✕ azul; links azuis `#2196F3`

## TOPO (ordem): [Nome da empresa] | Obras | Relatórios(→ notificações) | Análise de dados ▾ | Cadastros ▾ | PT ▾ | +ADICIONAR | avatar+nome+email ▾

## LISTA DE OBRAS (/obras)
- "Obras (55)" + toggle ≡ lista/grid + Pesquisa + select "Todas as obras"(grupos) + "Todos os status"
- Grid 5 col: capa grande; badge status AZUL "Em andamento" sobre a capa (canto sup esq); abaixo da capa: 📋 N · 📷 N · ▶ N; nome da obra
- Ordem: ALFABÉTICA

## OBRA → sidebar (ordem): [capa] Visão geral · Lista de tarefas (badge azul N) · Relatórios (badge cinza N) · Filtro de busca · ⚙ Editar obra
Rotas extras da obra: galeria (Fotos), vídeos, atividades

## OBRA → VISÃO GERAL (ordem):
1. 6 contadores: Relatórios · Atividades · Ocorrências · Comentários · Fotos · Vídeos (número laranja + ícone)
2. 2 colunas: "Relatórios recentes" (tabela Data|Nº|Status badge verde Aprovado|Modelo|📷N, 7 linhas, data DESC, "Ver tudo") | "Fotos recentes" (grade 4×3, "Ver tudo")
3. "Informações da obra" (+Editar): Status badge azul · Nº contrato · barra "Prazo decorrido NN%" azul · Endereço · Prazo contratual/decorrido/a vencer (dias) · Responsável · Cliente · Data início · Previsão de término

## OBRA → RELATÓRIOS:
- "Relatórios (30)" + select "Todos os relatórios" + intervalo dd/mm/aaaa até dd/mm/aaaa + botão busca azul 🔍
- Painel: Pesquisa + select "Ordem decrescente" + Imprimir cinza
- Tabela: Data(link azul) | Nº(link) | Status(badge verde) | 📋 Modelo | 📷 N | ações 🖨 ✏ ✕ (azuis)

## RDO → VISUALIZAR (/relatorios/{id}) — ordem do documento:
- Header: ← "Visualizar relatório: dd/mm/aaaa n° N"
- "Informações do relatório" + botões: [subject] [🖨 Imprimir cinza] [✏ Editar VERMELHO]
- Documento (tabela com bordas, badge Aprovado acima):
  1. Cabeçalho: logo da construtora central | Relatório n°, Data, **Dia da semana**, N° do contrato | Obra, Endereço, Cliente, Responsável | Prazo contratual/decorrido/a vencer (dias)
  2. Clima: linhas Manhã/Tarde, colunas Tempo (ícone+texto) e Condição
  3. Mão de obra (N) · 4. Equipamentos (N) · 5. Atividades (N) com "100% Concluída" à direita · 6. Ocorrências (N) · 7. Comentários (N) · 8. Fotos (N) grade · 9. Vídeos (N) · 10. Anexos (N) · 11. Assinatura ×2 (lado a lado)
- Rodapé: ← Anterior dd/mm/aaaa (navegação entre RDOs) · "Criado por: X (data hora)" · "Última modificação: Y (data hora)" · "Log de edições (N) Visualizações (N)" · botões Imprimir/Editar repetidos

## OBRA → LISTA DE TAREFAS:
- Header + botões: [≡ Reordenar cinza] [☁ Importar VERMELHO] [+ Adicionar AZUL]
- Painel: Pesquisa + select "Todas as tarefas" + checkboxes "Exibir somente as etapas"/"Ocultar etapas concluídas" + Imprimir
- 5 contadores: Total · Não iniciada · Em andamento · Concluída · % Realizado (laranja)
- EAP numerada: etapa "1.0 Serviços Preliminares" (negrito, fundo cinza, % 100.00% à direita) → filhas "1.1 ..." com "1 vb", % com barra de progresso VERDE, ações ✏ ✕ azuis

## ANÁLISE DE DADOS ▾ (ordem do submenu): Visão geral · Relatórios criados · Aguardando aprovação · Lista de tarefas · Fotos (23.770) · Vídeos (124) · Anexos (9) · Mão de obra (histórico) · Equipamentos (histórico)

## CADASTROS ▾ (ordem): Meu perfil ─ Assinatura · Empresa · Usuários (login de acesso) 45 ─ Grupos de obra 1 · Modelos de relatórios 1 · Mão de obra 16 · Equipamentos 15 · Tipos de ocorrências 11 · Checklist

## USUÁRIOS: agrupado "Administradores (2)" / "Personalizados (9)" / "Cliente Obra (34)", linha = avatar iniciais · nome · email · cargo · badge Ativo · content_copy. Filtros: Todos os status · Todos os perfis. Botão "person Adicionar Usuário".

## MOBILE (app nativo de referência): bottom tabs global [Obras · Relatórios · ＋FAB laranja · Análise · Menu]; na obra [Visão geral · Lista de tarefas · Relatórios · Menu]. Web responsivo: topo compacto "RDO" + grid 2 colunas.
