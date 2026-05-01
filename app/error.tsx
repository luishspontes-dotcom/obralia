"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;

    void import("@sentry/nextjs").then((Sentry) => {
      Sentry.captureException(error);
    });
  }, [error]);

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <div
        style={{
          background: "var(--o-paper)",
          border: "1px solid var(--o-border)",
          borderRadius: 12,
          padding: 32,
        }}
      >
        <h1 style={{ margin: "0 0 8px", font: "700 24px var(--font-inter)" }}>
          Algo saiu do prumo
        </h1>
        <p style={{ margin: "0 0 20px", color: "var(--o-text-2)" }}>
          O erro foi registrado. Tente novamente; se persistir, fale com o
          suporte.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            padding: "10px 14px",
            background: "var(--o-accent)",
            color: "white",
            border: 0,
            borderRadius: 8,
            font: "600 14px var(--font-inter)",
            cursor: "pointer",
          }}
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
