import { createServerSupabase } from "@/lib/supabase/server";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Boa noite";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default async function InicioPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user!.id)
    .single();

  const firstName =
    profile?.full_name?.split(" ")[0] ??
    user?.email?.split("@")[0] ??
    "";

  return (
    <div style={{ padding: "24px", maxWidth: 1280, margin: "0 auto" }}>
      <h1
        style={{
          margin: "0 0 8px",
          font: "700 32px var(--font-inter)",
          letterSpacing: "-0.02em",
        }}
      >
        {greeting()}, {firstName}.
      </h1>
      <p
        className="font-body-lora"
        style={{
          fontSize: 17,
          color: "var(--o-text-2)",
          lineHeight: 1.55,
          maxWidth: 760,
          margin: "0 0 32px",
        }}
      >
        Bem-vindo ao <strong style={{ color: "var(--o-text-1)" }}>Obralia</strong>.
        Por enquanto, esta é a base — Sprint 1 da fundação está rodando. Em
        breve aqui mostramos sua caixa de entrada, frentes em andamento e obras
        que exigem atenção.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {[
          { label: "Obras", value: "0" },
          { label: "Em risco", value: "0" },
          { label: "RDOs para aprovar", value: "0" },
          { label: "Fotos esta semana", value: "0" },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              background: "var(--o-paper)",
              border: "1px solid var(--o-border)",
              borderLeft: "3px solid var(--t-brand)",
              borderRadius: 12,
              padding: "16px 18px",
            }}
          >
            <div
              style={{
                font: "500 12px var(--font-inter)",
                color: "var(--o-text-2)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginBottom: 6,
              }}
            >
              {s.label}
            </div>
            <div
              className="tnum"
              style={{
                font: "600 28px var(--font-inter)",
                letterSpacing: "-0.02em",
              }}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          background: "var(--o-paper)",
          border: "1px solid var(--o-border)",
          borderRadius: 12,
          padding: 32,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 8 }}>🏗</div>
        <div
          style={{
            font: "600 17px var(--font-inter)",
            marginBottom: 4,
          }}
        >
          Caixa de entrada vazia
        </div>
        <div
          className="font-body-lora"
          style={{
            color: "var(--o-text-2)",
            fontSize: 14,
            maxWidth: 480,
            margin: "0 auto",
          }}
        >
          Quando alguém atribuir uma tarefa, criar um RDO ou comentar em uma
          obra, vai aparecer aqui. Em breve.
        </div>
      </div>
    </div>
  );
}
