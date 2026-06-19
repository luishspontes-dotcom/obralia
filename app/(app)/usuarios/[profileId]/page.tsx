import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { untypedDb } from "@/lib/supabase/untyped";
import { getCurrentRole, canManageUsers, roleLabel, type OrgRole } from "@/lib/permissions";
import { VISIBLE_SOURCE_PROVIDERS } from "@/lib/rdo-source-scope";
import UserAccessForm from "@/components/UserAccessForm";

export default async function EditarUsuarioPage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = await params;
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const role = await getCurrentRole();
  if (!canManageUsers(role)) redirect("/usuarios");

  const { data: profileR } = await supabase
    .from("profiles").select("default_org_id").eq("id", user.id).maybeSingle();
  const orgId = (profileR as { default_org_id?: string } | null)?.default_org_id;
  if (!orgId) redirect("/usuarios");

  const { data: memberR } = await supabase
    .from("organization_members")
    .select("role, permissions, job_title, profile_label")
    .eq("organization_id", orgId)
    .eq("profile_id", profileId)
    .maybeSingle();
  const member = memberR as {
    role: string; permissions: unknown; job_title: string | null; profile_label: string | null;
  } | null;
  if (!member) notFound();

  const { data: targetProfileR } = await supabase
    .from("profiles").select("full_name").eq("id", profileId).maybeSingle();
  const name = (targetProfileR as { full_name: string | null } | null)?.full_name ?? "Usuário";

  // E-mail (best-effort via admin auth).
  let email: string | null = null;
  try {
    const admin = createAdminSupabase();
    const { data: authUser } = await admin.auth.admin.getUserById(profileId);
    email = authUser?.user?.email ?? null;
  } catch { email = null; }

  const { data: accessR } = await untypedDb(supabase)
    .from<{ site_id: string }[]>("member_site_access")
    .select("site_id")
    .eq("organization_id", orgId)
    .eq("profile_id", profileId);
  const initialSiteIds = ((accessR ?? []) as { site_id: string }[]).map((r) => r.site_id);

  const { data: sitesR } = await supabase
    .from("sites")
    .select("id, name")
    .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
    .order("name");
  const sites = ((sitesR ?? []) as { id: string; name: string }[]);

  return (
    <div>
      <div className="page-hero">
        <div style={{ maxWidth: 880, margin: "0 auto" }}>
          <div style={{ marginBottom: 12, fontSize: 13 }}>
            <Link href="/usuarios" style={{ color: "var(--o-text-2)", textDecoration: "none" }}>← Usuários</Link>
          </div>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--t-brand)", fontWeight: 600, marginBottom: 8 }}>
            Editar usuário
          </div>
          <h1 style={{ margin: "0 0 6px", font: "700 32px var(--font-inter)", letterSpacing: "-0.025em" }}>{name}</h1>
          <p style={{ margin: 0, fontSize: 14, color: "var(--o-text-2)" }}>
            Permissões de acesso e obras que este usuário pode acessar.
          </p>
        </div>
      </div>

      <div style={{ padding: "0 24px 32px", maxWidth: 880, margin: "0 auto" }}>
        <UserAccessForm
          profileId={profileId}
          name={name}
          email={email}
          roleLabel={roleLabel((member.role as OrgRole) ?? null)}
          initialJobTitle={member.job_title}
          initialProfileLabel={member.profile_label}
          initialPermissions={member.permissions}
          initialSiteIds={initialSiteIds}
          sites={sites}
        />
      </div>
    </div>
  );
}
