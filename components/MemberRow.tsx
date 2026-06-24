"use client";

import Link from "next/link";
import { useState } from "react";
import { Copy } from "lucide-react";
import { updateMemberRole, removeMember } from "@/lib/rdo-actions";
import {
  adminResetPasswordEmail,
  adminSetTemporaryPassword,
  adminDeleteUser,
} from "@/lib/user-admin-actions";

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "owner",    label: "Owner" },
  { value: "admin",    label: "Admin" },
  { value: "engineer", label: "Engenheiro" },
  { value: "viewer",   label: "Visualizador" },
];

type ConfirmAction = "remove" | "temp" | "delete" | null;

const iconBtnStyle: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 6, border: "1px solid var(--o-border)",
  background: "transparent", color: "var(--o-text-3)", fontSize: 13,
  cursor: "pointer", display: "grid", placeItems: "center",
};

export function MemberRow({
  profileId, organizationId, name, initials, role, isMe, canManage, email, returnTo, subtitle,
  accessCount, lastAccessLabel, active = true,
}: {
  profileId: string;
  organizationId: string;
  name: string;
  initials: string;
  role: string;
  isMe: boolean;
  canManage: boolean;
  /** Status Ativo/Inativo (default Ativo). */
  active?: boolean;
  email?: string | null;
  /** Página para onde as ações redirecionam (default /usuarios). */
  returnTo?: string;
  /** Linha extra de contexto (ex.: grupo do Diário). */
  subtitle?: string | null;
  /** Quantidade de logins (visível só quando fornecido — admins). */
  accessCount?: number | null;
  /** Último acesso já formatado no servidor (evita divergência de fuso). */
  lastAccessLabel?: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmAction>(null);

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "14px 20px",
      borderTop: "1px solid var(--o-border)",
      flexWrap: "wrap",
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 999,
        background: "linear-gradient(135deg, var(--t-brand), var(--t-brand-d))",
        color: "white",
        display: "grid", placeItems: "center",
        font: "600 13px var(--font-inter)",
        flexShrink: 0,
      }}>{initials}</div>

      <div style={{ flex: "1 1 170px", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{ fontWeight: 500, fontSize: 14, color: "var(--o-text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }} title={name}>{name}</span>
          {isMe && (
            <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 999, background: "var(--t-brand-soft)", color: "var(--t-brand)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Você
            </span>
          )}
        </div>
        {email && (
          <div style={{ fontSize: 12, color: "var(--o-text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {email}
          </div>
        )}
        {subtitle && (
          <div style={{ fontSize: 11, color: "var(--o-text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {subtitle}
          </div>
        )}
      </div>

      {typeof accessCount === "number" && (
        <span
          title={lastAccessLabel ? `Último acesso: ${lastAccessLabel}` : "Nunca acessou"}
          style={{ display: "grid", justifyItems: "end", lineHeight: 1.3, flexShrink: 0 }}
        >
          <span style={{ fontSize: 11, fontWeight: 600, color: accessCount > 0 ? "var(--t-brand)" : "var(--o-text-3)", whiteSpace: "nowrap" }}>
            {accessCount} acesso{accessCount === 1 ? "" : "s"}
          </span>
          <span style={{ fontSize: 10, color: "var(--o-text-3)", whiteSpace: "nowrap" }}>
            {lastAccessLabel ?? "nunca entrou"}
          </span>
        </span>
      )}

      <span className={`diario-status-badge ${active ? "is-done" : "is-paused"}`} style={{ flexShrink: 0 }}>
        {active ? "Ativo" : "Inativo"}
      </span>

      {editing && canManage ? (
        <form action={async (fd) => { await updateMemberRole(fd); setEditing(false); }} style={{ display: "flex", gap: 6 }}>
          <input type="hidden" name="profile_id" value={profileId} />
          <input type="hidden" name="organization_id" value={organizationId} />
          <select name="role" defaultValue={role} style={{
            padding: "6px 10px", border: "1px solid var(--o-border)",
            borderRadius: 6, fontSize: 13, background: "white",
          }}>
            {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button type="submit" className="btn-brand" style={{ padding: "6px 10px", fontSize: 12 }}>Salvar</button>
          <button type="button" onClick={() => setEditing(false)} className="chip" style={{ padding: "6px 10px", fontSize: 12 }}>Cancel</button>
        </form>
      ) : null}

      {canManage && !editing && confirm === null && (
        <Link href={`/usuarios/${profileId}`} title="Editar permissões e obras que pode acessar"
          style={{ ...iconBtnStyle, textDecoration: "none" }}>⚙</Link>
      )}

      {canManage && !isMe && !editing && confirm === null && (
        <>
          <button type="button" onClick={() => setEditing(true)} title="Editar papel"
            style={{ ...iconBtnStyle, color: "#d32f2f" }}>✎</button>
          {email && (
            <button type="button" onClick={() => { void navigator.clipboard.writeText(email); }}
              title="Copiar e-mail" style={iconBtnStyle}>
              <Copy size={14} />
            </button>
          )}
          <form action={adminResetPasswordEmail} style={{ display: "contents" }}>
            <input type="hidden" name="profile_id" value={profileId} />
            <input type="hidden" name="email" value={email ?? ""} />
            <input type="hidden" name="next" value={returnTo ?? "/usuarios"} />
            <button type="submit" disabled={!email}
              title={email ? "Enviar e-mail de redefinição de senha" : "E-mail do usuário não disponível"}
              style={{ ...iconBtnStyle, opacity: email ? 1 : 0.4, cursor: email ? "pointer" : "not-allowed" }}>🔑</button>
          </form>
          <button type="button" onClick={() => setConfirm("temp")}
            title="Gerar senha temporária (mostrada uma única vez)"
            style={iconBtnStyle}>🔐</button>
          <button type="button" onClick={() => setConfirm("remove")}
            title="Remover da organização (só desvincula; não apaga o login)"
            style={iconBtnStyle}>×</button>
          <button type="button" onClick={() => setConfirm("delete")}
            title="Excluir usuário (apaga o acesso e o login de verdade)"
            style={{ ...iconBtnStyle, fontSize: 12 }}>🗑</button>
        </>
      )}

      {canManage && !isMe && !editing && confirm === "remove" && (
        <form action={removeMember} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input type="hidden" name="profile_id" value={profileId} />
          <input type="hidden" name="organization_id" value={organizationId} />
          <span style={{ fontSize: 11, color: "var(--o-text-3)" }}>Remover da organização? O login continua existindo.</span>
          <button type="submit" className="chip" style={{ padding: "4px 10px", fontSize: 11, color: "#b3261e", borderColor: "#f5c6c2" }}>Confirmar</button>
          <button type="button" onClick={() => setConfirm(null)} className="chip" style={{ padding: "4px 10px", fontSize: 11 }}>×</button>
        </form>
      )}

      {canManage && !isMe && !editing && confirm === "temp" && (
        <form action={adminSetTemporaryPassword} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input type="hidden" name="profile_id" value={profileId} />
          <input type="hidden" name="next" value={returnTo ?? "/usuarios"} />
          <span style={{ fontSize: 11, color: "var(--o-text-3)" }}>Gerar senha temporária? A senha atual deixa de funcionar.</span>
          <button type="submit" className="chip" style={{ padding: "4px 10px", fontSize: 11, color: "var(--t-brand)", borderColor: "var(--t-brand-soft)" }}>Confirmar</button>
          <button type="button" onClick={() => setConfirm(null)} className="chip" style={{ padding: "4px 10px", fontSize: 11 }}>×</button>
        </form>
      )}

      {canManage && !isMe && !editing && confirm === "delete" && (
        <form action={adminDeleteUser} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input type="hidden" name="profile_id" value={profileId} />
          <input type="hidden" name="next" value={returnTo ?? "/usuarios"} />
          <span style={{ fontSize: 11, color: "#b3261e" }}>
            Excluir de verdade? Remove o acesso e o login; o histórico de RDOs fica preservado sem autor.
          </span>
          <button type="submit" className="chip" style={{ padding: "4px 10px", fontSize: 11, color: "white", background: "#b3261e", borderColor: "#b3261e" }}>Excluir</button>
          <button type="button" onClick={() => setConfirm(null)} className="chip" style={{ padding: "4px 10px", fontSize: 11 }}>×</button>
        </form>
      )}
    </div>
  );
}
