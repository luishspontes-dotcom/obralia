import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

const INVITE_ROLES = new Set(["admin", "engineer", "viewer"]);
const ADMIN_ROLES = new Set(["owner", "admin"]);
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 20;

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimitGlobal = globalThis as typeof globalThis & {
  __obraliaInviteRateLimit?: Map<string, RateLimitEntry>;
};
const inviteRateLimit =
  rateLimitGlobal.__obraliaInviteRateLimit ??
  new Map<string, RateLimitEntry>();
rateLimitGlobal.__obraliaInviteRateLimit = inviteRateLimit;

type InviteBody = {
  email?: unknown;
  name?: unknown;
  role?: unknown;
  organizationId?: unknown;
};

function json(status: number, message: string) {
  return NextResponse.json({ message }, { status });
}

function getClientKey(request: NextRequest, email: string) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || "unknown";
  return `${ip}:${email}`;
}

function isRateLimited(key: string) {
  const now = Date.now();
  const current = inviteRateLimit.get(key);
  if (!current || current.resetAt <= now) {
    inviteRateLimit.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  current.count += 1;
  return current.count > RATE_LIMIT_MAX_ATTEMPTS;
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
  if (!INVITE_ROLES.has(role)) {
    return json(400, "Papel inválido.");
  }
  if (!organizationId) {
    return json(400, "Organização inválida.");
  }
  if (isRateLimited(getClientKey(request, email))) {
    return json(429, "Muitas tentativas. Tente novamente em alguns minutos.");
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

  // Save pending invite (RLS allows admins of org to insert)
  const { error: pendingErr } = await supabase
    .from("pending_invites")
    .upsert(
      {
        email,
        organization_id: organizationId,
        role,
        full_name: fullName,
        invited_by: user.id,
        consumed_at: null,
      } as never,
      { onConflict: "email,organization_id" }
    );

  if (pendingErr) {
    console.error("Invite persistence failed", {
      organizationId,
      email,
      error: pendingErr.message,
    });
    return json(500, "Falha ao registrar convite.");
  }

  // Send magic link with shouldCreateUser=true. The handle_new_user trigger consumes
  // pending_invites on first login and links the user to the org with the chosen role.
  const redirectTo =
    (process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin) +
    "/auth/callback?next=" +
    encodeURIComponent("/inicio");

  const { error: otpErr } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
      shouldCreateUser: true,
      data: fullName ? { full_name: fullName } : undefined,
    },
  });

  if (otpErr) {
    console.error("Invite email failed", {
      organizationId,
      email,
      error: otpErr.message,
    });
    return json(500, "Falha ao enviar link de acesso.");
  }

  return NextResponse.json({ ok: true });
}
