"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";

type Mode = "password" | "magic";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("sending");
    setErrorMsg("");

    const supabase = createBrowserSupabase();

    if (mode === "password") {
      if (!password) {
        setStatus("error");
        setErrorMsg("Informe sua senha.");
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setStatus("error");
        setErrorMsg("E-mail ou senha incorretos.");
        return;
      }
      router.push("/inicio");
      router.refresh();
      return;
    }

    const redirect = (process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin) + "/auth/callback";
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } });

    if (error) { setStatus("error"); setErrorMsg(error.message); }
    else setStatus("sent");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        position: "relative",
        background: `
          radial-gradient(ellipse 80% 50% at 50% 0%, rgba(8, 120, 155, 0.18), transparent 65%),
          radial-gradient(ellipse 60% 40% at 50% 100%, rgba(8, 120, 155, 0.10), transparent 65%),
          var(--o-bg)
        `,
      }}
    >
      {/* sutil pattern de blueprint */}
      <div aria-hidden style={{
        position: "absolute", inset: 0, opacity: 0.04, pointerEvents: "none",
        backgroundImage: "linear-gradient(var(--t-brand) 1px, transparent 1px), linear-gradient(90deg, var(--t-brand) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }} />

      <div
        className="card"
        style={{
          padding: "44px 48px",
          width: "min(440px, 100%)",
          boxShadow: "var(--shadow-lg)",
          textAlign: "center",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            width: 60, height: 60,
            background: "var(--t-brand)",
            color: "white",
            borderRadius: 14,
            display: "grid",
            placeItems: "center",
            margin: "0 auto 22px",
            boxShadow: "var(--shadow-brand)",
          }}
        >
          <svg width={32} height={32} viewBox="0 0 32 32" fill="none">
            <circle cx={16} cy={16} r={11} stroke="currentColor" strokeWidth={2.4} />
            <line x1={2.5} y1={16} x2={29.5} y2={16} stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
          </svg>
        </div>

        <div style={{ font: "700 32px var(--font-inter)", letterSpacing: "-0.025em", marginBottom: 4, color: "var(--o-text-1)" }}>
          obralia
        </div>
        <div className="font-body-lora" style={{ fontSize: 14, color: "var(--o-text-2)", fontStyle: "italic", marginBottom: 32 }}>
          No prumo, sempre.
        </div>

        <h2 style={{ font: "600 20px var(--font-inter)", margin: "0 0 6px", letterSpacing: "-0.01em" }}>
          {status === "sent" ? "Cheque seu e-mail" : "Entre na sua conta"}
        </h2>
        <div style={{ fontSize: 13.5, color: "var(--o-text-2)", marginBottom: 24, lineHeight: 1.55 }}>
          {status === "sent"
            ? <>Enviamos um link de acesso para <strong>{email}</strong>. Abra no seu computador.</>
            : mode === "password"
            ? "Use o e-mail e senha cadastrados pela sua construtora."
            : "Enviamos um link mágico no seu e-mail."}
        </div>

        {status !== "sent" && (
          <form onSubmit={handleSubmit}>
            <input
              type="email" required
              value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@construtora.com.br"
              style={inputStyle}
            />

            {mode === "password" && (
              <input
                type="password" required
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha"
                style={inputStyle}
              />
            )}

            <button type="submit" disabled={status === "sending"}
              className="btn-brand"
              style={{
                width: "100%",
                padding: "12px",
                fontSize: 15,
                background: status === "sending" ? "var(--o-text-3)" : undefined,
                cursor: status === "sending" ? "not-allowed" : "pointer",
                justifyContent: "center",
                marginTop: 4,
              }}>
              {status === "sending" ? "Entrando…" : mode === "password" ? "Entrar" : "Enviar link de acesso →"}
            </button>

            <button type="button"
              onClick={() => { setMode(mode === "password" ? "magic" : "password"); setErrorMsg(""); setStatus("idle"); }}
              style={{
                width: "100%", padding: "10px 12px", marginTop: 10,
                background: "transparent", color: "var(--o-text-2)",
                border: 0, font: "500 13px var(--font-inter)", cursor: "pointer",
              }}>
              {mode === "password" ? "Prefere link mágico no e-mail?" : "Prefere entrar com senha?"}
            </button>

            {status === "error" && (
              <div style={{
                color: "var(--st-late)", fontSize: 13, marginTop: 12,
                padding: "10px 14px", background: "rgba(180, 61, 61, 0.08)",
                borderRadius: 8, border: "1px solid rgba(180, 61, 61, 0.25)",
              }}>
                {errorMsg}
              </div>
            )}
          </form>
        )}

        <div
          style={{
            marginTop: 28, paddingTop: 22,
            borderTop: "1px solid var(--o-border)",
            fontSize: 12, color: "var(--o-text-3)",
          }}
        >
          Sua construtora ainda não usa Obralia?{" "}
          <a href="mailto:contato@obralia.com.br" style={{ color: "var(--t-brand)", textDecoration: "none", fontWeight: 600 }}>
            Solicite uma demo
          </a>
          <div style={{ marginTop: 12, fontSize: 11 }}>
            obralia.app · obralia.com.br
          </div>
        </div>
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--o-paper)",
  border: "1px solid var(--o-border)",
  borderRadius: 10,
  padding: "12px 14px",
  font: "400 15px var(--font-inter)",
  color: "var(--o-text-1)",
  marginBottom: 10,
  textAlign: "left",
  outline: "none",
  transition: "all var(--duration) var(--ease)",
};
