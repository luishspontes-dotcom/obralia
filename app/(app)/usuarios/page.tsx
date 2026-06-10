import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { untypedDb, type UntypedSupabase } from "@/lib/supabase/untyped";
import { conviteContato, type ContactRow } from "@/lib/contacts-actions";
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
  const memberIds = new Set(members.map((m) => m.profile_id));

  // E-mails vivem no auth (profiles não tem coluna email) — só busca
  // via service role quando o viewer é admin/owner, e só server-side.
  const emailById = new Map<string, string>();
  if (canInvite && members.length > 0) {
    const admin = createAdminSupabase();
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

  // Contatos importados do Diário (public.contacts).
  const db = untypedDb(supabase);
  const { data: contactsRaw } = await db
    .from<ContactRow[]>("contacts")
    .select("id, organization_id, name, email, role_label, category, active, profile_id, source, created_at")
    .eq("organization_id", activeOrg?.id ?? "")
    .order("name");
  const contacts = (contactsRaw ?? []) as ContactRow[];

  // ── Dedup: contato cujo e-mail já tem login NÃO aparece nas seções de
  // contatos — a linha dele vira a própria linha de membro, enriquecida
  // com o cargo (role_label). Matching por profile_id e por e-mail
  // (case-insensitive). Aproveita pra gravar contacts.profile_id quando
  // dá match (admin client, fire-and-forget).
  const memberIdByEmail = new Map<string, string>();
  for (const [pid, em] of emailById) memberIdByEmail.set(em.trim().toLowerCase(), pid);

  const contactByProfileId = new Map<string, ContactRow>();
  const contactsSemLogin: ContactRow[] = [];
  let linkDb: UntypedSupabase | null = null;
  for (const contact of contacts) {
    const byProfile =
      contact.profile_id && memberIds.has(contact.profile_id) ? contact.profile_id : null;
    const byEmail = contact.email
      ? memberIdByEmail.get(contact.email.trim().toLowerCase()) ?? null
      : null;
    const matchId = byProfile ?? byEmail;
    if (matchId) {
      if (!contactByProfileId.has(matchId)) contactByProfileId.set(matchId, contact);
      if (!contact.profile_id) {
        linkDb ??= untypedDb(createAdminSupabase());
        // fire-and-forget: persiste o vínculo pra próxima leitura ser direta
        void linkDb
          .from("contacts")
          .update({ profile_id: matchId })
          .eq("id", contact.id)
          .then(() => undefined, () => undefined);
      }
    } else {
      contactsSemLogin.push(contact);
    }
  }

  const { data: invitesRaw } = await supabase
    .from("pending_invites")
    .select("id, email, full_name, role, consumed_at, created_at")
    .eq("organization_id", activeOrg?.id ?? "")
    .order("role")
    .order("full_name");
  const pendingInvites = ((invitesRaw ?? []) as PendingInvite[]).filter((invite) => !invite.consumed_at);
  const pendingEmails = new Set(pendingInvites.map((invite) => invite.email.trim().toLowerCase()));

  const hasPendingInvite = (contact: ContactRow): boolean =>
    !!contact.email && pendingEmails.has(contact.email.trim().toLowerCase());

  const aguardandoGroups: Array<{ title: string; rows: ContactRow[] }> = [
    {
      title: "Aguardando convite — Equipe",
      rows: contactsSemLogin.filter((c) => c.category === "admin" || c.category === "equipe"),
    },
    {
      title: "Aguardando convite — Clientes",
      rows: contactsSemLogin.filter((c) => c.category === "cliente"),
    },
  ];

  // Convites manuais (feitos pelo formulário) cujo e-mail não está na agenda —
  // sem isso eles ficariam invisíveis depois do envio.
  const contactEmails = new Set(
    contacts
      .map((c) => c.email?.trim().toLowerCase() ?? "")
      .filter((e) => e.length > 0)
  );
  const manualInvites = pendingInvites.filter(
    (invite) => !contactEmails.has(invite.email.trim().toLowerCase())
  );

  return (
    <div className="diario-page">
      <div className="diario-container">
        <div className="diario-page-header">
          <div>
            <h1>Usuários</h1>
            <p>
              {members.length} com acesso · {contactsSemLogin.length} aguardando convite em {activeOrg?.name ?? "—"}
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

        <div className="do-dashboard-grid" style={{ alignItems: "start", marginBottom: 18 }}>
          <section className="do-panel">
            <div className="do-panel__header">
              <h2>Com acesso ({members.length})</h2>
            </div>
            <div>
              {members.map((m) => {
                const contact = contactByProfileId.get(m.profile_id);
                const name = m.profiles?.full_name ?? contact?.name ?? "Sem nome";
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
                    subtitle={contact?.role_label ?? null}
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

        {aguardandoGroups.map(({ title, rows }) => (
          <section key={title} className="do-panel" style={{ marginBottom: 18 }}>
            <div className="do-panel__header">
              <h2>{title} ({rows.length})</h2>
            </div>
            {rows.length === 0 ? (
              <div style={{ padding: 18, color: "#777", fontSize: 12 }}>
                Todo mundo daqui já tem acesso. Nada pendente.
              </div>
            ) : (
              <div>
                {rows.map((contact) => (
                  <ContactLine
                    key={contact.id}
                    contact={contact}
                    canManage={canInvite}
                    inviteSent={hasPendingInvite(contact)}
                  />
                ))}
              </div>
            )}
          </section>
        ))}

        {manualInvites.length > 0 && (
          <section className="do-panel" style={{ marginTop: 18 }}>
            <div className="do-panel__header">
              <h2>Convites manuais aguardando primeiro acesso</h2>
              <span style={{ color: "#777", fontSize: 12 }}>{manualInvites.length}</span>
            </div>
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
                  {manualInvites.map((invite) => (
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
          </section>
        )}
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

function ContactLine({
  contact,
  canManage,
  inviteSent,
}: {
  contact: ContactRow;
  canManage: boolean;
  inviteSent: boolean;
}) {
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
        ) : (
          <div style={{ fontSize: 12, color: "var(--st-late)" }}>Sem e-mail cadastrado</div>
        )}
      </div>

      <span style={{ fontSize: 12, color: "var(--o-text-2)", minWidth: 0 }}>
        {contact.role_label ?? ""}
      </span>

      {!contact.active ? (
        <span className="diario-status-badge is-paused">Inativo</span>
      ) : inviteSent ? (
        <span className="diario-status-badge is-done">Convite enviado</span>
      ) : (
        <span className="diario-status-badge is-planned">Sem acesso</span>
      )}

      {canManage && contact.email ? (
        <form action={conviteContato} style={{ display: "inline" }}>
          <input type="hidden" name="contact_id" value={contact.id} />
          <button
            type="submit"
            className="chip"
            style={{ cursor: "pointer", fontSize: 12 }}
            title={
              inviteSent
                ? `Reenviar o link de acesso para ${contact.email}`
                : `Enviar link de acesso ao Obralia para ${contact.email}`
            }
          >
            {inviteSent ? "↻ Reenviar" : "✉ Convidar"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
