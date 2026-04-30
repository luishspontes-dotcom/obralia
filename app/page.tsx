export default function Home() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#FAF9F5", color: "#141413" }}>
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        <div style={{ width: 64, height: 64, background: "#141413", color: "#FAF9F5", borderRadius: 16, display: "grid", placeItems: "center", margin: "0 auto 24px" }}>
          <svg width={36} height={36} viewBox="0 0 32 32" fill="none">
            <circle cx={16} cy={16} r={11} stroke="currentColor" strokeWidth={2.4} />
            <line x1={2.5} y1={16} x2={29.5} y2={16} stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
          </svg>
        </div>
        <h1 style={{ font: "700 36px var(--font-inter, sans-serif)", letterSpacing: "-0.02em", margin: "0 0 12px" }}>obralia</h1>
        <p style={{ fontStyle: "italic", color: "#6F6E68", margin: "0 0 24px" }}>No prumo, sempre.</p>
        <p style={{ color: "#6F6E68", lineHeight: 1.6 }}>Sistema operacional da obra. Em construção — vamos lançar em breve.</p>
      </div>
    </main>
  );
}
