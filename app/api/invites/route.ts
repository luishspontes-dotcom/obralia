import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { isInviteRole, sendOrgInvite } from "@/lib/invite-core";

const ADMIN_ROLES = new Set(["owner", "admin"]);

type InviteBody = {
  email?: unknown;
  name?: unknown;
  role?: unknown;
  organizationId?: unknown;
};

function json(status: number, message: string) {
  return NextResponse.json({ message }, { status });
}

/**
 * Rate limit em memória: max 10 convites por usuário por hora.
 * Mata abuso simples (caso credencial vaze) sem custo de Redis externo.
 * Reseta no cold-start do serverless — aceitável pra esse uso.
 */
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1h
const inviteRateLimit = new Map<string, number[]>();

function checkRateLimit(userId: string): { ok: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const recent = (inviteRateLimit.get(userId) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  );
  if (recent.length >= RATE_LIMIT_MAX) {
    const oldest = recent[0];
    const retryAfterSec = Math.ceil(
      (RATE_LIMIT_WINDOW_MS - (now - oldest)) / 1000
    );
    return { ok: false, retryAfterSec };
  }
  recent.push(now);
  inviteRateLimit.set(userId, recent);
  return { ok: true };
}

export async function POST(request: NextRequest) {
  let body: InviteBody;
  try {
    body = (await request.json()) as InviteBody;
  } catch {
    return json(400, "Payload inválido.");
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const fullName =
    typeof body.name === "string" && body.name.trim()
      ? body.name.trim()
      : null;
  const role = typeof body.role === "string" ? body.role : "";
  const organizationId =
    typeof body.organizationId === "string" ? body.organizationId : "";

  if (!email || !email.includes("@")) {
    return json(400, "Informe um e-mail válido.");
  }
  if (!isInviteRole(role)) {
    return json(400, "Papel inválido.");
  }
  if (!organizationId) {
    return json(400, "Organização inválida.");
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json(401, "Faça login para convidar.");

  const { data: membershipRaw } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("profile_id", user.id)
    .maybeSingle();
  const memberRole = (membershipRaw as { role?: string } | null)?.role;
  if (!ADMIN_ROLES.has(memberRole ?? "")) {
    return json(403, "Sem permissão.");
  }

  const rate = checkRateLimit(user.id);
  if (!rate.ok) {
    const min = Math.ceil((rate.retryAfterSec ?? 0) / 60);
    return NextResponse.json(
      {
        message: `Muitos convites em pouco tempo. Tente novamente em ${min} min.`,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSec ?? 60) },
      }
    );
  }

  // Lógica compartilhada (lib/invite-core.ts): upsert em pending_invites +
  // magic link com shouldCreateUser=true. O /auth/callback consome o invite
  // no primeiro login e vincula o usuário à org com o papel escolhido.
  const result = await sendOrgInvite(supabase, {
    email,
    fullName,
    role,
    organizationId,
    invitedBy: user.id,
    redirectBase: process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin,
  });

  if (!result.ok) {
    return json(500, result.error);
  }

  return NextResponse.json({ ok: true });
}
