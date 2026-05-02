import "server-only";

import type { createServerSupabase } from "@/lib/supabase/server";
import { canWrite } from "@/lib/authz";

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>;

type Membership = {
  organization_id: string;
  role: string;
};

export async function getActiveWritableOrgId(
  supabase: ServerSupabase,
  userId: string
): Promise<string | null> {
  const [{ data: profileRaw }, { data: membershipsRaw }] = await Promise.all([
    supabase.from("profiles").select("default_org_id").eq("id", userId).maybeSingle(),
    supabase.from("organization_members").select("organization_id, role").eq("profile_id", userId),
  ]);

  const defaultOrgId = (profileRaw as { default_org_id?: string | null } | null)?.default_org_id ?? null;
  const memberships = (membershipsRaw ?? []) as Membership[];
  const writable = memberships.filter((membership) => canWrite(membership.role));

  return (
    writable.find((membership) => membership.organization_id === defaultOrgId)?.organization_id ??
    writable[0]?.organization_id ??
    null
  );
}

export async function canWriteOrganization(
  supabase: ServerSupabase,
  userId: string,
  organizationId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("profile_id", userId)
    .maybeSingle();

  return canWrite((data as { role?: string } | null)?.role);
}
