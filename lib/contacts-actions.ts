"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { untypedDb } from "@/lib/supabase/untyped";
import { getCurrentRole, canManageUsers } from "@/lib/permissions";

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
