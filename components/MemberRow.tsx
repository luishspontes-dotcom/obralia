"use client";

import { useState } from "react";
import { updateMemberRole, removeMember } from "@/lib/rdo-actions";

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "owner",    label: "Owner" },
  { value: "admin",    label: "Admin" },
  { value: "engineer", label: "Engenheiro" },
  { value: "viewer",   label: "Visualizador" },
];

export function MemberRow({
  profileId, organizationId, name, initials, role, isMe, canManage,
}: {
  profileId: string;
  organizationId: string;
  name: string;
  initials: string;
  role: string;
  isMe: boolean;
  canManage: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "14px 20px",
      borderTop: "1px solid var(--o-border)",
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 999,
        background: "linear-gradient(135deg, var(--t-brand), var(--t-brand-d))",
        color: "white",
        display: "grid", placeItems: "center",
        font: "600 13px var(--font-inter)",
        flexShrink: 0,
      }}>{initials}</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 500, fontSize: 14, color: "var(--o-text-1)" }}>{name}</span>
          {isMe && (
            <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 999, background: "var(--t-brand-soft)", color: "var(--t-brand)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Você
            </span>
          )}
        </div>
      </div>

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
      ) : (
        <span className={`status ${role === "owner" || role === "admin" ? "status-progress" : "status-paused"}`}>
          {ROLE_OPTIONS.find(o => o.value === role)?.label ?? role}
        </span>
      )}

      {canManage && !isMe && !editing && (
        <>
          <button type="button" onClick={() => setEditing(true)} title="Editar"
            style={{
              width: 28, height: 28, borderRadius: 6, border: "1px solid var(--o-border)",
              background: "transparent", color: "var(--o-text-3)", fontSize: 13,
              cursor: "pointer", display: "grid", placeItems: "center",
            }}>✎</button>
          {confirmRemove ? (
            <form action={removeMember} style={{ display: "flex", gap: 4 }}>
              <input type="hidden" name="profile_id" value={profileId} />
              <input type="hidden" name="organization_id" value={organizationId} />
              <button type="submit" className="chip" style={{ padding: "4px 10px", fontSize: 11, color: "#b3261e", borderColor: "#f5c6c2" }}>Confirmar</button>
              <button type="button" onClick={() => setConfirmRemove(false)} className="chip" style={{ padding: "4px 10px", fontSize: 11 }}>×</button>
            </form>
          ) : (
            <button type="button" onClick={() => setConfirmRemove(true)} title="Remover"
              style={{
                width: 28, height: 28, borderRadius: 6, border: "1px solid var(--o-border)",
                background: "transparent", color: "var(--o-text-3)", fontSize: 14,
                cursor: "pointer", display: "grid", placeItems: "center",
              }}>×</button>
          )}
        </>
      )}
    </div>
  );
}
