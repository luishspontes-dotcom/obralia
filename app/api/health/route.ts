import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  const hasPublicEnv = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const hasServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const checks = {
    app: true,
    env: hasPublicEnv,
    serviceRole: hasServiceRole,
    database: false,
    storage: false,
  };

  let databaseError: string | null = hasPublicEnv
    ? null
    : "Variáveis públicas do Supabase ausentes.";
  let storageError: string | null = null;

  if (!hasServiceRole) {
    databaseError = "SUPABASE_SERVICE_ROLE_KEY ausente no ambiente.";
    storageError = "SUPABASE_SERVICE_ROLE_KEY ausente no ambiente.";
  } else {
    const admin = getSupabaseAdmin();
    const dbCheck = await admin
      .from("organizations")
      .select("id", { count: "exact", head: true });
    checks.database = !dbCheck.error;
    databaseError = dbCheck.error?.message ?? null;

    const storageCheck = await admin.storage.listBuckets();
    checks.storage = !storageCheck.error;
    storageError = storageCheck.error?.message ?? null;
  }

  const ok = Object.values(checks).every(Boolean);

  return NextResponse.json(
    {
      ok,
      status: ok ? "ok" : "degraded",
      checks,
      errors: {
        database: databaseError,
        storage: storageError,
      },
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    },
    {
      status: ok ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
