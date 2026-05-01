"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;

    void import("@sentry/nextjs").then((Sentry) => {
      Sentry.captureException(error);
    });
  }, [error]);

  return (
    <html lang="pt-BR">
      <body>
        <main
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: 24,
            fontFamily: "system-ui, sans-serif",
            background: "#FAF9F5",
            color: "#141413",
          }}
        >
          <div style={{ maxWidth: 520, textAlign: "center" }}>
            <h1 style={{ margin: "0 0 8px", fontSize: 28 }}>
              Não foi possível carregar o Obralia
            </h1>
            <p style={{ margin: 0, color: "#6F6E68" }}>
              Atualize a página. Se o erro continuar, o suporte já terá o
              registro técnico para investigar.
            </p>
          </div>
        </main>
      </body>
    </html>
  );
}
