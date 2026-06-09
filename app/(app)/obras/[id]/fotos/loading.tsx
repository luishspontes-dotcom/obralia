// Skeleton da galeria de fotos: sidebar da obra + grid de quadrados 1:1 com shimmer.
export default function Loading() {
  return (
    <div className="do-obra-layout" aria-busy="true" aria-label="Carregando fotos…">
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
              <div className="skeleton" style={{ width: 120, height: 22, marginBottom: 8 }} />
              <div className="skeleton skeleton-line" style={{ width: 150, height: 10 }} />
            </div>
            <div className="skeleton" style={{ width: 300, height: 34 }} />
          </div>

          {/* Grid de quadrados 1:1 */}
          <section className="do-panel" style={{ padding: 16 }}>
            <div className="skeleton skeleton-line" style={{ width: 160, marginBottom: 14 }} />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                gap: 6,
              }}
            >
              {Array.from({ length: 18 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ aspectRatio: "1 / 1", borderRadius: 2 }} />
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
