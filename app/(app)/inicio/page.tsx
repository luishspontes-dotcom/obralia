import Link from "next/link";
import { ArrowRight, Inbox } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";

type InboxItem = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  created_at: string | null;
};

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

  const { count: tasksInProgressCount } = await supabase
    .from("wbs_items")
    .select("*", { count: "exact", head: true })
    .eq("status", "in_progress");

  const { count: rdosCount } = await supabase
    .from("daily_reports")
    .select("*", { count: "exact", head: true });

  const { data: inboxRows } = user
    ? await supabase
        .from("notifications")
        .select("id, title, body, link, created_at")
        .eq("recipient_id", user.id)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(5)
    : { data: [] };
  const inboxItems = (inboxRows ?? []) as InboxItem[];

  const stats = [
    { label: "Obras", value: String(obrasCount ?? 0), href: "/obras" },
    { label: "RDOs registrados", value: String(rdosCount ?? 0), href: "/obras" },
    { label: "Atividades em curso", value: String(tasksInProgressCount ?? 0), href: "/tarefas?status=in_progress" },
    { label: "Em risco", value: String(lateSiteIds.size), href: "/obras?status=at-risk" },
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
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            padding: "18px 20px",
            borderBottom: "1px solid var(--o-border)",
          }}
        >
          <div>
            <h2 style={{ margin: 0, font: "600 17px var(--font-inter)" }}>
              Caixa de entrada
            </h2>
            <p style={{ margin: "2px 0 0", color: "var(--o-text-2)", fontSize: 13 }}>
              {inboxItems.length === 0
                ? "Nenhuma pendência agora."
                : `${inboxItems.length} ${inboxItems.length === 1 ? "item" : "itens"} recentes.`}
            </p>
          </div>
          <Link
            href="/caixa"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: "var(--o-accent)",
              fontWeight: 600,
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            Abrir <ArrowRight size={15} />
          </Link>
        </div>

        {inboxItems.length === 0 ? (
          <div style={{ padding: 36, textAlign: "center" }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 12,
                display: "grid",
                placeItems: "center",
                margin: "0 auto 12px",
                color: "var(--t-brand)",
                background: "var(--t-brand-soft)",
              }}
            >
              <Inbox size={22} />
            </div>
            <div style={{ font: "600 16px var(--font-inter)", marginBottom: 4 }}>
              Caixa de entrada vazia
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
              Quando alguém atribuir uma tarefa, criar um RDO ou comentar em uma
              obra, vai aparecer aqui.
            </div>
          </div>
        ) : (
          inboxItems.map((item, index) => (
            <Link
              key={item.id}
              href={item.link ?? "/caixa"}
              style={{
                display: "block",
                padding: "14px 20px",
                borderTop: index === 0 ? "none" : "1px solid var(--o-border)",
                color: "inherit",
                textDecoration: "none",
              }}
            >
              <div style={{ font: "600 14px var(--font-inter)" }}>
                {item.title}
              </div>
              {item.body && (
                <div style={{ color: "var(--o-text-2)", fontSize: 13, marginTop: 2 }}>
                  {item.body}
                </div>
              )}
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
