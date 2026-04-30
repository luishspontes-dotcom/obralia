import Link from "next/link";

export function EmBreve({
  title,
  description,
  emoji = "🚧",
  cta,
}: {
  title: string;
  description: string;
  emoji?: string;
  cta?: { label: string; href: string };
}) {
  return (
    <div style={{ padding: "24px", maxWidth: 1280, margin: "0 auto" }}>
      <div
        style={{
          background: "var(--o-paper)",
          border: "1px solid var(--o-border)",
          borderRadius: 16,
          padding: "64px 32px",
          textAlign: "center",
          maxWidth: 560,
          margin: "60px auto 0",
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16 }}>{emoji}</div>
        <h1
          style={{
            margin: "0 0 8px",
            font: "700 24px var(--font-inter)",
            letterSpacing: "-0.02em",
          }}
        >
          {title}
        </h1>
        <p
          className="font-body-lora"
          style={{
            color: "var(--o-text-2)",
            fontSize: 15,
            lineHeight: 1.6,
            maxWidth: 440,
            margin: "0 auto 24px",
          }}
        >
          {description}
        </p>
        {cta && (
          <Link
            href={cta.href}
            style={{
              display: "inline-block",
              padding: "10px 18px",
              background: "var(--o-accent)",
              color: "white",
              borderRadius: 10,
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            {cta.label}
          </Link>
        )}
      </div>
    </div>
  );
}
