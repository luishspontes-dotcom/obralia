import { createServerSupabase } from "@/lib/supabase/server";

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--o-paper)",
  border: "1px solid var(--o-border)",
  borderRadius: 10,
  padding: "11px 14px",
  font: "400 14px var(--font-inter)",
  color: "var(--o-text)",
};

const inputROStyle: React.CSSProperties = {
  ...inputStyle,
  background: "var(--o-surface,#f5f5f5)",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "var(--o-text-2)",
  marginBottom: 6,
  fontWeight: 500,
};

const sectionTitleStyle: React.CSSProperties = {
  margin: "0 0 16px",
  color: "#FF6F00",
  font: "600 16px var(--font-inter)",
};

const saveButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "#16a34a",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "10px 20px",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
};

const blueButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "var(--t-brand)",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "9px 16px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};

export default async function Page() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let fullName = user?.email ?? "";
  let orgName = "—";

  if (user) {
    const { data: profileRaw } = await supabase
      .from("profiles")
      .select("full_name, default_org_id")
      .eq("id", user.id)
      .maybeSingle();
    const profile = profileRaw as { full_name: string | null; default_org_id: string | null } | null;

    if (profile?.full_name) fullName = profile.full_name;

    if (profile?.default_org_id) {
      const { data: orgRaw } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", profile.default_org_id)
        .maybeSingle();
      const org = orgRaw as { name: string | null } | null;
      if (org?.name) orgName = org.name;
    }
  }

  return (
    <div style={{ padding: "0 24px 28px" }}>
      <h1 style={{ font: "600 22px var(--font-inter)", margin: "8px 0 18px" }}>Meu perfil</h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 18,
          alignItems: "start",
        }}
      >
        {/* LEFT — Informações do usuário */}
        <div className="card" style={{ padding: "22px 24px" }}>
          <h3 style={sectionTitleStyle}>Informações do usuário</h3>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 22 }}>
            <div
              style={{
                width: 150,
                height: 150,
                border: "1px solid var(--o-border)",
                borderRadius: 12,
                background: "var(--o-surface,#f5f5f5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 54,
                color: "var(--o-text-2)",
                marginBottom: 12,
              }}
            >
              👤
            </div>
            <button type="button" style={blueButtonStyle}>📷 Adicionar</button>
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <label style={labelStyle}>
                Nome <span style={{ color: "#d32f2f" }}>*</span>
              </label>
              <input defaultValue={fullName} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>
                E-mail de acesso <span style={{ color: "#d32f2f" }}>*</span>
              </label>
              <input defaultValue={user?.email ?? ""} readOnly style={inputROStyle} />
            </div>
            <div>
              <button
                type="button"
                style={{
                  background: "transparent",
                  border: "1px solid var(--o-border)",
                  borderRadius: 999,
                  padding: "7px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--t-brand)",
                  cursor: "pointer",
                }}
              >
                Alterar senha
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT — two stacked cards */}
        <div style={{ display: "grid", gap: 18, alignItems: "start" }}>
          <div className="card" style={{ padding: "22px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ ...sectionTitleStyle, margin: 0 }}>Minha assinatura</h3>
              <button type="button" style={{ ...blueButtonStyle, padding: "7px 14px", fontSize: 13 }}>
                + Adicionar
              </button>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "var(--o-text-2)" }}>
              Nenhuma assinatura vinculada a este usuário.
            </p>
          </div>

          <div className="card" style={{ padding: "22px 24px" }}>
            <h3 style={sectionTitleStyle}>Empresas que tenho acesso</h3>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "11px 14px",
                border: "1px solid var(--o-border)",
                borderRadius: 10,
                fontSize: 14,
                color: "var(--o-text)",
              }}
            >
              <span style={{ fontSize: 16 }}>🏢</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{orgName}</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <button type="button" style={saveButtonStyle}>✓ Salvar</button>
      </div>
    </div>
  );
}
