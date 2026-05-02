import { createServerSupabase } from "@/lib/supabase/server";

export type OrgRole = "owner" | "admin" | "engineer" | "viewer";

const WRITER_ROLES: OrgRole[] = ["owner", "admin", "engineer"];
const ADMIN_ROLES: OrgRole[] = ["owner", "admin"];

/**
 * Returns the user's role in their default organization.
 * Returns null if the user isn't logged in or has no membership.
 */
export async function getCurrentRole(): Promise<OrgRole | null> {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profileR } = await supabase
    .from("profiles").select("default_org_id").eq("id", user.id).maybeSingle();
  const orgId = (profileR as { default_org_id?: string } | null)?.default_org_id;
  if (!orgId) return null;

  const { data: memberR } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("profile_id", user.id)
    .maybeSingle();
  const role = (memberR as { role?: string } | null)?.role as OrgRole | undefined;
  return role ?? null;
}

export function canWrite(role: OrgRole | null): boolean {
  if (!role) return false;
  return WRITER_ROLES.includes(role);
}

export function canManageUsers(role: OrgRole | null): boolean {
  if (!role) return false;
  return ADMIN_ROLES.includes(role);
}

export function roleLabel(role: OrgRole | null): string {
  switch (role) {
    case "owner":    return "Proprietário";
    case "admin":    return "Administrador";
    case "engineer": return "Engenheiro";
    case "viewer":   return "Visualizador";
    default:         return "—";
  }
}
