import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Você está offline — Obralia",
};

export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: "32px 24px",
        textAlign: "center",
        background: "var(--o-bg)",
      }}
    >
      <div style={{ fontSize: 56, lineHeight: 1 }} aria-hidden="true">
        📴
      </div>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--o-text-1)" }}>
        Você está offline
      </h1>
      <p style={{ margin: 0, maxWidth: 420, fontSize: 15, lineHeight: 1.6, color: "var(--o-text-2)" }}>
        Sem problema: seus RDOs salvos no aparelho serão sincronizados
        automaticamente quando a conexão voltar.
      </p>
      <Link
        href="/inicio"
        className="btn-brand"
        style={{ marginTop: 8, padding: "12px 24px", fontSize: 15, borderRadius: 10, textDecoration: "none" }}
      >
        Ir para o início
      </Link>
      <p style={{ margin: 0, fontSize: 13, color: "var(--o-text-3)" }}>
        As páginas que você já visitou continuam disponíveis.
      </p>
    </main>
  );
}
