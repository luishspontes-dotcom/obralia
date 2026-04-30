import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { Rail } from "@/components/layout/Rail";
import { Sidebar } from "@/components/layout/Sidebar";

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
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, default_org_id")
    .eq("id", user.id)
    .maybeSingle();

  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name, slug, brand_color");

  const activeOrg = orgs?.[0] ?? null;
  const fullName = profile?.full_name ?? null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "64px 280px 1fr",
        minHeight: "100vh",
      }}
    >
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
      <Sidebar activeOrg={activeOrg} userName={fullName} />
      <main
        className="light-scroll"
        style={{
          background: "var(--o-cream)",
          overflowY: "auto",
          maxHeight: "100vh",
        }}
      >
        {children}
      </main>
    </div>
  );
}
