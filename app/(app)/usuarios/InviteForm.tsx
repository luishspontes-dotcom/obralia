"use client";

import { useState, FormEvent } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";

export function InviteForm({ orgId }: { orgId: string }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "err">("idle");
  const [msg, setMsg] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setStatus("sending");
    const supabase = createBrowserSupabase();

    const redirect =
      (process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin) + "/auth/callback";

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirect,
        shouldCreateUser: true,
        data: { full_name: name, invited_to_org: orgId, invited_role: role },
      },
    });

    if (error) {
      setStatus("err");
      setMsg(error.message);
      return;
    }
    setStatus("ok");
    setMsg(`Convite enviado para ${email}. Quando ele clicar no link, vincule manualmente como ${role}.`);
    setEmail("");
    setName("");
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "var(--o-cream)",
    border: "1px solid var(--o-border)",
    borderRadius: 8,
    padding: "9px 12px",
    font: "400 14px var(--font-inter)",
    color: "var(--o-text-1)",
    marginBottom: 10,
    outline: "none",
  };

  return (
    <form onSubmit={submit}>
      <input
        type="email"
        required
        placeholder="email@empresa.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={inputStyle}
      />
      <input
        type="text"
        placeholder="Nome (opcional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={inputStyle}
      />
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as "admin" | "member")}
        style={inputStyle}
      >
        <option value="member">Membro</option>
        <option value="admin">Admin</option>
      </select>
      <button
        type="submit"
        disabled={status === "sending"}
        style={{
          width: "100%",
          padding: "10px 14px",
          background: status === "sending" ? "var(--o-text-3)" : "var(--o-accent)",
          color: "white",
          border: 0,
          borderRadius: 8,
          font: "600 14px var(--font-inter)",
          cursor: status === "sending" ? "not-allowed" : "pointer",
        }}
      >
        {status === "sending" ? "Enviando…" : "Enviar convite"}
      </button>
      {status === "ok" && (
        <div style={{ marginTop: 12, fontSize: 12, color: "var(--st-done)", lineHeight: 1.4 }}>
          {msg}
        </div>
      )}
      {status === "err" && (
        <div style={{ marginTop: 12, fontSize: 12, color: "var(--st-late)" }}>
          {msg}
        </div>
      )}
    </form>
  );
}
