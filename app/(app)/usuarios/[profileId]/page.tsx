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

  // E-mail + status (Ativo/Inativo) best-effort via admin auth.
  let email: string | null = null;
  let initialActive = true;
  try {
    const admin = createAdminSupabase();
    const { data: authUser } = await admin.auth.admin.getUserById(profileId);
    email = authUser?.user?.email ?? null;
    const bannedUntil = (authUser?.user as { banned_until?: string } | undefined)?.banned_until;
    initialActive = !bannedUntil || new Date(bannedUntil).getTime() <= Date.now();
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
        <div style={{ maxWidth: 880, margin: "0 auto", display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/usuarios" title="Voltar para Usuários" style={{ color: "var(--t-brand)", textDecoration: "none", fontSize: 24, lineHeight: 1, fontWeight: 700 }}>←</Link>
          <h1 style={{ margin: 0, font: "600 22px var(--font-inter)", letterSpacing: "-0.01em" }}>Editar usuário</h1>
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
          initialActive={initialActive}
          initialSiteIds={initialSiteIds}
          sites={sites}
        />
      </div>
    </div>
  );
}
