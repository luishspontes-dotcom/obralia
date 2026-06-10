import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { untypedDb } from "@/lib/supabase/untyped";
import { toggleContactActive, type ContactRow, type ContactCategory } from "@/lib/contacts-actions";
import { InviteForm } from "./InviteForm";
import { MemberRow } from "@/components/MemberRow";
import { TempPasswordBanner } from "./TempPasswordBanner";

type Member = {
  profile_id: string;
  role: string;
  profiles: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    access_count: number | null;
    last_access_at: string | null;
  } | null;
};

const ACCESS_DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

function lastAccessLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : ACCESS_DATE_FMT.format(d);
}
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

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{
    msg?: string;
    err?: string;
    temp_pw?: string;
    temp_user?: string;
    email?: string;
    nome?: string;
    role?: string;
  }>;
}) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const {
    msg,
    err,
    temp_pw: tempPw,
    temp_user: tempUser,
    email: inviteEmail,
    nome: inviteName,
    role: inviteRoleRaw,
  } = await searchParams;
  const inviteRole: "admin" | "engineer" | "viewer" =
    inviteRoleRaw === "admin" || inviteRoleRaw === "engineer" || inviteRoleRaw === "viewer"
      ? inviteRoleRaw
      : "viewer";

  const { data: profileRaw } = await supabase
    .from("profiles").select("default_org_id").eq("id", user.id).maybeSingle();
  const profile = profileRaw as Profile | null;

  const { data: orgsRaw } = await supabase.from("organizations").select("id, name");
  const orgs = (orgsRaw ?? []) as Organization[];
  const activeOrg = orgs.find((org) => org.id === profile?.default_org_id) ?? orgs[0] ?? null;

  const { data: membersRaw } = await supabase
    .from("organization_members")
    .select("profile_id, role, profiles(id, full_name, avatar_url, access_count, last_access_at)")
    .eq("organization_id", activeOrg?.id ?? "");
  const members = (membersRaw ?? []) as unknown as Member[];
  const currentMember = members.find((member) => member.profile_id === user.id);
  const canInvite = ["owner", "admin"].includes(currentMember?.role ?? "");

  // E-mails vivem no auth (profiles não tem coluna email) — só busca
  // via service role quando o viewer é admin/owner, e só server-side.
  const emailById = new Map<string, string>();
  if (canInvite && members.length > 0) {
    const admin = createAdminSupabase();
    const memberIds = new Set(members.map((m) => m.profile_id));
    const perPage = 1000;
    for (let page = 1; page <= 10; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error || !data?.users?.length) break;
      for (const u of data.users) {
        if (u.email && memberIds.has(u.id)) emailById.set(u.id, u.email);
      }
      if (data.users.length < perPage || emailById.size === memberIds.size) break;
    }
  }
  // Contatos importados do Diário (public.contacts) — agrupados por categoria
  const db = untypedDb(supabase);
  const { data: contactsRaw } = await db
    .from<ContactRow[]>("contacts")
    .select("id, organization_id, name, email, role_label, category, active, profile_id, source, created_at")
    .eq("organization_id", activeOrg?.id ?? "")
    .order("name");
  const contacts = (contactsRaw ?? []) as ContactRow[];
  const contactGroups: Array<{ title: string; category: ContactCategory }> = [
    { title: "Administradores", category: "admin" },
    { title: "Personalizados", category: "equipe" },
    { title: "Cliente Obra", category: "cliente" },
  ];

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

        {msg && (
          <div style={{
            padding: "12px 16px", marginBottom: 16, borderRadius: 10, fontSize: 13,
            color: "var(--st-done)", background: "rgba(90, 141, 140, 0.10)",
            border: "1px solid rgba(90, 141, 140, 0.35)",
          }}>{msg}</div>
        )}
        {err && (
          <div style={{
            padding: "12px 16px", marginBottom: 16, borderRadius: 10, fontSize: 13,
            color: "var(--st-late)", background: "rgba(180, 61, 61, 0.10)",
            border: "1px solid rgba(180, 61, 61, 0.35)",
          }}>{err}</div>
        )}
        {tempPw && tempUser && (
          <TempPasswordBanner name={tempUser} password={tempPw} />
        )}

        {contactGroups.map(({ title, category }) => {
          const group = contacts.filter((contact) => contact.category === category);
          return (
            <section key={category} className="do-panel" style={{ marginBottom: 18 }}>
              <div className="do-panel__header">
                <h2>{title} ({group.length})</h2>
              </div>
              {group.length === 0 ? (
                <div style={{ padding: 18, color: "#777", fontSize: 12 }}>
                  Nenhum contato nesta categoria.
                </div>
              ) : (
                <div>
                  {group.map((contact) => (
                    <ContactLine
                      key={contact.id}
                      contact={contact}
                      canManage={canInvite}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}

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
                    email={emailById.get(m.profile_id) ?? null}
                    accessCount={canInvite ? m.profiles?.access_count ?? 0 : undefined}
                    lastAccessLabel={canInvite ? lastAccessLabel(m.profiles?.last_access_at) : undefined}
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

          <aside id="convidar" className="do-panel">
            <div className="do-panel__header">
              <h2>Convidar usuário</h2>
            </div>
            <div style={{ padding: 16 }}>
              <p style={{ margin: "0 0 14px", fontSize: 12, color: "#666", lineHeight: 1.5 }}>
                O usuário recebe um link seguro no e-mail e fica vinculado à organização no papel escolhido.
              </p>
              {activeOrg && canInvite ? (
                <InviteForm
                  key={`${inviteEmail ?? ""}|${inviteName ?? ""}|${inviteRole}`}
                  orgId={activeOrg.id}
                  initialEmail={inviteEmail ?? ""}
                  initialName={inviteName ?? ""}
                  initialRole={inviteRole}
                />
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

function contactInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";
}

function ContactLine({ contact, canManage }: { contact: ContactRow; canManage: boolean }) {
  const inviteHref = `/usuarios?email=${encodeURIComponent(contact.email ?? "")}&nome=${encodeURIComponent(contact.name)}&role=viewer#convidar`;
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: "12px 20px",
        borderTop: "1px solid var(--o-border)",
        flexWrap: "wrap",
        opacity: contact.active ? 1 : 0.55,
      }}
    >
      <div
        style={{
          width: 40, height: 40, borderRadius: 999,
          background: "linear-gradient(135deg, var(--t-brand), var(--t-brand-d))",
          color: "white",
          display: "grid", placeItems: "center",
          font: "600 13px var(--font-inter)",
          flexShrink: 0,
        }}
      >
        {contactInitials(contact.name)}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, fontSize: 14, color: "var(--o-text-1)" }}>{contact.name}</div>
        {contact.email ? (
          <div style={{ fontSize: 12, color: "var(--o-text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {contact.email}
          </div>
        ) : null}
      </div>

      <span style={{ fontSize: 12, color: "var(--o-text-2)", minWidth: 0 }}>
        {contact.role_label ?? ""}
      </span>

      <span className={`diario-status-badge ${contact.active ? "is-done" : "is-paused"}`}>
        {contact.active ? "Ativo" : "Inativo"}
      </span>

      {canManage && !contact.profile_id && contact.email ? (
        <Link
          href={inviteHref}
          className="chip"
          style={{ fontSize: 12, textDecoration: "none" }}
          title={`Convidar ${contact.name} para acessar o Obralia`}
        >
          Convidar
        </Link>
      ) : null}

      {canManage ? (
        <form action={toggleContactActive} style={{ display: "inline" }}>
          <input type="hidden" name="contact_id" value={contact.id} />
          <input type="hidden" name="next_active" value={contact.active ? "false" : "true"} />
          <button
            type="submit"
            className="chip"
            style={{ cursor: "pointer", fontSize: 12, color: contact.active ? "#b3261e" : undefined }}
          >
            {contact.active ? "Desativar" : "Reativar"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
