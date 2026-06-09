// Skeleton genérico exibido enquanto qualquer página do app carrega no servidor.
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Carregando página…">
      {/* Hero */}
      <div className="page-hero">
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div className="skeleton skeleton-line" style={{ width: 120, marginBottom: 14 }} />
          <div className="skeleton" style={{ width: 260, height: 32, marginBottom: 12 }} />
          <div className="skeleton skeleton-line" style={{ width: 200 }} />
        </div>
      </div>

      {/* Conteúdo */}
      <div
        style={{
          padding: "0 24px 32px",
          maxWidth: 1280,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: 18,
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton-card">
            <div className="skeleton" style={{ aspectRatio: "16 / 10", borderRadius: 0 }} />
            <div style={{ padding: "14px 16px 16px" }}>
              <div className="skeleton skeleton-line" style={{ width: "70%", marginBottom: 10 }} />
              <div className="skeleton skeleton-line" style={{ width: "45%" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
