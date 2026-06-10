"use server";

import { randomInt } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { untypedDb } from "@/lib/supabase/untyped";
import { getCurrentRole, canManageUsers, type OrgRole } from "@/lib/permissions";

/* ─────────────────────────────────────────────────────────────
 * Administração de usuários (apenas owner/admin da organização)
 *  - adminResetPasswordEmail: envia e-mail de redefinição
 *  - adminSetTemporaryPassword: gera senha temporária forte
 *  - adminDeleteUser: exclui o usuário DE VERDADE (auth + profile),
 *    preservando o histórico (RDOs etc. ficam "sem autor")
 * Feedback sempre via redirect para /usuarios?msg=/err=/temp_pw=.
 * ───────────────────────────────────────────────────────────── */

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.obralia.com.br";

function asString(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

const DEFAULT_BACK_PATH = "/usuarios";

/** Caminho de retorno seguro: só aceita path interno (ex.: /cadastros/...). */
function sanitizeNext(v: FormDataEntryValue | null): string {
  const s = typeof v === "string" ? v.trim() : "";
  return s.startsWith("/") && !s.startsWith("//") ? s.split("?")[0] : DEFAULT_BACK_PATH;
}

function back(next: string, params: Record<string, string>): never {
  const qs = new URLSearchParams(params).toString();
  redirect(`${next}${qs ? `?${qs}` : ""}`);
}

type Guard = {
  actorId: string;
  actorRole: OrgRole;
  orgId: string;
  targetRole: OrgRole;
  targetName: string;
};

/**
 * Garante: sessão ativa, ator é owner/admin da org, alvo é membro da MESMA org,
 * alvo não é o próprio ator e (se o alvo for owner) o ator precisa ser owner.
 * Em caso de bloqueio, redireciona para /usuarios?err=... (nunca lança pro client).
 */
async function guardTarget(targetProfileId: string, next: string): Promise<Guard> {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const actorRole = await getCurrentRole();
  if (!canManageUsers(actorRole)) {
    back(next, { err: "Apenas owners e administradores podem gerenciar usuários." });
  }

  if (!targetProfileId) back(next, { err: "Usuário inválido." });
  if (targetProfileId === user.id) {
    back(next, { err: "Você não pode executar esta ação na sua própria conta. Use Configurações para trocar sua senha." });
  }

  const { data: profR } = await supabase
    .from("profiles").select("default_org_id").eq("id", user.id).maybeSingle();
  const orgId = (profR as { default_org_id?: string | null } | null)?.default_org_id ?? null;
  if (!orgId) back(next, { err: "Organização ativa não encontrada." });

  const db = untypedDb(supabase);
  const { data: memberR } = await db
    .from<{ role: string; profiles: { full_name: string } | null }>("organization_members")
    .select("role, profiles(full_name)")
    .eq("organization_id", orgId as string)
    .eq("profile_id", targetProfileId)
    .maybeSingle();
  if (!memberR) {
    back(next, { err: "Usuário não encontrado na sua organização." });
  }
  const targetRole = memberR.role as OrgRole;
  if (targetRole === "owner" && actorRole !== "owner") {
    back(next, { err: "Apenas o owner pode gerenciar a conta de outro owner." });
  }

  return {
    actorId: user.id,
    actorRole: actorRole as OrgRole,
    orgId: orgId as string,
    targetRole,
    targetName: memberR.profiles?.full_name ?? "Usuário",
  };
}

/* ───────── 1. E-mail de redefinição de senha ───────── */

export async function adminResetPasswordEmail(formData: FormData) {
  const next = sanitizeNext(formData.get("next"));
  const profileId = asString(formData.get("profile_id"));
  const email = asString(formData.get("email"));
  const { targetName } = await guardTarget(profileId, next);

  if (!email) {
    back(next, { err: `Não foi possível localizar o e-mail de ${targetName}.` });
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${APP_URL}/auth/callback?next=/configuracoes`,
  });
  if (error) {
    back(next, { err: `Falha ao enviar e-mail de redefinição: ${error.message}` });
  }
  back(next, { msg: `E-mail de redefinição de senha enviado para ${email}.` });
}

/* ───────── 2. Senha temporária ───────── */

const TEMP_PW_WORDS = [
  "obra", "tijolo", "cimento", "laje", "viga", "telhado", "areia", "pedra",
  "ferro", "muro", "janela", "porta", "parede", "piso", "forro", "calha",
  "andaime", "betoneira", "prumo", "nivel", "trena", "rebite", "argamassa",
  "vergalhao", "pilar", "sapata", "alicerce", "reboco", "azulejo", "telha",
  "madeira", "concreto", "estaca", "fundacao", "cobertura", "fachada",
  "escora", "tubo", "fiacao", "quadro", "bloco", "grade", "portao", "rampa",
  "escada", "mezanino", "vidro", "gesso",
] as const;

/** Senha legível: 3 palavras pt capitalizadas + 4 dígitos (ex.: Tijolo-Laje-Prumo-4827). */
function generateTempPassword(): string {
  const pick = () => {
    const w = TEMP_PW_WORDS[randomInt(TEMP_PW_WORDS.length)];
    return w[0].toUpperCase() + w.slice(1);
  };
  const digits = String(randomInt(10000)).padStart(4, "0");
  return `${pick()}-${pick()}-${pick()}-${digits}`;
}

export async function adminSetTemporaryPassword(formData: FormData) {
  const next = sanitizeNext(formData.get("next"));
  const profileId = asString(formData.get("profile_id"));
  const { targetName } = await guardTarget(profileId, next);

  const password = generateTempPassword();
  const admin = createAdminSupabase();
  const { error } = await admin.auth.admin.updateUserById(profileId, { password });
  if (error) {
    back(next, { err: `Falha ao definir senha temporária: ${error.message}` });
  }

  revalidatePath("/usuarios");
  if (next !== DEFAULT_BACK_PATH) revalidatePath(next);
  back(next, { temp_pw: password, temp_user: targetName });
}

/* ───────── 3. Exclusão definitiva ───────── */

/**
 * Colunas que apontam para profiles e devem virar NULL antes da exclusão,
 * preservando o histórico (RDOs, mídias, medições etc. ficam "sem autor").
 */
const PROFILE_FK_COLUMNS: ReadonlyArray<readonly [table: string, column: string]> = [
  ["daily_reports", "created_by"],
  ["daily_reports", "approved_by"],
  ["media", "taken_by"],
  ["wbs_items", "created_by"],
  ["comments", "author_id"],
  ["pending_invites", "invited_by"],
  ["sites", "responsible_id"],
  ["medicoes", "created_by"],
  ["medicoes", "approved_by"],
  ["budgets", "created_by"],
  ["budget_templates", "created_by"],
  ["rdo_templates", "created_by"],
  ["whatsapp_senders", "profile_id"],
  ["ai_estimates", "created_by"],
  ["ai_estimate_files", "uploaded_by"],
  ["external_accounts", "created_by"],
  ["sync_runs", "requested_by"],
  ["share_links", "created_by"],
  ["audit_events", "actor_id"],
];

function isMissingRelation(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("does not exist") || m.includes("schema cache") || m.includes("could not find");
}

function isNotNullViolation(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("not-null") || m.includes("not null") || m.includes("23502");
}

export async function adminDeleteUser(formData: FormData) {
  const next = sanitizeNext(formData.get("next"));
  const profileId = asString(formData.get("profile_id"));
  const { targetName } = await guardTarget(profileId, next);

  const admin = createAdminSupabase();
  const adb = untypedDb(admin);
  let err: string | null = null;

  try {
    // 1. Desvincula de todas as organizações.
    {
      const { error } = await adb
        .from("organization_members").delete().eq("profile_id", profileId);
      if (error) throw new Error(`ao remover vínculos de organização: ${error.message}`);
    }

    // 2. Limpa a org padrão do profile (evita FK pendente durante a limpeza).
    {
      const { error } = await adb
        .from("profiles").update({ default_org_id: null }).eq("id", profileId);
      if (error) throw new Error(`ao limpar organização padrão: ${error.message}`);
    }

    // 3. Anula referências em tabelas de histórico (NÃO apaga o histórico).
    for (const [table, column] of PROFILE_FK_COLUMNS) {
      const { error } = await adb
        .from(table).update({ [column]: null }).eq(column, profileId);
      if (!error) continue;
      if (isMissingRelation(error.message)) continue; // tabela ainda não existe neste ambiente
      if (isNotNullViolation(error.message)) {
        // Coluna obrigatória (ex.: comments.author_id): remove só as linhas do usuário.
        const { error: delErr } = await adb
          .from(table).delete().eq(column, profileId);
        if (delErr && !isMissingRelation(delErr.message)) {
          throw new Error(`ao limpar ${table}.${column}: ${delErr.message}`);
        }
        continue;
      }
      throw new Error(`ao limpar ${table}.${column}: ${error.message}`);
    }

    // 4. Notificações são do próprio usuário: apaga.
    {
      const { error } = await adb
        .from("notifications").delete().eq("recipient_id", profileId);
      if (error && !isMissingRelation(error.message)) {
        throw new Error(`ao apagar notificações: ${error.message}`);
      }
    }

    // 5. Apaga o profile.
    {
      const { error } = await adb.from("profiles").delete().eq("id", profileId);
      if (error) throw new Error(`ao apagar o perfil: ${error.message}`);
    }

    // 6. Apaga o login (auth).
    {
      const { error } = await admin.auth.admin.deleteUser(profileId);
      if (error) throw new Error(`ao apagar o login: ${error.message}`);
    }
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    err = `Falha na exclusão de ${targetName} ${detail}. Algumas etapas podem já ter sido aplicadas (ex.: vínculo removido) — tente novamente para concluir.`;
  }

  revalidatePath("/usuarios");
  if (next !== DEFAULT_BACK_PATH) revalidatePath(next);
  if (err) back(next, { err });
  back(next, { msg: `${targetName} foi excluído. O acesso e o login foram removidos; o histórico de RDOs foi preservado sem autor.` });
}
