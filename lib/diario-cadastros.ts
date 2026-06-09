import { createServerSupabase } from "@/lib/supabase/server";

export type DiarioCadastroUser = {
  external_id?: string | null;
  name?: string | null;
  initials?: string | null;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  avatar_url?: string | null;
  signature_url?: string | null;
  group?: string | null;
  role?: string | null;
  profile_label?: string | null;
  active?: boolean | null;
};

export type DiarioCadastroSnapshot = {
  imported_at?: string | null;
  empresa?: Record<string, unknown> | null;
  usuario_logado?: Record<string, unknown> | null;
  menu_analise_de_dados?: Record<string, unknown> | null;
  menu_cadastros?: Record<string, unknown> | null;
  counts?: Record<string, number> | null;
  cadastros?: {
    usuarios?: DiarioCadastroUser[];
    mao_de_obra?: {
      categorias?: Record<string, unknown>[];
      personalizada?: Record<string, unknown>[];
      padrao?: Record<string, unknown>[];
    };
    equipamentos?: Record<string, unknown>[];
    tipos_ocorrencias?: Record<string, unknown>[];
  };
};

type Profile = { default_org_id: string | null };
type Org = { id: string; name: string };
type ExternalAccount = {
  metadata: unknown;
  last_success_at: string | null;
  status: string;
};

export async function getDiarioCadastroSnapshot(): Promise<{
  activeOrg: Org | null;
  snapshot: DiarioCadastroSnapshot;
  lastSuccessAt: string | null;
  status: string | null;
}> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { activeOrg: null, snapshot: {}, lastSuccessAt: null, status: null };

  const { data: profileRaw } = await supabase
    .from("profiles")
    .select("default_org_id")
    .eq("id", user.id)
    .maybeSingle();
  const profile = profileRaw as Profile | null;

  const { data: orgsRaw } = await supabase.from("organizations").select("id, name");
  const orgs = (orgsRaw ?? []) as Org[];
  const activeOrg = orgs.find((org) => org.id === profile?.default_org_id) ?? orgs[0] ?? null;
  if (!activeOrg) return { activeOrg: null, snapshot: {}, lastSuccessAt: null, status: null };

  const { data: accountRaw } = await supabase
    .from("external_accounts")
    .select("metadata, last_success_at, status")
    .eq("organization_id", activeOrg.id)
    .eq("provider", "diario_de_obra")
    .ilike("label", "Diario de Obras")
    .order("last_success_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const account = accountRaw as ExternalAccount | null;

  return {
    activeOrg,
    snapshot: (account?.metadata ?? {}) as DiarioCadastroSnapshot,
    lastSuccessAt: account?.last_success_at ?? null,
    status: account?.status ?? null,
  };
}

export function textValue(row: Record<string, unknown> | null | undefined, keys: string[]): string {
  if (!row) return "-";
  for (const key of keys) {
    const value = getValue(row, key);
    if (value !== null && value !== undefined && value !== "") return String(value);
  }
  return "-";
}

function getValue(row: Record<string, unknown>, path: string): unknown {
  let value: unknown = row;
  for (const part of path.split(".")) {
    if (!value || typeof value !== "object") return null;
    value = (value as Record<string, unknown>)[part];
  }
  return value;
}
