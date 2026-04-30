"use client";

import { useState, FormEvent } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";

export function ChangePasswordForm() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "err">("idle");
  const [msg, setMsg] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pw.length < 8) { setStatus("err"); setMsg("Senha precisa ter ao menos 8 caracteres."); return; }
    if (pw !== pw2) { setStatus("err"); setMsg("As senhas não coincidem."); return; }
    setStatus("sending"); setMsg("");

    const sb = createBrowserSupabase();
    const { error } = await sb.auth.updateUser({ password: pw });
    if (error) {
      setStatus("err"); setMsg(error.message);
      return;
    }
    setStatus("ok"); setMsg("Senha trocada. Use a nova no próximo login.");
    setPw(""); setPw2("");
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "var(--o-cream)",
    border: "1px solid var(--o-border)",
    borderRadius: 8,
    padding: "10px 12px",
    font: "400 14px var(--font-inter)",
    color: "var(--o-text-1)",
    marginBottom: 10,
    outline: "none",
  };

  return (
    <form onSubmit={submit}>
      <input type="password" placeholder="Nova senha" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={8} style={inputStyle} />
      <input type="password" placeholder="Confirmar senha" value={pw2} onChange={(e) => setPw2(e.target.value)} required minLength={8} style={inputStyle} />
      <button type="submit" disabled={status === "sending"} style={{
        padding: "10px 16px",
        background: status === "sending" ? "var(--o-text-3)" : "var(--o-accent)",
        color: "white",
        border: 0,
        borderRadius: 8,
        font: "600 14px var(--font-inter)",
        cursor: status === "sending" ? "not-allowed" : "pointer",
      }}>
        {status === "sending" ? "Atualizando…" : "Trocar senha"}
      </button>
      {status === "ok" && <div style={{ marginTop: 10, fontSize: 13, color: "var(--st-done)" }}>{msg}</div>}
      {status === "err" && <div style={{ marginTop: 10, fontSize: 13, color: "var(--st-late)" }}>{msg}</div>}
    </form>
  );
}
