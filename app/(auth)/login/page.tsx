"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, LogIn, Mail } from "lucide-react";
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
    <main className="do-auth-page">
      <header className="do-auth-bar">
        <div className="do-auth-bar__brand">
          <span className="do-auth-logo">O</span>
          <span>Obrália</span>
        </div>
        <span>MEU VIVER CONSTRUTORA E INCORPORADORA LTDA</span>
      </header>

      <section className="do-auth-shell">
        <div className="do-auth-card">
          <div className="do-auth-card__head">
            <div>
              <span>Acesso ao sistema</span>
              <h1>{status === "sent" ? "Cheque seu e-mail" : "Entrar"}</h1>
            </div>
            <div className="do-auth-card__badge">Obras</div>
          </div>

          <p className="do-auth-copy">
            {status === "sent"
              ? <>Enviamos um link de acesso para <strong>{email}</strong>.</>
              : mode === "password"
                ? "Use o usuário e senha cadastrados pela construtora para acessar as obras."
                : "Informe seu e-mail para receber o link de acesso."}
          </p>

        {status !== "sent" && (
          <form onSubmit={handleSubmit} className="do-auth-form">
            <label>
              <span>Usuário</span>
              <div className="do-auth-input">
                <Mail size={16} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@construtora.com.br"
                />
              </div>
            </label>

            {mode === "password" && (
              <label>
                <span>Senha</span>
                <div className="do-auth-input">
                  <LockKeyhole size={16} />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Sua senha"
                  />
                </div>
              </label>
            )}

            <button type="submit" disabled={status === "sending"} className="do-auth-submit">
              <LogIn size={17} />
              {status === "sending" ? "Entrando…" : mode === "password" ? "Entrar" : "Enviar link de acesso →"}
            </button>

            <button type="button"
              onClick={() => { setMode(mode === "password" ? "magic" : "password"); setErrorMsg(""); setStatus("idle"); }}
              className="do-auth-alt">
              {mode === "password" ? "Prefere link mágico no e-mail?" : "Prefere entrar com senha?"}
            </button>

            {status === "error" && (
              <div className="do-auth-error">
                {errorMsg}
              </div>
            )}
          </form>
        )}

          <div className="do-auth-foot">
            Sua construtora ainda não usa Obrália?{" "}
            <a href="mailto:contato@obralia.com.br">
            Solicite uma demo
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
