import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { Topbar } from "@/components/layout/Topbar";
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

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-nav">
        Pular para o conteúdo
      </a>
      <Topbar activeOrg={activeOrg} userName={fullName ?? user.email ?? null} />
      <main id="main-content" className="app-main light-scroll" tabIndex={-1}>
        {children}
      </main>
      <KeyboardShortcuts />
    </div>
  );
}
