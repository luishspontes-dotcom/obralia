"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { untypedDb } from "@/lib/supabase/untyped";
import { getCurrentRole, canManageUsers } from "@/lib/permissions";
import { normalizePhone } from "@/lib/whatsapp/evolution";

const PAGE_PATH = "/configuracoes/whatsapp";

function asString(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

async function requireAdmin() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const role = await getCurrentRole();
  if (!canManageUsers(role)) {
    throw new Error("Apenas administradores podem gerenciar o WhatsApp da obra.");
  }
  return { supabase, user };
}

/** Cadastra um número autorizado a alimentar RDOs via WhatsApp. */
export async function addWhatsappSender(formData: FormData) {
  const { supabase, user } = await requireAdmin();

  const phone = normalizePhone(asString(formData.get("phone")));
  const displayName = asString(formData.get("display_name")) || null;
  const defaultSiteId = asString(formData.get("default_site_id")) || null;

  if (phone.length < 10 || phone.length > 15) {
    throw new Error("Telefone inválido. Use o formato com DDI e DDD, ex: 5541999998888.");
  }

  const { data: profileR } = await supabase
    .from("profiles").select("default_org_id").eq("id", user.id).maybeSingle();
  const orgId = (profileR as { default_org_id?: string } | null)?.default_org_id;
  if (!orgId) throw new Error("Sem organização ativa.");

  const db = untypedDb(supabase);
  const { error } = await db.from("whatsapp_senders").insert({
    organization_id: orgId,
    phone,
    display_name: displayName,
    default_site_id: defaultSiteId,
    active: true,
  });
  if (error) {
    throw new Error(
      error.message.includes("duplicate")
        ? "Esse telefone já está cadastrado."
        : `Falha ao cadastrar: ${error.message}`
    );
  }

  revalidatePath(PAGE_PATH);
}

/** Ativa/desativa um número (mensagens de números inativos são ignoradas). */
export async function toggleWhatsappSender(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = asString(formData.get("id"));
  const nextActive = asString(formData.get("next_active")) === "true";
  if (!id) throw new Error("id obrigatório");

  const db = untypedDb(supabase);
  const { error } = await db.from("whatsapp_senders").update({ active: nextActive }).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(PAGE_PATH);
}

/** Atualiza a obra padrão de um número. */
export async function updateWhatsappSenderSite(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = asString(formData.get("id"));
  const defaultSiteId = asString(formData.get("default_site_id")) || null;
  if (!id) throw new Error("id obrigatório");

  const db = untypedDb(supabase);
  const { error } = await db.from("whatsapp_senders").update({ default_site_id: defaultSiteId }).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(PAGE_PATH);
}

/** Remove um número autorizado. */
export async function removeWhatsappSender(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = asString(formData.get("id"));
  if (!id) throw new Error("id obrigatório");

  const db = untypedDb(supabase);
  const { error } = await db.from("whatsapp_senders").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(PAGE_PATH);
}
