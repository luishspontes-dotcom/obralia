import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { canAdmin, canWrite } from "@/lib/authz";
import { Rail } from "@/components/layout/Rail";
import { Sidebar } from "@/components/layout/Sidebar";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";

type Profile = {
  full_name: string | null;
  default_org_id: string | null;
};

type Organization = {
  id: string;
  name: string;
  slug: string;
  brand_color: string | null;
};

type Membership = {
  organization_id: string;
  role: string;
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Try to fetch first organization the user belongs to
  const { data: profileRaw } = await supabase
    .from("profiles")
    .select("full_name, default_org_id")
    .eq("id", user.id)
    .maybeSingle();
  const profile = profileRaw as Profile | null;

  const { data: orgsRaw } = await supabase
    .from("organizations")
    .select("id, name, slug, brand_color");
  const orgs = (orgsRaw ?? []) as Organization[];

  const activeOrg =
    orgs.find((org) => org.id === profile?.default_org_id) ?? orgs[0] ?? null;
  const fullName = profile?.full_name ?? null;
  const { data: membershipsRaw } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("profile_id", user.id);
  const memberships = (membershipsRaw ?? []) as Membership[];
  const activeMembership = memberships.find(
    (membership) => membership.organization_id === activeOrg?.id
  );

  return (
    <div className="app-shell">
      <Rail
        userInitials={
          (fullName ?? user.email ?? "??")
            .split(" ")
            .map((s: string) => s[0])
            .slice(0, 2)
            .join("")
            .toUpperCase()
        }
      />
      <Sidebar
        activeOrg={activeOrg}
        userName={fullName}
        canManageSites={canWrite(activeMembership?.role)}
        canManageUsers={canAdmin(activeMembership?.role)}
      />
      <main
        className="app-main light-scroll"
      >
        {children}
      </main>
      <KeyboardShortcuts />
    </div>
  );
}
