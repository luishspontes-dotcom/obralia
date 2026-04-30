import { createServerSupabase } from "@/lib/supabase/server";
import { InviteForm } from "./InviteForm";

type Member = {
  profile_id: string;
  role: string;
  profiles: { id: string; full_name: string; avatar_url: string | null } | null;
};

type Profile = {
  default_org_id: string | null;
};

type Organization = {
  id: string;
  name: string;
};

export default async function UsuariosPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profileRaw } = await supabase
    .from("profiles")
    .select("default_org_id")
    .eq("id", user.id)
    .maybeSingle();
  const profile = profileRaw as Profile | null;

  const { data: orgsRaw } = await supabase
    .from("organizations").select("id, name");
  const orgs = (orgsRaw ?? []) as Organization[];
  const activeOrg =
    orgs.find((org) => org.id === profile?.default_org_id) ?? orgs[0] ?? null;

  const { data: membersRaw } = await supabase
    .from("organization_members")
    .select("profile_id, role, profiles(id, full_name, avatar_url)")
    .eq("organization_id", activeOrg?.id ?? "");
  const members = (membersRaw ?? []) as unknown as Member[];
  const currentMember = members.find((member) => member.profile_id === user.id);
  const canInvite = ["owner", "admin"].includes(currentMember?.role ?? "");

  return (
    <div style={{ padding: "24px", maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: "0 0 4px", font: "700 28px var(--font-inter)", letterSpacing: "-0.02em" }}>Usuários</h1>
        <p style={{ margin: 0, fontSize: 14, color: "var(--o-text-2)" }}>
          {members.length} {members.length === 1 ? "membro" : "membros"} em {activeOrg?.name ?? "—"}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 24, alignItems: "start" }}>
        <div style={{ background: "var(--o-paper)", border: "1px solid var(--o-border)", borderRadius: 12, overflow: "hidden" }}>
          {members.map((m, idx) => {
            const name = m.profiles?.full_name ?? "Sem nome";
            const initials = name
              .split(" ")
              .map((s: string) => s[0])
              .slice(0, 2)
              .join("")
              .toUpperCase();
            const isAdmin = m.role === "admin";
            return (
              <div key={m.profile_id} style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "14px 18px",
                borderTop: idx === 0 ? "none" : "1px solid var(--o-border)",
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 999,
                  background: "linear-gradient(135deg, #08789B, #054F66)",
                  color: "white",
                  display: "grid", placeItems: "center",
                  font: "600 13px var(--font-inter)",
                }}>{initials}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{name}</div>
                  <div style={{ fontSize: 12, color: "var(--o-text-2)" }}>
                    {m.profile_id === user.id ? "Você" : ""}
                  </div>
                </div>
                <span style={{
                  padding: "3px 10px",
                  borderRadius: 999,
                  fontSize: 11, fontWeight: 500,
                  background: isAdmin ? "rgba(217, 119, 87, 0.12)" : "rgba(0,0,0,0.04)",
                  color: isAdmin ? "var(--o-accent)" : "var(--o-text-2)",
                }}>{isAdmin ? "Admin" : "Membro"}</span>
              </div>
            );
          })}
          {members.length === 0 && (
            <div style={{ padding: 32, textAlign: "center", color: "var(--o-text-2)", fontSize: 14 }}>
              Sem membros ainda.
            </div>
          )}
        </div>

        <div style={{ background: "var(--o-paper)", border: "1px solid var(--o-border)", borderRadius: 12, padding: 20 }}>
          <h3 style={{ margin: "0 0 12px", font: "600 14px var(--font-inter)" }}>Convidar usuário</h3>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--o-text-2)", lineHeight: 1.5 }}>
            O usuário recebe um link seguro no e-mail e já fica vinculado à organização no papel escolhido.
          </p>
          {activeOrg && canInvite ? (
            <InviteForm orgId={activeOrg.id} />
          ) : (
            <div style={{ fontSize: 13, color: "var(--o-text-2)", lineHeight: 1.5 }}>
              Apenas owners e admins podem convidar usuários.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
