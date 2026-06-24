const sectionTitleStyle: React.CSSProperties = {
  margin: "0 0 16px",
  color: "#FF6F00",
  font: "600 16px var(--font-inter)",
};

const kvLabelStyle: React.CSSProperties = {
  padding: "10px 14px",
  fontSize: 13,
  color: "var(--o-text-2)",
  background: "var(--o-surface,#f5f5f5)",
  borderBottom: "1px solid var(--o-border)",
  fontWeight: 500,
};

const kvValueStyle: React.CSSProperties = {
  padding: "10px 14px",
  fontSize: 13,
  color: "var(--o-text)",
  borderBottom: "1px solid var(--o-border)",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--o-text-2)",
  background: "var(--o-surface,#f5f5f5)",
  borderBottom: "1px solid var(--o-border)",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 13,
  color: "var(--o-text)",
  borderBottom: "1px solid var(--o-border)",
  whiteSpace: "nowrap",
};

const badgePaid: React.CSSProperties = {
  background: "#dcf5e8",
  color: "#137a4d",
  padding: "3px 10px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 600,
};

const badgeOpen: React.CSSProperties = {
  background: "#eef0f3",
  color: "#5f6673",
  padding: "3px 10px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 600,
};

function KV({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <>
      <div style={kvLabelStyle}>{label}</div>
      <div style={{ ...kvValueStyle, fontWeight: bold ? 700 : 400 }}>{value}</div>
    </>
  );
}

export default function Page() {
  return (
    <div style={{ padding: "0 24px 28px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ font: "600 22px var(--font-inter)", margin: "8px 0 18px" }}>Assinatura</h1>
        <button
          type="button"
          style={{
            background: "#d32f2f",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "9px 18px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Cancelar assinatura
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 18,
          alignItems: "start",
        }}
      >
        {/* Assinatura ativa */}
        <div className="card" style={{ padding: "22px 24px" }}>
          <h3 style={sectionTitleStyle}>Assinatura ativa</h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              border: "1px solid var(--o-border)",
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            <KV label="Data da contratação" value="24/08/2022" />
            <KV label="Contratado por" value="Edgar Medina" />
            <div style={{ gridColumn: "1 / -1", height: 8, background: "var(--o-surface,#f5f5f5)", borderBottom: "1px solid var(--o-border)" }} />
            <KV label="Plano" value="Plano 4" />
            <KV label="Valor" value="R$ 1.400,00" bold />
            <KV label="Renovação" value="Anual" />
            <KV label="Forma de pagamento" value="Boleto" />
            <KV label="Limite de obras" value="Ilimitado" />
            <KV label="Limite de usuários" value="Ilimitado" />
          </div>
        </div>

        {/* Histórico de pagamento */}
        <div className="card" style={{ padding: "22px 24px" }}>
          <h3 style={sectionTitleStyle}>Histórico de pagamento</h3>
          <div style={{ border: "1px solid var(--o-border)", borderRadius: 10, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Data</th>
                  <th style={thStyle}>Forma de pagamento</th>
                  <th style={thStyle}>Renovação</th>
                  <th style={thStyle}>Valor</th>
                  <th style={thStyle}>Cobrança</th>
                  <th style={thStyle}>Nota fiscal</th>
                  <th style={thStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={tdStyle}>10/09/2026</td>
                  <td style={tdStyle}>Boleto</td>
                  <td style={tdStyle}>Anual</td>
                  <td style={tdStyle}>R$ 1.400,00</td>
                  <td style={tdStyle}>-</td>
                  <td style={tdStyle}>-</td>
                  <td style={tdStyle}><span style={badgeOpen}>Em Aberto</span></td>
                </tr>
                <tr>
                  <td style={tdStyle}>10/09/2025</td>
                  <td style={tdStyle}>Boleto</td>
                  <td style={tdStyle}>Anual</td>
                  <td style={tdStyle}>R$ 1.400,00</td>
                  <td style={tdStyle}>901167605</td>
                  <td style={tdStyle}>120244</td>
                  <td style={tdStyle}><span style={badgePaid}>Pago</span></td>
                </tr>
                <tr>
                  <td style={tdStyle}>10/09/2024</td>
                  <td style={tdStyle}>Boleto</td>
                  <td style={tdStyle}>Anual</td>
                  <td style={tdStyle}>R$ 1.400,00</td>
                  <td style={tdStyle}>759457510</td>
                  <td style={tdStyle}>202400000087559</td>
                  <td style={tdStyle}><span style={badgePaid}>Pago</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
