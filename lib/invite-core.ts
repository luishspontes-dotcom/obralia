import type { createServerSupabase } from "@/lib/supabase/server";

/* ─────────────────────────────────────────────────────────────
 * Núcleo compartilhado de convites — usado pela rota /api/invites
 * e pelo server action conviteContato (lib/contacts-actions.ts).
 *
 * Fluxo (o mesmo nas duas portas de entrada):
 *  1. upsert em pending_invites (org, email, role, invited_by);
 *  2. magic link via supabase.auth.signInWithOtp com
 *     emailRedirectTo /auth/callback — no primeiro login o
 *     callback chama consume_pending_invites e vincula o usuário
 *     à organização no papel escolhido.
 * ───────────────────────────────────────────────────────────── */

export type InviteRole = "admin" | "engineer" | "viewer";

export const INVITE_ROLES: ReadonlySet<string> = new Set([
  "admin",
  "engineer",
  "viewer",
]);

export function isInviteRole(value: string): value is InviteRole {
  return INVITE_ROLES.has(value);
}

type InviteClient = Awaited<ReturnType<typeof createServerSupabase>>;

export type SendInviteInput = {
  email: string;
  fullName: string | null;
  role: InviteRole;
  organizationId: string;
  invitedBy: string;
  /** Base da URL de redirect (default: NEXT_PUBLIC_APP_URL → obralia.com.br). */
  redirectBase?: string;
};

export type SendInviteResult = { ok: true } | { ok: false; error: string };

export async function sendOrgInvite(
  supabase: InviteClient,
  input: SendInviteInput
): Promise<SendInviteResult> {
  const email = input.email.trim().toLowerCase();

  // 1. Registra/renova o convite pendente (RLS: admins da org podem inserir).
  const { error: pendingErr } = await supabase.from("pending_invites").upsert(
    {
      email,
      organization_id: input.organizationId,
      role: input.role,
      full_name: input.fullName,
      invited_by: input.invitedBy,
      consumed_at: null,
    } as never,
    { onConflict: "email,organization_id" }
  );
  if (pendingErr) {
    return {
      ok: false,
      error: `Falha ao registrar convite: ${pendingErr.message}`,
    };
  }

  // 2. Envia o magic link (template "Magic Link" do Supabase).
  const base =
    input.redirectBase?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://www.obralia.com.br";
  const redirectTo = `${base}/auth/callback?next=${encodeURIComponent("/inicio")}`;

  const { error: otpErr } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
      shouldCreateUser: true,
      data: input.fullName ? { full_name: input.fullName } : undefined,
    },
  });
  if (otpErr) {
    return { ok: false, error: `Falha ao enviar link: ${otpErr.message}` };
  }

  return { ok: true };
}
