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
  const [status, setStatus] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");
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
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setStatus("error");
        setErrorMsg("E-mail ou senha incorretos.");
        return;
      }
      router.push("/inicio");
      router.refresh();
      return;
    }

    const redirect =
      (process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin) +
      "/auth/callback";

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirect },
    });

    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
    } else {
      setStatus("sent");
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background:
          "radial-gradient(ellipse 60% 40% at 50% 30%, rgba(217,119,87,0.12), transparent), var(--o-cream)",
      }}
    >
      <div
        style={{
          background: "var(--o-paper)",
          border: "1px solid var(--o-border)",
          borderRadius: "24px",
          padding: "48px 56px",
          width: "min(480px, 100%)",
          boxShadow: "var(--shadow-lg)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            background: "var(--o-dark)",
            color: "var(--o-cream)",
            borderRadius: 14,
            display: "grid",
            placeItems: "center",
            margin: "0 auto 20px",
          }}
        >
          <svg width={30} height={30} viewBox="0 0 32 32" fill="none">
            <circle cx={16} cy={16} r={11} stroke="currentColor" strokeWidth={2.4} />
            <line
              x1={2.5}
              y1={16}
              x2={29.5}
              y2={16}
              stroke="currentColor"
              strokeWidth={2.4}
              strokeLinecap="round"
            />
          </svg>
        </div>

        <div
          style={{
            font: "700 30px var(--font-inter)",
            letterSpacing: "-0.025em",
            marginBottom: 6,
          }}
        >
          obralia
        </div>
        <div
          className="font-body-lora"
          style={{
            fontSize: 14,
            color: "var(--o-text-2)",
            fontStyle: "italic",
            marginBottom: 36,
          }}
        >
          No prumo, sempre.
        </div>

        <h2
          style={{
            font: "600 22px var(--font-inter)",
            margin: "0 0 4px",
            letterSpacing: "-0.02em",
          }}
        >
          {status === "sent" ? "Cheque seu e-mail" : "Entrar na sua conta"}
        </h2>
        <div style={{ fontSize: 14, color: "var(--o-text-2)", marginBottom: 28 }}>
          {status === "sent"
            ? `Enviamos um link de acesso para ${email}. Abra no seu computador.`
            : mode === "password"
            ? "Use o e-mail e senha cadastrados pela sua construtora."
            : "Use o e-mail cadastrado pela sua construtora. Enviamos um link mágico."}
        </div>

        {status !== "sent" && (
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@construtora.com.br"
              style={{
                width: "100%",
                background: "var(--o-cream)",
                border: "1px solid var(--o-border)",
                borderRadius: 10,
                padding: "12px 14px",
                font: "400 15px var(--font-inter)",
                color: "var(--o-text-1)",
                marginBottom: 12,
                textAlign: "left",
                outline: "none",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--o-accent)";
                e.currentTarget.style.boxShadow = "0 0 0 3px var(--o-accent-soft)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--o-border)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />

            {mode === "password" && (
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha"
                style={{
                  width: "100%",
                  background: "var(--o-cream)",
                  border: "1px solid var(--o-border)",
                  borderRadius: 10,
                  padding: "12px 14px",
                  font: "400 15px var(--font-inter)",
                  color: "var(--o-text-1)",
                  marginBottom: 12,
                  textAlign: "left",
                  outline: "none",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--o-accent)";
                  e.currentTarget.style.boxShadow = "0 0 0 3px var(--o-accent-soft)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--o-border)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            )}

            <button
              type="submit"
              disabled={status === "sending"}
              style={{
                width: "100%",
                padding: 12,
                background:
                  status === "sending" ? "var(--o-text-3)" : "var(--o-accent)",
                color: "white",
                border: 0,
                borderRadius: 10,
                font: "600 15px var(--font-inter)",
                cursor: status === "sending" ? "not-allowed" : "pointer",
                transition: "200ms",
              }}
            >
              {status === "sending"
                ? "Entrando…"
                : mode === "password"
                ? "Entrar"
                : "Enviar link de acesso →"}
            </button>

            <button
              type="button"
              onClick={() => {
                setMode(mode === "password" ? "magic" : "password");
                setErrorMsg("");
                setStatus("idle");
              }}
              style={{
                width: "100%",
                padding: "10px 12px",
                marginTop: 10,
                background: "transparent",
                color: "var(--o-text-2)",
                border: 0,
                font: "500 13px var(--font-inter)",
                cursor: "pointer",
              }}
            >
              {mode === "password"
                ? "Prefere link mágico no e-mail?"
                : "Prefere entrar com senha?"}
            </button>

            {status === "error" && (
              <div
                style={{
                  color: "var(--st-late)",
                  fontSize: 13,
                  marginTop: 12,
                }}
              >
                {errorMsg}
              </div>
            )}
          </form>
        )}

        <div
          style={{
            marginTop: 32,
            paddingTop: 20,
            borderTop: "1px solid var(--o-border)",
            fontSize: 12,
            color: "var(--o-text-3)",
          }}
        >
          Sua construtora ainda não usa Obralia?{" "}
          <a
            href="mailto:contato@obralia.com.br"
            style={{
              color: "var(--o-accent)",
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            Solicite uma demo
          </a>
          <div style={{ marginTop: 14, fontSize: 11 }}>
            obralia.app · obralia.com.br
          </div>
        </div>
      </div>
    </main>
  );
}
