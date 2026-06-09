// Skeleton do portfolio de obras: grid de cards estilo "diário" (capa 120px + texto).
export default function Loading() {
  return (
    <div className="diario-page" aria-busy="true" aria-label="Carregando obras…">
      <div className="diario-container">
        {/* Cabeçalho */}
        <div className="diario-page-header">
          <div>
            <div className="skeleton" style={{ width: 140, height: 22, marginBottom: 8 }} />
            <div className="skeleton skeleton-line" style={{ width: 180, height: 10 }} />
          </div>
          <div className="skeleton" style={{ width: 280, height: 34 }} />
        </div>

        {/* Grid de cards de obra */}
        <div className="diario-obra-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton-card" style={{ borderRadius: 4 }}>
              <div className="skeleton" style={{ height: 120, borderRadius: 0 }} />
              <div style={{ padding: "12px 12px 14px" }}>
                <div className="skeleton skeleton-line" style={{ width: "55%", height: 9, marginBottom: 10 }} />
                <div className="skeleton skeleton-line" style={{ width: "85%" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
