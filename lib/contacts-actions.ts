"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { untypedDb } from "@/lib/supabase/untyped";
import { getCurrentRole, canManageUsers } from "@/lib/permissions";
import { sendOrgInvite, type InviteRole } from "@/lib/invite-core";

/* ─────────────────────────────────────────────────────────────
 * Contatos (public.contacts) — agenda de pessoas da organização
 * importada do Diário de Obra. RLS: members leem, admins gerenciam.
 * Aqui ficam apenas as ações de escrita (padrão requireAdmin).
 * ───────────────────────────────────────────────────────────── */

export type ContactCategory = "admin" | "equipe" | "cliente";

export type ContactRow = {
  id: string;
  organization_id: string;
  name: string;
  email: string | null;
  role_label: string | null;
  category: ContactCategory;
  active: boolean;
  profile_id: string | null;
  source: string | null;
  created_at: string | null;
};

function back(params: Record<string, string>): never {
  const qs = new URLSearchParams(params).toString();
  redirect(`/usuarios${qs ? `?${qs}` : ""}`);
}

/** Ativa/desativa um contato. Apenas owner/admin da organização. */
export async function toggleContactActive(formData: FormData) {
  const id = typeof formData.get("contact_id") === "string" ? (formData.get("contact_id") as string).trim() : "";
  const nextActive = formData.get("next_active") === "true";

  if (!id) back({ err: "Contato inválido." });

  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const role = await getCurrentRole();
  if (!canManageUsers(role)) {
    back({ err: "Apenas owners e administradores podem gerenciar contatos." });
  }

  const db = untypedDb(supabase);
  const { error } = await db
    .from("contacts")
    .update({ active: nextActive })
    .eq("id", id);

  if (error) {
    back({ err: `Falha ao atualizar o contato: ${error.message}` });
  }

  revalidatePath("/usuarios");
  back({ msg: nextActive ? "Contato reativado." : "Contato desativado." });
}

/* ─────────────────────────────────────────────────────────────
 * Convite real a partir de um contato da agenda.
 * Mapeia a categoria do contato para o papel da organização e
 * reusa o núcleo compartilhado (lib/invite-core.ts): upsert em
 * pending_invites + magic link. Reenviar = chamar de novo
 * (o upsert renova o registro e o Supabase manda outro link).
 * ───────────────────────────────────────────────────────────── */

const CATEGORY_TO_ROLE: Record<ContactCategory, InviteRole> = {
  admin: "admin",
  equipe: "engineer",
  cliente: "viewer",
};

type ContactInviteRow = Pick<
  ContactRow,
  "id" | "organization_id" | "name" | "email" | "category"
>;

/** Envia (ou reenvia) o convite de acesso para um contato. Apenas owner/admin. */
export async function conviteContato(formData: FormData) {
  const id =
    typeof formData.get("contact_id") === "string"
      ? (formData.get("contact_id") as string).trim()
      : "";
  if (!id) back({ err: "Contato inválido." });

  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const role = await getCurrentRole();
  if (!canManageUsers(role)) {
    back({ err: "Apenas owners e administradores podem convidar usuários." });
  }

  const db = untypedDb(supabase);
  const { data: contact } = await db
    .from<ContactInviteRow>("contacts")
    .select("id, organization_id, name, email, category")
    .eq("id", id)
    .maybeSingle();

  if (!contact) back({ err: "Contato não encontrado." });
  const email = contact.email?.trim().toLowerCase() ?? "";
  if (!email || !email.includes("@")) {
    back({ err: `${contact.name} não tem um e-mail válido cadastrado.` });
  }

  // Garante que o contato pertence à organização ativa do admin.
  const { data: profR } = await supabase
    .from("profiles").select("default_org_id").eq("id", user.id).maybeSingle();
  const orgId =
    (profR as { default_org_id?: string | null } | null)?.default_org_id ?? null;
  if (!orgId || orgId !== contact.organization_id) {
    back({ err: "Este contato não pertence à sua organização ativa." });
  }

  const inviteRole: InviteRole = CATEGORY_TO_ROLE[contact.category] ?? "viewer";

  const result = await sendOrgInvite(supabase, {
    email,
    fullName: contact.name,
    role: inviteRole,
    organizationId: contact.organization_id,
    invitedBy: user.id,
  });
  if (!result.ok) back({ err: result.error });

  revalidatePath("/usuarios");
  back({ msg: `Convite enviado para ${email}.` });
}
