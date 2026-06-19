// Matriz de permissoes por membro (paridade com "Permissoes de acesso" do Diario).
// Fase A: apenas armazenamento/UI. O enforcement no RLS e na app vem na Fase B.

export const PERMISSION_DOMAINS: { key: string; label: string }[] = [
  { key: "cadastros", label: "Cadastros" },
  { key: "obras", label: "Obras" },
  { key: "relatorios", label: "Relatórios" },
  { key: "tarefas", label: "Lista de tarefas" },
  { key: "fotos", label: "Fotos" },
  { key: "medicoes", label: "Medições" },
];

export const PERMISSION_ACTIONS: { key: string; label: string }[] = [
  { key: "ver", label: "Visualizar" },
  { key: "editar", label: "Adicionar / Editar" },
  { key: "excluir", label: "Excluir" },
];

// Perfis de acesso do Diario.
export const PROFILE_LABELS = ["Administrador", "Personalizado", "Cliente Obra"] as const;

export type PermissionMatrix = Record<string, Record<string, boolean>>;

/** Normaliza um JSON solto vindo do banco numa matriz completa (todos os pares preenchidos). */
export function normalizeMatrix(raw: unknown): PermissionMatrix {
  const src = (raw && typeof raw === "object" && !Array.isArray(raw)) ? (raw as Record<string, unknown>) : {};
  const out: PermissionMatrix = {};
  for (const d of PERMISSION_DOMAINS) {
    const row = (src[d.key] && typeof src[d.key] === "object") ? (src[d.key] as Record<string, unknown>) : {};
    out[d.key] = {};
    for (const a of PERMISSION_ACTIONS) {
      out[d.key][a.key] = row[a.key] === true;
    }
  }
  return out;
}
