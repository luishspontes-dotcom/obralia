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

const redButtonStyle: React.CSSProperties = {
  ...blueButtonStyle,
  background: "#d32f2f",
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

const checkboxes = [
  { label: "Habilitar opção 'Copiar informações de um relatório já existente'", checked: true },
  { label: "Reabrir relatório aprovado (Aprovação eletrônica)", checked: false },
  { label: "Bloquear edição do relatório, após aprovação parcial (Aprovação eletrônica)", checked: false },
  { label: "Bloquear edição de comentário de outros usuários", checked: false },
];

export default async function Page() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let orgName = "Meu Viver Construtora e Incorporadora LTDA";

  if (user) {
    const { data: profileRaw } = await supabase
      .from("profiles")
      .select("default_org_id")
      .eq("id", user.id)
      .maybeSingle();
    const profile = profileRaw as { default_org_id: string | null } | null;

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
      <h1 style={{ font: "600 22px var(--font-inter)", margin: "8px 0 18px" }}>Empresa</h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 18,
          alignItems: "start",
        }}
      >
        {/* LEFT — Informações da empresa */}
        <div className="card" style={{ padding: "22px 24px" }}>
          <h3 style={sectionTitleStyle}>Informações da empresa</h3>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 22 }}>
            <div
              style={{
                width: "100%",
                maxWidth: 280,
                height: 120,
                border: "1px solid var(--o-border)",
                borderRadius: 12,
                background: "var(--o-surface,#f5f5f5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 22,
                letterSpacing: 1,
                color: "var(--t-brand)",
                marginBottom: 8,
              }}
            >
              MEU VIVER
            </div>
            <div style={{ fontSize: 12, color: "var(--o-text-2)", marginBottom: 12 }}>Logomarca</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" style={blueButtonStyle}>📷 Adicionar</button>
              <button type="button" style={redButtonStyle}>✕ Excluir</button>
            </div>
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <label style={labelStyle}>
                Nome da empresa <span style={{ color: "#d32f2f" }}>*</span>
              </label>
              <input defaultValue={orgName} style={inputStyle} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={labelStyle}>Razão social</label>
                <input defaultValue="MEU VIVER CONSTRUTORA E INCORPORADORA LTDA" readOnly style={inputROStyle} />
              </div>
              <div>
                <label style={labelStyle}>CNPJ</label>
                <input defaultValue="27.955.907/0001-60" readOnly style={inputROStyle} />
              </div>
            </div>
          </div>

          <div style={{ marginTop: 22 }}>
            <h3 style={{ ...sectionTitleStyle, margin: "0 0 12px" }}>Configurações</h3>
            <div style={{ display: "grid", gap: 12 }}>
              {checkboxes.map((c) => (
                <label key={c.label} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: "var(--o-text)", cursor: "pointer" }}>
                  <input type="checkbox" defaultChecked={c.checked} style={{ width: 16, height: 16, marginTop: 2, flexShrink: 0, cursor: "pointer" }} />
                  <span>{c.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT — Token de integração */}
        <div className="card" style={{ padding: "22px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
            <h3 style={{ ...sectionTitleStyle, margin: 0 }}>Token de integração</h3>
            <button
              type="button"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "var(--o-surface,#f5f5f5)",
                color: "var(--o-text-2)",
                border: "1px solid var(--o-border)",
                borderRadius: 8,
                padding: "9px 16px",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              🔒 Gerar token
            </button>
          </div>
          <a href="#" style={{ color: "var(--t-brand)", fontSize: 14, fontWeight: 500, textDecoration: "none" }}>
            Acessar a documentação
          </a>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <button type="button" style={saveButtonStyle}>✓ Salvar</button>
      </div>
    </div>
  );
}
