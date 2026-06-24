import { ListChecks } from "lucide-react";

const inputStyle = {
  width: "100%",
  background: "var(--o-paper)",
  border: "1px solid var(--o-border)",
  borderRadius: 10,
  padding: "11px 14px",
  font: "400 14px var(--font-inter)",
  color: "var(--o-text)",
} as const;

export default function Page() {
  return (
    <div>
      <h1 style={{ font: "600 22px var(--font-inter)", margin: "8px 0 18px" }}>
        Checklist (0)
      </h1>

      <div className="card" style={{ padding: "22px 24px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
          }}
        >
          <input
            type="search"
            placeholder="Pesquisa"
            style={{ ...inputStyle, maxWidth: 340 }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              title="Importar"
              style={{
                background: "var(--o-paper)",
                border: "1px solid var(--o-border)",
                borderRadius: 8,
                padding: "8px 12px",
                font: "400 16px var(--font-inter)",
                color: "var(--o-text-3)",
                cursor: "pointer",
              }}
            >
              ☁
            </button>
            <button
              type="button"
              style={{
                background: "var(--t-brand)",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "8px 16px",
                font: "500 14px var(--font-inter)",
                cursor: "pointer",
              }}
            >
              + Adicionar
            </button>
          </div>
        </div>

        <div style={{ padding: "60px 20px", textAlign: "center" }}>
          <ListChecks
            size={40}
            color="var(--o-text-3)"
            style={{ margin: "0 auto" }}
          />
          <div
            style={{
              font: "500 16px var(--font-inter)",
              color: "var(--o-text)",
              marginTop: 14,
            }}
          >
            Nenhum checklist encontrado
          </div>
          <div
            style={{
              font: "400 14px var(--font-inter)",
              color: "var(--o-text-3)",
              marginTop: 6,
            }}
          >
            Adicione novos checklists para realizar a checagem dos seus relatórios
          </div>
        </div>
      </div>
    </div>
  );
}
