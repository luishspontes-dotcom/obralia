// Permissões de acesso por membro — espelha EXATAMENTE a tela "Permissões de
// acesso" do Diário de Obra. Fase A: armazenamento/UI; enforcement (RLS) na Fase B.

export type PermItem = { key: string; label: string };
export type PermGroup = { key: string; label: string; hint?: string; items: PermItem[] };

// Grupos na mesma ordem e com os mesmos itens do Diário.
export const PERMISSION_GROUPS: PermGroup[] = [
  {
    key: "cadastros",
    label: "Cadastros",
    items: [
      { key: "grupos_de_obras", label: "Grupos de obras" },
      { key: "modelos_de_relatorios", label: "Modelos de relatórios" },
      { key: "mao_de_obra", label: "Mão de obra" },
      { key: "equipamentos", label: "Equipamentos" },
      { key: "tipos_de_ocorrencias", label: "Tipos de ocorrências" },
      { key: "checklist", label: "Checklist" },
    ],
  },
  {
    key: "obras",
    label: "Obras",
    items: [
      { key: "adicionar_editar", label: "Adicionar / Editar" },
      { key: "excluir", label: "Excluir" },
      { key: "anexos_e_documentos", label: "Anexos e documentos" },
    ],
  },
  {
    key: "lista_de_tarefas",
    label: "Lista de tarefas",
    items: [
      { key: "visualizar", label: "Visualizar" },
      { key: "adicionar_editar", label: "Adicionar / Editar" },
      { key: "excluir", label: "Excluir" },
    ],
  },
  {
    key: "relatorio",
    label: "Relatório",
    items: [
      { key: "adicionar_editar", label: "Adicionar / Editar" },
      { key: "aprovar", label: "Aprovar" },
      { key: "excluir", label: "Excluir" },
    ],
  },
  {
    key: "itens_do_relatorio",
    label: "Itens do relatório",
    hint: "Itens que o usuário poderá visualizar / editar no relatório",
    items: [
      { key: "horario_de_trabalho", label: "Horário de trabalho" },
      { key: "condicao_climatica", label: "Condição climática" },
      { key: "mao_de_obra", label: "Mão de obra" },
      { key: "equipamento", label: "Equipamento" },
      { key: "atividade", label: "Atividade" },
      { key: "ocorrencia", label: "Ocorrência" },
      { key: "checklist", label: "Checklist" },
      { key: "controle_de_material", label: "Controle de material" },
      { key: "comentario", label: "Comentário" },
      { key: "foto", label: "Foto" },
      { key: "video", label: "Vídeo" },
      { key: "anexo", label: "Anexo" },
    ],
  },
];

// Perfis de acesso do Diário.
export const PROFILE_LABELS = ["Administrador", "Personalizado", "Cliente Obra"] as const;

export type PermissionMatrix = Record<string, Record<string, boolean>>;

/** Normaliza um JSON solto vindo do banco numa matriz completa (todos os itens preenchidos). */
export function normalizeMatrix(raw: unknown): PermissionMatrix {
  const src = (raw && typeof raw === "object" && !Array.isArray(raw)) ? (raw as Record<string, unknown>) : {};
  const out: PermissionMatrix = {};
  for (const g of PERMISSION_GROUPS) {
    const row = (src[g.key] && typeof src[g.key] === "object") ? (src[g.key] as Record<string, unknown>) : {};
    out[g.key] = {};
    for (const it of g.items) {
      out[g.key][it.key] = row[it.key] === true;
    }
  }
  return out;
}
