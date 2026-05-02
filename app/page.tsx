import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function RootPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/inicio");

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg, #fafbfc 0%, #f4f7f8 100%)",
      color: "#141c2a",
      fontFamily: "var(--font-inter, system-ui)",
    }}>
      {/* Topbar minimalista */}
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "18px 32px", maxWidth: 1200, margin: "0 auto",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: "#08789B",
            display: "grid", placeItems: "center",
            boxShadow: "0 4px 12px rgba(8,120,155,0.25)",
          }}>
            <svg width={18} height={18} viewBox="0 0 32 32" fill="none">
              <circle cx={16} cy={16} r={11} stroke="white" strokeWidth={2.4} />
              <line x1={2.5} y1={16} x2={29.5} y2={16} stroke="white" strokeWidth={2.4} strokeLinecap="round" />
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: "-0.01em" }}>obralia</span>
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <Link href="/login" style={{
            color: "#4a5568", textDecoration: "none", fontSize: 14, fontWeight: 500,
          }}>Entrar</Link>
          <a href="mailto:luishspontes@gmail.com?subject=Obralia%20-%20demo"
            style={{
              padding: "9px 16px", background: "#08789B", color: "white",
              borderRadius: 8, fontSize: 13, fontWeight: 500, textDecoration: "none",
              boxShadow: "0 4px 12px rgba(8,120,155,0.25)",
            }}>Solicitar demo</a>
        </div>
      </header>

      {/* Hero */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "60px 32px 40px", textAlign: "center" }}>
        <div style={{
          display: "inline-block",
          padding: "5px 12px",
          background: "rgba(8,120,155,0.1)",
          color: "#08789B",
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 600,
          marginBottom: 18,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}>
          Sistema operacional da obra
        </div>
        <h1 style={{
          font: "700 56px var(--font-inter)",
          letterSpacing: "-0.035em",
          margin: "0 0 18px",
          lineHeight: 1.05,
          background: "linear-gradient(180deg, #141c2a 0%, #08789B 110%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}>
          O Diário de Obras<br/>como deveria ser.
        </h1>
        <p style={{
          fontSize: 19,
          color: "#4a5568",
          margin: "0 auto 32px",
          maxWidth: 640,
          lineHeight: 1.55,
        }}>
          RDOs, fotos, cronograma e gestão de equipe num único lugar — pensado pra construtoras
          de alto padrão que querem rastreabilidade sem fricção.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="mailto:luishspontes@gmail.com?subject=Obralia%20-%20demo"
            style={{
              padding: "14px 28px", background: "#08789B", color: "white",
              borderRadius: 10, fontSize: 15, fontWeight: 500, textDecoration: "none",
              boxShadow: "0 8px 24px rgba(8,120,155,0.3)",
            }}>Quero ver uma demo</a>
          <Link href="/login" style={{
            padding: "14px 28px", background: "white", color: "#141c2a",
            border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 15,
            fontWeight: 500, textDecoration: "none",
          }}>Já tenho conta</Link>
        </div>
      </section>

      {/* Features */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 32px 80px" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 20,
        }}>
          {[
            { e: "📋", t: "RDO completo no celular", d: "Mão de obra, atividades, clima, fotos com GPS, assinatura digital. Mestre fecha o relatório no canteiro." },
            { e: "📸", t: "Fotos centralizadas", d: "Galeria por obra, lightbox, comentário por foto. EXIF preservado, busca por mês." },
            { e: "📅", t: "Cronograma e Gantt", d: "Visualize todas as obras na timeline. Atrasos pulam pra cima sozinhos." },
            { e: "🗺️", t: "Mapa das obras", d: "Pin de cada obra. Cores por status. Coordenadas inferidas das fotos." },
            { e: "🔔", t: "Notificações em tempo real", d: "Sino na topbar com alertas de RDO criado, comentário, ocorrência crítica." },
            { e: "🏗", t: "Multi-tenant pronto", d: "Cada construtora isolada. RLS no banco. Roles: owner, admin, engenheiro, viewer." },
          ].map((f) => (
            <div key={f.t} style={{
              background: "white",
              border: "1px solid #e2e8f0",
              borderRadius: 14,
              padding: "22px 24px",
              boxShadow: "0 1px 3px rgba(20,28,42,0.04)",
            }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>{f.e}</div>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6, color: "#141c2a" }}>{f.t}</div>
              <div style={{ fontSize: 13.5, color: "#4a5568", lineHeight: 1.55 }}>{f.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Social proof */}
      <section style={{ maxWidth: 900, margin: "0 auto", padding: "60px 32px", textAlign: "center" }}>
        <div style={{
          background: "white",
          border: "1px solid #e2e8f0",
          borderRadius: 18,
          padding: "44px 36px",
          boxShadow: "0 8px 24px rgba(20,28,42,0.06)",
        }}>
          <div style={{
            fontSize: 13,
            color: "#08789B",
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: 14,
          }}>
            Em produção
          </div>
          <p style={{
            fontFamily: "var(--font-lora, serif)",
            fontSize: 22,
            fontStyle: "italic",
            lineHeight: 1.45,
            color: "#141c2a",
            margin: "0 0 20px",
          }}>
            &ldquo;Migramos 1.132 RDOs e 11 mil fotos do Diário de Obras para o Obralia em uma noite.
            Equipe agora fecha o relatório no canteiro — sem voltar pro escritório.&rdquo;
          </p>
          <div style={{ fontSize: 13, color: "#4a5568" }}>
            — Engenharia · Meu Viver Construtora · Brasília/DF
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: "1px solid #e2e8f0",
        padding: "32px",
        textAlign: "center",
        color: "#718096",
        fontSize: 12,
      }}>
        <div style={{ marginBottom: 8 }}>
          obralia.com.br · sistema operacional da obra
        </div>
        <div style={{ display: "flex", gap: 18, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/termos" style={{ color: "#718096", textDecoration: "none" }}>Termos</Link>
          <Link href="/privacidade" style={{ color: "#718096", textDecoration: "none" }}>Privacidade</Link>
          <a href="mailto:luishspontes@gmail.com" style={{ color: "#718096", textDecoration: "none" }}>Contato</a>
        </div>
      </footer>
    </div>
  );
}
