import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getDiarioCadastroSnapshot, type DiarioCadastroUser } from "@/lib/diario-cadastros";
import { getCurrentRole, canManageUsers } from "@/lib/permissions";
import { MemberRow } from "@/components/MemberRow";
import { TempPasswordBanner } from "../../usuarios/TempPasswordBanner";
import { CadastroShell, EmptyPanel, groupLabel, roleLabel } from "../_shared";

const PAGE_PATH = "/cadastros/usuarios-empresas-acesso";

type Member = {
  profile_id: string;
  role: string;
  profiles: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    access_count: number | null;
    last_access_at: string | null;
  } | null;
};
type PendingInvite = { id: string; email: string; role: string; consumed_at: string | null };

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

function initialsOf(name: string): string {
  return (
    name
      .split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

/** Papel sugerido no convite a partir do grupo/papel importado do Diário. */
function suggestedInviteRole(user: DiarioCadastroUser): "admin" | "engineer" | "viewer" {
  if (user.role === "admin" || user.group === "administrador") return "admin";
  if (user.group === "clienteObra" || user.role === "viewer") return "viewer";
  return "engineer";
}

export default async function UsuariosEmpresasAcessoPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string; temp_pw?: string; temp_user?: string }>;
}) {
  const { msg, err, temp_pw: tempPw, temp_user: tempUser } = await searchParams;
  const { activeOrg, snapshot } = await getDiarioCadastroSnapshot();
  const users = snapshot.cadastros?.usuarios ?? [];

  const supabase = await createServerSupabase();
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();
  const role = await getCurrentRole();
  const canManage = canManageUsers(role);

  // Membros reais da organização + convites pendentes
  const { data: membersRaw } = await supabase
    .from("organization_members")
    .select("profile_id, role, profiles(id, full_name, avatar_url, access_count, last_access_at)")
    .eq("organization_id", activeOrg?.id ?? "");
  const members = (membersRaw ?? []) as unknown as Member[];

  const { data: invitesRaw } = await supabase
    .from("pending_invites")
    .select("id, email, role, consumed_at")
    .eq("organization_id", activeOrg?.id ?? "");
  const pendingInvites = ((invitesRaw ?? []) as PendingInvite[]).filter((i) => !i.consumed_at);

  // E-mails vivem no auth — só via service role, só para admin/owner, só server-side.
  const emailById = new Map<string, string>();
  if (canManage && members.length > 0) {
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

  const memberByEmail = new Map<string, Member>();
  for (const m of members) {
    const email = emailById.get(m.profile_id)?.toLowerCase();
    if (email) memberByEmail.set(email, m);
  }
  const inviteByEmail = new Map<string, PendingInvite>();
  for (const invite of pendingInvites) {
    inviteByEmail.set(invite.email.toLowerCase(), invite);
  }

  return (
    <CadastroShell
      title="Usuários empresas/acesso"
      subtitle={`${users.length} usuários importados do Diário em ${activeOrg?.name ?? "Obrália"}`}
    >
      {msg && (
        <div
          style={{
            padding: "12px 16px", marginBottom: 16, borderRadius: 10, fontSize: 13,
            color: "var(--st-done)", background: "rgba(90, 141, 140, 0.10)",
            border: "1px solid rgba(90, 141, 140, 0.35)",
          }}
        >
          {msg}
        </div>
      )}
      {err && (
        <div
          style={{
            padding: "12px 16px", marginBottom: 16, borderRadius: 10, fontSize: 13,
            color: "var(--st-late)", background: "rgba(180, 61, 61, 0.10)",
            border: "1px solid rgba(180, 61, 61, 0.35)",
          }}
        >
          {err}
        </div>
      )}
      {tempPw && tempUser && <TempPasswordBanner name={tempUser} password={tempPw} />}

      {users.length === 0 ? (
        <EmptyPanel>Nenhum usuário importado do Diário encontrado.</EmptyPanel>
      ) : (
        <div className="do-panel">
          {users.map((user, index) => {
            const email = user.email?.toLowerCase() ?? null;
            const member = email ? memberByEmail.get(email) : undefined;
            const invite = !member && email ? inviteByEmail.get(email) : undefined;
            const name = user.name ?? user.email ?? "Sem nome";
            const subtitle = `Diário: ${groupLabel(user.group)} · ${roleLabel(user.role)}${
              user.active === false ? " · Inativo no Diário" : ""
            }`;

            if (member) {
              const memberName = member.profiles?.full_name ?? name;
              return (
                <MemberRow
                  key={email ?? index}
                  profileId={member.profile_id}
                  organizationId={activeOrg?.id ?? ""}
                  name={memberName}
                  initials={initialsOf(memberName)}
                  role={member.role}
                  isMe={member.profile_id === currentUser?.id}
                  canManage={canManage}
                  email={emailById.get(member.profile_id) ?? user.email ?? null}
                  returnTo={PAGE_PATH}
                  subtitle={subtitle}
                  accessCount={canManage ? member.profiles?.access_count ?? 0 : undefined}
                  lastAccessLabel={canManage ? lastAccessLabel(member.profiles?.last_access_at) : undefined}
                />
              );
            }

            const inviteHref = `/usuarios?email=${encodeURIComponent(user.email ?? "")}&nome=${encodeURIComponent(
              user.name ?? ""
            )}&role=${suggestedInviteRole(user)}#convidar`;

            return (
              <div
                key={email ?? index}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "14px 20px",
                  borderTop: "1px solid var(--o-border)",
                  flexWrap: "wrap",
                  opacity: user.active === false ? 0.55 : 1,
                }}
              >
                <div
                  style={{
                    width: 40, height: 40, borderRadius: 999,
                    background: "var(--o-cream, #f1ede6)",
                    color: "var(--o-text-3)",
                    border: "1px solid var(--o-border)",
                    display: "grid", placeItems: "center",
                    font: "600 13px var(--font-inter)",
                    flexShrink: 0,
                  }}
                >
                  {initialsOf(name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 14, color: "var(--o-text-1)" }}>{name}</div>
                  {user.email && (
                    <div style={{ fontSize: 12, color: "var(--o-text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {user.email}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: "var(--o-text-3)" }}>{subtitle}</div>
                </div>

                {invite ? (
                  <span className="diario-status-badge">Convite pendente</span>
                ) : (
                  <span className="diario-status-badge is-paused">Sem acesso ao Obrália</span>
                )}

                {canManage && !invite && user.email ? (
                  <Link
                    href={inviteHref}
                    className="chip"
                    style={{ fontSize: 12, textDecoration: "none" }}
                    title={`Convidar ${name} para acessar o Obrália`}
                  >
                    Convidar
                  </Link>
                ) : null}
                {canManage && !invite && !user.email ? (
                  <span style={{ fontSize: 11, color: "var(--o-text-3)" }} title="Sem e-mail no Diário; não é possível convidar">
                    Sem e-mail
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 14, fontSize: 12, color: "var(--o-text-3)" }}>
        Membros com login têm ações diretas aqui (papel, senha, exclusão). Para convidar alguém que não veio do
        Diário, use a página{" "}
        <Link href="/usuarios" style={{ color: "var(--t-brand)" }}>
          Usuários
        </Link>
        .
      </div>
    </CadastroShell>
  );
}
