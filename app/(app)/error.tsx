"use client";

import { useEffect } from "react";
import Link from "next/link";

// Error boundary do segmento (app): cobre todas as rotas internas.
export default function AppSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Mantém o erro visível no console pra diagnóstico
    console.error("[obralia] erro de rota:", error);

    if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
    void import("@sentry/nextjs").then((Sentry) => {
      Sentry.captureException(error);
    });
  }, [error]);

  return (
    <div style={{ padding: "64px 24px", maxWidth: 560, margin: "0 auto" }}>
      <div className="empty" style={{ padding: "56px 32px" }}>
        <div className="empty-emoji">🚧</div>
        <h2
          style={{
            margin: "0 0 8px",
            font: "700 20px var(--font-inter)",
            letterSpacing: "-0.02em",
            color: "var(--o-text-1)",
          }}
        >
          Algo deu errado por aqui
        </h2>
        <p style={{ margin: "0 0 24px", fontSize: 14, color: "var(--o-text-2)", lineHeight: 1.6 }}>
          Não conseguimos carregar esta página. Pode ser uma instabilidade
          momentânea — tente de novo. Se o problema continuar, volte ao início.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button type="button" className="btn-brand" onClick={() => reset()}>
            Tentar novamente
          </button>
          <Link href="/inicio" className="chip" style={{ padding: "8px 16px", fontSize: 13 }}>
            Voltar ao início
          </Link>
        </div>
        {error.digest && (
          <div style={{ marginTop: 20, fontSize: 11, color: "var(--o-text-3)" }} className="tnum">
            Código do erro: {error.digest}
          </div>
        )}
      </div>
    </div>
  );
}
