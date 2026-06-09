"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { untypedDb } from "@/lib/supabase/untyped";
import { VISIBLE_SOURCE_PROVIDERS } from "@/lib/rdo-source-scope";
import { getCurrentRole, canManageUsers } from "@/lib/permissions";

export type ShareLinkRow = {
  id: string;
  token: string;
  label: string | null;
  created_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
};

function asString(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

async function requireAdmin() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const role = await getCurrentRole();
  if (!canManageUsers(role)) {
    throw new Error("Apenas administradores podem gerenciar links do portal do cliente.");
  }
  return { supabase, user };
}

/**
 * Cria um link público do portal do cliente para uma obra.
 * Descobre o organization_id da obra e insere em share_links
 * (o token é gerado pelo default do banco).
 */
export async function createShareLink(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const siteId = asString(formData.get("siteId"));
  const label = asString(formData.get("label")) || null;
  if (!siteId) throw new Error("siteId obrigatório");

  const { data: siteRaw } = await supabase
    .from("sites")
    .select("id, organization_id")
    .eq("id", siteId)
    .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
    .maybeSingle();
  const site = siteRaw as { id: string; organization_id: string } | null;
  if (!site) throw new Error("Obra não encontrada");

  const db = untypedDb(supabase);
  const { data: inserted, error } = await db
    .from<{ token: string }>("share_links")
    .insert({
      organization_id: site.organization_id,
      site_id: siteId,
      label,
      created_by: user.id,
    })
    .select("token")
    .single();
  if (error || !inserted) throw new Error(error?.message ?? "Falha ao criar link");

  revalidatePath(`/obras/${siteId}`);
}

/** Revoga um link (seta revoked_at) — o portal deixa de abrir imediatamente. */
export async function revokeShareLink(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = asString(formData.get("id"));
  const siteId = asString(formData.get("siteId"));
  if (!id) throw new Error("id obrigatório");

  const db = untypedDb(supabase);
  const { error } = await db
    .from("share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);

  if (siteId) revalidatePath(`/obras/${siteId}`);
}
