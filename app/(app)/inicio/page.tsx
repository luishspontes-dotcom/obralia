import Link from "next/link";
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

  let fullName: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    fullName = (profile as { full_name?: string } | null)?.full_name ?? null;
  }

  const firstName =
    fullName?.split(" ")[0] ??
    user?.email?.split("@")[0] ??
    "";

  // Real counts
  const { count: obrasCount } = await supabase
    .from("sites")
    .select("*", { count: "exact", head: true });

  const { data: lateRows } = await supabase
    .from("wbs_items")
    .select("site_id")
    .eq("status", "late");

  const lateSiteIds = new Set(
    ((lateRows ?? []) as { site_id: string }[]).map((r) => r.site_id)
  );

  const { count: tasksDoneCount } = await supabase
    .from("wbs_items")
    .select("*", { count: "exact", head: true })
    .eq("status", "done");

  const { count: tasksInProgressCount } = await supabase
    .from("wbs_items")
    .select("*", { count: "exact", head: true })
    .eq("status", "in_progress");

  const stats = [
    { label: "Obras ativas", value: String(obrasCount ?? 0), href: "/obras" },
    { label: "Em risco", value: String(lateSiteIds.size), href: "/obras?status=at-risk" },
    { label: "Atividades em curso", value: String(tasksInProgressCount ?? 0), href: "/obras" },
    { label: "Concluídas", value: String(tasksDoneCount ?? 0), href: "/obras" },
  ];

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
        Aqui está o resumo da operação. Use a barra lateral pra navegar pelas
        obras, RDOs e mensagens.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            style={{
              background: "var(--o-paper)",
              border: "1px solid var(--o-border)",
              borderLeft: "3px solid var(--t-brand)",
              borderRadius: 12,
              padding: "16px 18px",
              textDecoration: "none",
              color: "inherit",
              transition: "150ms",
              display: "block",
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
          </Link>
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
          {obrasCount && obrasCount > 0 ? `${obrasCount} obras importadas do ClickUp` : "Caixa de entrada vazia"}
        </div>
        <div
          className="font-body-lora"
          style={{
            color: "var(--o-text-2)",
            fontSize: 14,
            maxWidth: 560,
            margin: "0 auto",
          }}
        >
          {obrasCount && obrasCount > 0 ? (
            <>
              Vá em <Link href="/obras" style={{ color: "var(--o-accent)", textDecoration: "none", fontWeight: 500 }}>Obras → Em andamento</Link> pra ver a lista completa
              com status, fases e atividades. RDOs e fotos do Diário virão em breve.
            </>
          ) : (
            "Quando alguém atribuir uma tarefa, criar um RDO ou comentar em uma obra, vai aparecer aqui."
          )}
        </div>
      </div>
    </div>
  );
}
