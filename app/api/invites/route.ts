import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

const INVITE_ROLES = new Set(["admin", "engineer", "viewer"]);
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

function getPublicEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing.");
  }
  return { supabaseUrl };
}

function getAdminClient() {
  const { supabaseUrl } = getPublicEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing.");
  }
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
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
      : email;
  const role = typeof body.role === "string" ? body.role : "";
  const organizationId =
    typeof body.organizationId === "string" ? body.organizationId : "";

  if (!email || !email.includes("@")) {
    return json(400, "Informe um e-mail válido.");
  }
  if (!INVITE_ROLES.has(role)) {
    return json(400, "Papel inválido para convite.");
  }
  if (!organizationId) {
    return json(400, "Organização inválida.");
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return json(401, "Faça login para convidar usuários.");
  }

  const { data: membershipRaw } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("profile_id", user.id)
    .maybeSingle();
  const membership = membershipRaw as { role: string } | null;

  if (!ADMIN_ROLES.has(membership?.role ?? "")) {
    return json(403, "Você não tem permissão para convidar usuários.");
  }

  let admin;
  try {
    admin = getAdminClient();
  } catch {
    return json(500, "Convites ainda não estão configurados no servidor.");
  }

  const redirectTo = `${
    process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin
  }/auth/callback`;

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: {
      full_name: fullName,
      invited_to_org: organizationId,
      invited_role: role,
    },
    redirectTo,
  });

  if (error || !data.user) {
    return json(400, error?.message ?? "Não foi possível criar o convite.");
  }

  const invitedUserId = data.user.id;

  const { error: profileError } = await admin.from("profiles").upsert({
    id: invitedUserId,
    full_name: fullName,
    default_org_id: organizationId,
  });

  if (profileError) {
    return json(500, "Convite criado, mas falhou ao criar o perfil.");
  }

  const { error: memberError } = await admin
    .from("organization_members")
    .upsert(
      {
        organization_id: organizationId,
        profile_id: invitedUserId,
        role,
      },
      { onConflict: "organization_id,profile_id" }
    );

  if (memberError) {
    return json(500, "Convite criado, mas falhou ao vincular a organização.");
  }

  return NextResponse.json({ ok: true });
}
