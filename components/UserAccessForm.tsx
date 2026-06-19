"use client";

import { useMemo, useState } from "react";
import { PERMISSION_DOMAINS, PERMISSION_ACTIONS, PROFILE_LABELS, normalizeMatrix, type PermissionMatrix } from "@/lib/member-permissions";
import { saveMemberAccess } from "@/lib/member-permissions-actions";

type SiteOption = { id: string; name: string };

export default function UserAccessForm(props: {
  profileId: string;
  name: string;
  email: string | null;
  roleLabel: string;
  initialJobTitle: string | null;
  initialProfileLabel: string | null;
  initialPermissions: unknown;
  initialSiteIds: string[];
  sites: SiteOption[];
}) {
  const [jobTitle, setJobTitle] = useState(props.initialJobTitle ?? "");
  const [profileLabel, setProfileLabel] = useState(props.initialProfileLabel ?? "Personalizado");
  const [matrix, setMatrix] = useState<PermissionMatrix>(normalizeMatrix(props.initialPermissions));
  const [selected, setSelected] = useState<Set<string>>(new Set(props.initialSiteIds));
  const [siteQuery, setSiteQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const toggle = (domain: string, action: string) => {
    setMatrix((m) => ({ ...m, [domain]: { ...m[domain], [action]: !m[domain]?.[action] } }));
  };
  const toggleSite = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filteredSites = useMemo(() => {
    const q = siteQuery.trim().toLowerCase();
    return q ? props.sites.filter((s) => s.name.toLowerCase().includes(q)) : props.sites;
  }, [props.sites, siteQuery]);

  const allSelected = selected.size === props.sites.length && props.sites.length > 0;
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(props.sites.map((s) => s.id)));
  };

  return (
    <form action={saveMemberAccess} onSubmit={() => setSaving(true)} style={{ display: "grid", gap: 18 }}>
      <input type="hidden" name="profileId" value={props.profileId} />
      <input type="hidden" name="permissions_json" value={JSON.stringify(matrix)} />
      <input type="hidden" name="site_ids_json" value={JSON.stringify([...selected])} />

      {/* Informações do usuário */}
      <div className="card" style={{ padding: "22px 24px" }}>
        <h3 className="section-title" style={{ marginBottom: 16 }}>Informações do usuário</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <FieldRO label="Nome" value={props.name} />
          <FieldRO label="E-mail de acesso" value={props.email ?? "—"} />
          <Field label="Cargo">
            <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} name="job_title" placeholder="Ex: Engenheiro" style={inputStyle} />
          </Field>
          <Field label="Perfil de acesso">
            <select name="profile_label" value={profileLabel} onChange={(e) => setProfileLabel(e.target.value)} style={inputStyle}>
              {PROFILE_LABELS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
        </div>
        <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--o-text-3)" }}>
          Papel atual no sistema: <strong>{props.roleLabel}</strong>
        </p>
      </div>

      {/* Permissões de acesso */}
      <div className="card" style={{ padding: "22px 24px" }}>
        <h3 className="section-title" style={{ marginBottom: 16 }}>Permissões de acesso</h3>
        <div className="do-table-wrap">
          <table className="do-table" style={{ minWidth: 520 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}> </th>
                {PERMISSION_ACTIONS.map((a) => <th key={a.key} style={{ textAlign: "center" }}>{a.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_DOMAINS.map((d) => (
                <tr key={d.key}>
                  <td style={{ fontWeight: 600 }}>{d.label}</td>
                  {PERMISSION_ACTIONS.map((a) => (
                    <td key={a.key} style={{ textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={matrix[d.key]?.[a.key] ?? false}
                        onChange={() => toggle(d.key, a.key)}
                        style={{ width: 16, height: 16, cursor: "pointer" }}
                        aria-label={`${d.label} — ${a.label}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Obras que pode acessar */}
      <div className="card" style={{ padding: "22px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
          <h3 className="section-title" style={{ margin: 0 }}>Obras que pode acessar ({selected.size})</h3>
          <button type="button" className="chip" onClick={toggleAll}>
            {allSelected ? "Desmarcar todas" : "Selecionar todas"}
          </button>
        </div>
        <input
          value={siteQuery}
          onChange={(e) => setSiteQuery(e.target.value)}
          placeholder="Pesquisar obra…"
          style={{ ...inputStyle, marginBottom: 12 }}
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8, maxHeight: 320, overflowY: "auto" }}>
          {filteredSites.map((s) => (
            <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer", padding: "4px 2px" }}>
              <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSite(s.id)} style={{ width: 16, height: 16 }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
            </label>
          ))}
          {filteredSites.length === 0 && <p style={{ fontSize: 13, color: "var(--o-text-3)" }}>Nenhuma obra encontrada.</p>}
        </div>
      </div>

      <div>
        <button type="submit" className="btn-brand" disabled={saving} style={{ padding: "12px 22px", fontSize: 15 }}>
          {saving ? "Salvando…" : "Salvar permissões"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, color: "var(--o-text-2)", marginBottom: 6, fontWeight: 500 }}>{label}</label>
      {children}
    </div>
  );
}

function FieldRO({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, color: "var(--o-text-2)", marginBottom: 6, fontWeight: 500 }}>{label}</label>
      <div style={{ ...inputStyle, background: "var(--o-surface, #f5f5f5)", color: "var(--o-text-2)" }}>{value}</div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--o-paper)",
  border: "1px solid var(--o-border)",
  borderRadius: 10,
  padding: "11px 14px",
  font: "400 14px var(--font-inter)",
  color: "var(--o-text)",
};
