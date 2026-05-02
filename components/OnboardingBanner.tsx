"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const KEY = "obralia_onboarding_v1_dismissed";

export function OnboardingBanner({ rdoCount, siteCount }: { rdoCount: number; siteCount: number }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(KEY)) setShow(true);
  }, []);

  if (!show) return null;

  return (
    <div style={{
      background: "linear-gradient(135deg, var(--t-brand-mist) 0%, var(--o-mist) 100%)",
      border: "1px solid var(--t-brand-soft)",
      borderRadius: 14,
      padding: "16px 20px",
      marginBottom: 24,
      display: "flex",
      alignItems: "center",
      gap: 14,
      flexWrap: "wrap",
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: "var(--t-brand)",
        display: "grid", placeItems: "center",
        color: "white", fontSize: 20,
      }}>
        ✨
      </div>

      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--o-text-1)", marginBottom: 2 }}>
          Importamos seus dados do Diário de Obras
        </div>
        <div style={{ fontSize: 12.5, color: "var(--o-text-2)", lineHeight: 1.5 }}>
          {siteCount} obras, {rdoCount.toLocaleString("pt-BR")} RDOs e todas as fotos já estão aqui — pronto pra você validar e começar a usar.
        </div>
      </div>

      <Link
        href="/obras"
        style={{
          padding: "8px 14px",
          background: "var(--t-brand)",
          color: "white",
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 500,
          textDecoration: "none",
        }}
      >
        Ver obras →
      </Link>

      <button
        type="button"
        onClick={() => { localStorage.setItem(KEY, "1"); setShow(false); }}
        title="Dispensar"
        style={{
          width: 30, height: 30, borderRadius: 8,
          background: "transparent", border: "1px solid var(--o-border)",
          color: "var(--o-text-2)", fontSize: 16, cursor: "pointer",
          display: "grid", placeItems: "center",
        }}
      >
        ×
      </button>
    </div>
  );
}
