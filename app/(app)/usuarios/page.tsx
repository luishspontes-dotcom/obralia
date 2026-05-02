import { createServerSupabase } from "@/lib/supabase/server";
import { InviteForm } from "./InviteForm";
import { MemberRow } from "@/components/MemberRow";

type Member = {
  profile_id: string;
  role: string;
  profiles: { id: string; full_name: string; avatar_url: string | null } | null;
};
type Profile = { default_org_id: string | null };
type Organization = { id: string; name: string };

export default async function UsuariosPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profileRaw } = await supabase
    .from("profiles").select("default_org_id").eq("id", user.id).maybeSingle();
  const profile = profileRaw as Profile | null;

  const { data: orgsRaw } = await supabase.from("organizations").select("id, name");
  const orgs = (orgsRaw ?? []) as Organization[];
  const activeOrg = orgs.find((org) => org.id === profile?.default_org_id) ?? orgs[0] ?? null;

  const { data: membersRaw } = await supabase
    .from("organization_members")
    .select("profile_id, role, profiles(id, full_name, avatar_url)")
    .eq("organization_id", activeOrg?.id ?? "");
  const members = (membersRaw ?? []) as unknown as Member[];
  const currentMember = members.find((member) => member.profile_id === user.id);
  const canInvite = ["owner", "admin"].includes(currentMember?.role ?? "");

  return (
    <div>
      <div className="page-hero">
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--t-brand)", fontWeight: 600, marginBottom: 8 }}>
            Equipe
          </div>
          <h1 style={{ margin: "0 0 8px", font: "700 32px var(--font-inter)", letterSpacing: "-0.025em" }}>
            Usuários
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "var(--o-text-2)" }}>
            {members.length} {members.length === 1 ? "membro" : "membros"} em {activeOrg?.name ?? "—"}
          </p>
        </div>
      </div>

      <div style={{ padding: "0 24px 32px", maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 24, alignItems: "start" }}>
          <div className="card reveal-stagger" style={{ overflow: "hidden", padding: 0 }}>
            {members.map((m) => {
              const name = m.profiles?.full_name ?? "Sem nome";
              const initials = name.split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase();
              const isMe = m.profile_id === user.id;
              return (
                <MemberRow
                  key={m.profile_id}
                  profileId={m.profile_id}
                  organizationId={activeOrg?.id ?? ""}
                  name={name}
                  initials={initials}
                  role={m.role}
                  isMe={isMe}
                  canManage={canInvite}
                />
              );
            })}
            {members.length === 0 && (
              <div style={{ padding: 48, textAlign: "center", color: "var(--o-text-2)", fontSize: 14 }}>
                Sem membros ainda.
              </div>
            )}
          </div>

          <div className="card" style={{ padding: 22 }}>
            <h3 style={{ margin: "0 0 4px", font: "600 16px var(--font-inter)", letterSpacing: "-0.01em" }}>
              Convidar usuário
            </h3>
            <p style={{ margin: "0 0 18px", fontSize: 13, color: "var(--o-text-2)", lineHeight: 1.55 }}>
              O usuário recebe um link seguro no e-mail e já fica vinculado à organização no papel escolhido.
            </p>
            {activeOrg && canInvite ? (
              <InviteForm orgId={activeOrg.id} />
            ) : (
              <div style={{ fontSize: 13, color: "var(--o-text-2)", lineHeight: 1.55, padding: "12px 14px", background: "var(--o-soft)", borderRadius: 8 }}>
                🔒 Apenas owners e admins podem convidar usuários.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
