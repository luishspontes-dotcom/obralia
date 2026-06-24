"use client";

import { useMemo, useState } from "react";
import { PERMISSION_GROUPS, PROFILE_LABELS, normalizeMatrix, type PermissionMatrix } from "@/lib/member-permissions";
import { saveMemberAccess, sendMemberPasswordReset } from "@/lib/member-permissions-actions";

type SiteOption = { id: string; name: string };

export default function UserAccessForm(props: {
  profileId: string;
  name: string;
  email: string | null;
  roleLabel: string;
  initialJobTitle: string | null;
  initialProfileLabel: string | null;
  initialPermissions: unknown;
  initialActive?: boolean;
  initialSiteIds: string[];
  sites: SiteOption[];
}) {
  const [jobTitle, setJobTitle] = useState(props.initialJobTitle ?? "");
  const [profileLabel, setProfileLabel] = useState(props.initialProfileLabel ?? "Personalizado");
  const [matrix, setMatrix] = useState<PermissionMatrix>(normalizeMatrix(props.initialPermissions));
  const [active, setActive] = useState(props.initialActive ?? true);
  const [selected, setSelected] = useState<Set<string>>(new Set(props.initialSiteIds));
  const [siteQuery, setSiteQuery] = useState("");
  const [adding, setAdding] = useState(false);
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

  // Obras já liberadas (mostradas na lista com o X) e obras que ainda dá pra
  // adicionar (mostradas no seletor "+ Adicionar", filtradas pela busca).
  const selectedSites = useMemo(
    () => props.sites.filter((s) => selected.has(s.id)),
    [props.sites, selected],
  );
  const addableSites = useMemo(() => {
    const q = siteQuery.trim().toLowerCase();
    return props.sites.filter((s) => !selected.has(s.id) && (!q || s.name.toLowerCase().includes(q)));
  }, [props.sites, selected, siteQuery]);

  const allSelected = selected.size === props.sites.length && props.sites.length > 0;
  const addAll = () => setSelected(new Set(props.sites.map((s) => s.id)));
  const clearAll = () => setSelected(new Set());

  return (
    <form action={saveMemberAccess} onSubmit={() => setSaving(true)} style={{ display: "grid", gap: 18 }}>
      <input type="hidden" name="profileId" value={props.profileId} />
      <input type="hidden" name="permissions_json" value={JSON.stringify(matrix)} />
      <input type="hidden" name="site_ids_json" value={JSON.stringify([...selected])} />
      <input type="hidden" name="active" value={active ? "true" : "false"} />

      {/* Salvar no topo-direito, como no Diário */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: -4 }}>
        <button type="submit" disabled={saving}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#16a34a", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 15, fontWeight: 600, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>✓</span> {saving ? "Salvando…" : "Salvar"}
        </button>
      </div>

      {/* Topo: Informações | Obras (2 colunas, como no Diário) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18, alignItems: "start" }}>
        {/* Informações do usuário */}
        <div className="card" style={{ padding: "22px 24px" }}>
          <h3 style={sectionTitleStyle}>Informações do usuário</h3>
          <div style={{ display: "grid", gap: 14 }}>
            <FieldRO label="Nome" value={props.name} />
            <FieldRO label="E-mail de acesso" value={props.email ?? "—"} />
            <div>
              <button type="submit" formAction={sendMemberPasswordReset} className="chip" style={{ color: "var(--t-brand)" }}>
                Alterar senha
              </button>
            </div>
            <Field label="Cargo">
              <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} name="job_title" placeholder="Ex: Engenheiro" style={inputStyle} />
            </Field>
            <Field label="Perfil de acesso">
              <select name="profile_label" value={profileLabel} onChange={(e) => setProfileLabel(e.target.value)} style={inputStyle}>
                {PROFILE_LABELS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--o-text-3)", lineHeight: 1.4 }}>
                Acessa somente as obras, telas e funcionalidades selecionadas no sistema.
              </p>
            </Field>
            <Field label="Status">
              <div style={{ display: "flex", gap: 18, alignItems: "center", paddingTop: 4 }}>
                <label style={radioStyle}>
                  <input type="radio" name="active_radio" checked={active} onChange={() => setActive(true)} />
                  Ativo
                </label>
                <label style={radioStyle}>
                  <input type="radio" name="active_radio" checked={!active} onChange={() => setActive(false)} />
                  Inativo
                </label>
              </div>
            </Field>
          </div>
          <p style={{ margin: "14px 0 0", fontSize: 11, color: "var(--o-text-3)" }}>
            Papel atual no sistema: <strong>{props.roleLabel}</strong>
          </p>
        </div>

        {/* Obras que pode acessar — modelo do Diário: lista liberada + Adicionar */}
        <div className="card" style={{ padding: "22px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
            <h3 style={{ ...sectionTitleStyle, margin: 0 }}>Obras que pode acessar ({selected.size})</h3>
            <button type="button" className="btn-brand" style={{ padding: "7px 14px", fontSize: 13 }} onClick={() => setAdding((a) => !a)}>
              + Adicionar
            </button>
          </div>

          {adding && (
            <div style={{ border: "1px solid var(--o-border)", borderRadius: 10, padding: 12, marginBottom: 12, background: "var(--o-surface, #f7f7f7)" }}>
              <input
                value={siteQuery}
                onChange={(e) => setSiteQuery(e.target.value)}
                placeholder="Pesquisar obra para adicionar…"
                style={{ ...inputStyle, marginBottom: 8 }}
              />
              <div style={{ display: "grid", gap: 4, maxHeight: 220, overflowY: "auto" }}>
                {addableSites.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleSite(s.id)}
                    style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", background: "transparent", border: "none", padding: "7px 8px", borderRadius: 8, cursor: "pointer", fontSize: 14, color: "var(--o-text)" }}
                  >
                    <span style={{ color: "var(--t-brand)", fontWeight: 700 }}>+</span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                  </button>
                ))}
                {addableSites.length === 0 && <p style={{ fontSize: 13, color: "var(--o-text-3)", margin: "4px 6px" }}>Todas as obras já foram adicionadas.</p>}
              </div>
              {!allSelected && (
                <button type="button" className="chip" onClick={addAll} style={{ marginTop: 8, fontSize: 12 }}>Adicionar todas</button>
              )}
            </div>
          )}

          <div style={{ border: "1px solid var(--o-border)", borderRadius: 10, maxHeight: 360, overflowY: "auto" }}>
            {selectedSites.map((s, i) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "11px 14px", borderTop: i === 0 ? "none" : "1px solid var(--o-border)" }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 14 }}>{s.name}</span>
                <button type="button" onClick={() => toggleSite(s.id)} title="Remover acesso a esta obra"
                  style={{ background: "transparent", border: "none", color: "#2563eb", fontSize: 16, lineHeight: 1, cursor: "pointer", padding: 2, flexShrink: 0 }}>✕</button>
              </div>
            ))}
            {selectedSites.length === 0 && (
              <p style={{ fontSize: 13, color: "var(--o-text-3)", padding: "16px 14px", margin: 0 }}>
                Nenhuma obra liberada. Clique em <strong>+ Adicionar</strong>.
              </p>
            )}
          </div>
          {selected.size > 0 && (
            <button type="button" className="chip" onClick={clearAll} style={{ marginTop: 10, fontSize: 12 }}>Remover todas</button>
          )}
        </div>
      </div>

      {/* Permissões de acesso (largura total) */}
      <div className="card" style={{ padding: "22px 24px" }}>
        <h3 style={sectionTitleStyle}>Permissões de acesso</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 24, alignItems: "start" }}>
          {PERMISSION_GROUPS.map((g) => (
            <div key={g.key} style={{ gridColumn: g.items.length > 6 ? "1 / -1" : "auto" }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: g.hint ? 2 : 10 }}>{g.label}</div>
              {g.hint ? <div style={{ fontSize: 11, color: "var(--o-text-3)", marginBottom: 10 }}>{g.hint}</div> : null}
              <div style={{ display: "grid", gridTemplateColumns: g.items.length > 6 ? "repeat(auto-fit, minmax(180px, 1fr))" : "1fr", gap: 8 }}>
                {g.items.map((it) => (
                  <label key={it.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={matrix[g.key]?.[it.key] ?? false}
                      onChange={() => toggle(g.key, it.key)}
                      style={{ width: 16, height: 16, cursor: "pointer" }}
                    />
                    {it.label}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
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

const sectionTitleStyle: React.CSSProperties = {
  margin: "0 0 16px",
  color: "#FF6F00",
  font: "600 17px var(--font-inter)",
  letterSpacing: 0,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--o-paper)",
  border: "1px solid var(--o-border)",
  borderRadius: 10,
  padding: "11px 14px",
  font: "400 14px var(--font-inter)",
  color: "var(--o-text)",
};

const radioStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 14,
  cursor: "pointer",
};
