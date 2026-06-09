// Skeleton da lista de RDOs: sidebar da obra + linhas da tabela com shimmer.
export default function Loading() {
  return (
    <div className="do-obra-layout" aria-busy="true" aria-label="Carregando RDOs…">
      {/* Sidebar da obra */}
      <aside className="do-obra-sidebar" style={{ padding: 14 }}>
        <div className="skeleton" style={{ height: 104, marginBottom: 16, borderRadius: 0 }} />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton skeleton-line" style={{ width: "80%", marginBottom: 14 }} />
        ))}
      </aside>

      <main className="do-obra-main">
        <div className="diario-container">
          <div className="diario-page-header">
            <div>
              <div className="skeleton" style={{ width: 160, height: 22, marginBottom: 8 }} />
              <div className="skeleton skeleton-line" style={{ width: 200, height: 10 }} />
            </div>
            <div className="skeleton" style={{ width: 300, height: 34 }} />
          </div>

          {/* Linhas da tabela de relatórios */}
          <section className="do-panel">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 18,
                  padding: "14px 18px",
                  borderTop: i === 0 ? "none" : "1px solid var(--o-border)",
                }}
              >
                <div className="skeleton" style={{ width: 80, height: 14 }} />
                <div className="skeleton" style={{ width: 36, height: 14 }} />
                <div className="skeleton" style={{ width: 86, height: 18, borderRadius: 999 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton skeleton-line" style={{ width: "45%" }} />
                </div>
                <div className="skeleton" style={{ width: 60, height: 14 }} />
              </div>
            ))}
          </section>
        </div>
      </main>
    </div>
  );
}
