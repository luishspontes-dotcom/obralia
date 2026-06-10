"use client";

import { useState } from "react";

/**
 * Banner mostrado UMA única vez após gerar senha temporária
 * (a senha vem do searchParam e não é persistida em lugar nenhum).
 */
export function TempPasswordBanner({ name, password }: { name: string; password: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard indisponível — usuário seleciona manualmente */
    }
  }

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
      padding: "12px 16px", marginBottom: 16,
      background: "var(--o-accent-soft)",
      border: "1px solid var(--o-accent)",
      borderRadius: 10,
    }}>
      <span style={{ fontSize: 13, color: "var(--o-text-1)" }}>
        Senha temporária de <strong>{name}</strong>:
      </span>
      <code style={{
        padding: "4px 10px", borderRadius: 6,
        background: "white", border: "1px solid var(--o-border)",
        font: "600 14px var(--font-mono, monospace)", color: "var(--t-brand-d)",
        userSelect: "all",
      }}>{password}</code>
      <button type="button" onClick={copy} className="chip" style={{ padding: "5px 12px", fontSize: 12, cursor: "pointer" }}>
        {copied ? "Copiado ✓" : "Copiar"}
      </button>
      <span style={{ fontSize: 12, color: "var(--o-text-3)" }}>
        Anote agora — ela não será mostrada de novo. Peça para o usuário trocá-la em Configurações.
      </span>
    </div>
  );
}
