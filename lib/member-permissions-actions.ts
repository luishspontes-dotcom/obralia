"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { untypedDb } from "@/lib/supabase/untyped";
import { getCurrentRole, canManageUsers } from "@/lib/permissions";
import { normalizeMatrix } from "@/lib/member-permissions";

function asString(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v : "";
}

/**
 * Salva a matriz de permissoes, cargo, perfil e as obras que o usuario pode
 * acessar (Fase A: armazenamento + UI; sem alterar RLS).
 */
export async function saveMemberAccess(formData: FormData): Promise<void> {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado.");

  const role = await getCurrentRole();
  if (!canManageUsers(role)) throw new Error("Sem permissão para gerenciar usuários.");

  const { data: profileR } = await supabase
    .from("profiles").select("default_org_id").eq("id", user.id).maybeSingle();
  const orgId = (profileR as { default_org_id?: string } | null)?.default_org_id;
  if (!orgId) throw new Error("Sem organização ativa.");

  const profileId = asString(formData.get("profileId"));
  if (!profileId) throw new Error("Usuário inválido.");

  const jobTitle = asString(formData.get("job_title")).trim() || null;
  const profileLabel = asString(formData.get("profile_label")).trim() || null;

  let matrix: unknown = {};
  try { matrix = JSON.parse(asString(formData.get("permissions_json")) || "{}"); } catch { matrix = {}; }
  const permissions = normalizeMatrix(matrix);

  let siteIds: string[] = [];
  try {
    const parsed = JSON.parse(asString(formData.get("site_ids_json")) || "[]");
    if (Array.isArray(parsed)) siteIds = parsed.filter((x): x is string => typeof x === "string");
  } catch { siteIds = []; }

  const admin = createAdminSupabase();

  // 1) Atualiza permissoes / cargo / perfil no vinculo da organizacao.
  const { error: upErr } = await admin
    .from("organization_members")
    .update({ permissions, job_title: jobTitle, profile_label: profileLabel } as never)
    .eq("organization_id", orgId)
    .eq("profile_id", profileId);
  if (upErr) throw new Error(upErr.message);

  // 2) Substitui o acesso por obra (apaga os atuais e insere os selecionados).
  const udb = untypedDb(admin);
  await udb
    .from("member_site_access")
    .delete()
    .eq("organization_id", orgId)
    .eq("profile_id", profileId);

  if (siteIds.length > 0) {
    const rows = siteIds.map((siteId) => ({
      organization_id: orgId,
      profile_id: profileId,
      site_id: siteId,
    }));
    const { error: insErr } = await udb.from("member_site_access").insert(rows);
    if (insErr) throw new Error(insErr.message);
  }

  revalidatePath("/usuarios");
  revalidatePath(`/usuarios/${profileId}`);
}
