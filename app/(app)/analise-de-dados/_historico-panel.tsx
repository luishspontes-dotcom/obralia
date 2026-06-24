export function HistoricoPanel({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="page-hero">
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "var(--t-brand)",
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            {eyebrow}
          </div>
          <h1
            style={{
              margin: 0,
              font: "700 32px var(--font-inter)",
              letterSpacing: "-0.025em",
              color: "var(--o-text-1)",
            }}
          >
            {title}
          </h1>
        </div>
      </div>

      <div style={{ padding: "0 24px 32px", maxWidth: 1280, margin: "0 auto" }}>
        <div
          className="stat-card"
          style={{ padding: "20px 22px" }}
        >
          <h2 className="section-title" style={{ margin: "0 0 8px" }}>
            Em breve
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              lineHeight: 1.55,
              color: "var(--o-text-2)",
            }}
          >
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
