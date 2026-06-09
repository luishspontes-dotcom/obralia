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
type PendingInvite = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  consumed_at: string | null;
  created_at: string;
};

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
  const { data: invitesRaw } = await supabase
    .from("pending_invites")
    .select("id, email, full_name, role, consumed_at, created_at")
    .eq("organization_id", activeOrg?.id ?? "")
    .order("role")
    .order("full_name");
  const pendingInvites = ((invitesRaw ?? []) as PendingInvite[]).filter((invite) => !invite.consumed_at);

  return (
    <div className="diario-page">
      <div className="diario-container">
        <div className="diario-page-header">
          <div>
            <h1>Usuários</h1>
            <p>
              {members.length} membros ativos · {pendingInvites.length} acessos importados/pendentes em {activeOrg?.name ?? "—"}
            </p>
          </div>
        </div>

        <div className="do-dashboard-grid" style={{ alignItems: "start" }}>
          <section className="do-panel">
            <div className="do-panel__header">
              <h2>Membros do Obrália</h2>
              <span style={{ color: "#777", fontSize: 12 }}>{members.length}</span>
            </div>
            <div>
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
                <div style={{ padding: 18, color: "#777", fontSize: 12 }}>
                  Sem membros ainda.
                </div>
              )}
            </div>
          </section>

          <aside className="do-panel">
            <div className="do-panel__header">
              <h2>Convidar usuário</h2>
            </div>
            <div style={{ padding: 16 }}>
              <p style={{ margin: "0 0 14px", fontSize: 12, color: "#666", lineHeight: 1.5 }}>
                O usuário recebe um link seguro no e-mail e fica vinculado à organização no papel escolhido.
              </p>
              {activeOrg && canInvite ? (
                <InviteForm orgId={activeOrg.id} />
              ) : (
                <div style={{ fontSize: 12, color: "#666", lineHeight: 1.5 }}>
                  Apenas owners e admins podem convidar usuários.
                </div>
              )}
            </div>
          </aside>
        </div>

        <section className="do-panel" style={{ marginTop: 18 }}>
          <div className="do-panel__header">
            <h2>Usuários importados do Diário</h2>
            <span style={{ color: "#777", fontSize: 12 }}>{pendingInvites.length}</span>
          </div>
          {pendingInvites.length === 0 ? (
            <div style={{ padding: 18, color: "#777", fontSize: 12 }}>
              Nenhum acesso pendente importado.
            </div>
          ) : (
            <div className="do-table-wrap">
              <table className="do-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>E-mail</th>
                    <th>Papel</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingInvites.map((invite) => (
                    <tr key={invite.id}>
                      <td>{invite.full_name ?? "Sem nome"}</td>
                      <td>{invite.email}</td>
                      <td>{roleLabel(invite.role)}</td>
                      <td>Aguardando primeiro acesso</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function roleLabel(role: string) {
  if (role === "admin") return "Administrador";
  if (role === "engineer") return "Equipe";
  if (role === "viewer") return "Cliente";
  return role;
}
