import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";

type Site = { id: string; name: string; start_date: string | null; end_date: string | null; status: string };

export default async function CronogramaPage() {
  const supabase = await createServerSupabase();
  const { data: sitesRaw } = await supabase
    .from("sites")
    .select("id, name, start_date, end_date, status")
    .not("start_date", "is", null)
    .order("start_date");
  const sites = (sitesRaw ?? []) as Site[];

  // Calcular range temporal global
  const dates = sites.flatMap((s) => [s.start_date, s.end_date]).filter(Boolean) as string[];
  if (dates.length === 0) {
    return (
      <div>
        <div className="page-hero">
          <h1 style={{ font: "700 32px var(--font-inter)" }}>Cronograma</h1>
        </div>
        <div className="empty" style={{ margin: 24 }}>
          <div className="empty-emoji">📅</div>
          <div>Nenhuma obra com datas cadastradas.</div>
        </div>
      </div>
    );
  }

  const minDate = new Date(Math.min(...dates.map((d) => new Date(d).getTime())));
  const maxDate = new Date(Math.max(...dates.map((d) => new Date(d).getTime())));
  const totalDays = Math.max(1, Math.ceil((maxDate.getTime() - minDate.getTime()) / 86400000));

  // Build months in range
  const months: { label: string; days: number; offset: number }[] = [];
  {
    const cur = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    while (cur <= maxDate) {
      const next = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      const offset = Math.max(0, Math.ceil((cur.getTime() - minDate.getTime()) / 86400000));
      const days = Math.ceil((next.getTime() - cur.getTime()) / 86400000);
      months.push({
        label: cur.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
        days, offset,
      });
      cur.setMonth(cur.getMonth() + 1);
    }
  }

  const STATUS_COLOR: Record<string, string> = {
    in_progress: "var(--st-progress, #08789B)",
    done: "var(--st-done, #137a4d)",
    late: "var(--st-late, #d83a3a)",
    paused: "var(--st-paused, #888)",
  };

  return (
    <div>
      <div className="page-hero">
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--t-brand)", fontWeight: 600, marginBottom: 8 }}>
            Cronograma
          </div>
          <h1 style={{ margin: "0 0 6px", font: "700 32px var(--font-inter)", letterSpacing: "-0.025em" }}>
            Cronograma das obras
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "var(--o-text-2)" }}>
            {sites.length} obras · linha do tempo de {minDate.toLocaleDateString("pt-BR")} até {maxDate.toLocaleDateString("pt-BR")}
          </p>
        </div>
      </div>

      <div style={{ padding: "0 24px 32px", maxWidth: 1280, margin: "0 auto" }}>
        <div className="card" style={{ padding: 0, overflow: "auto" }}>
          <div style={{ minWidth: 900, position: "relative" }}>
            {/* Header de meses */}
            <div style={{
              display: "grid",
              gridTemplateColumns: `220px 1fr`,
              borderBottom: "1px solid var(--o-border)",
              background: "var(--o-soft)",
              position: "sticky", top: 0, zIndex: 2,
            }}>
              <div style={{ padding: "12px 16px", font: "600 12px var(--font-inter)", color: "var(--o-text-2)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Obra
              </div>
              <div style={{ display: "flex", position: "relative", height: 36 }}>
                {months.map((m, i) => (
                  <div key={i} style={{
                    flex: m.days,
                    borderLeft: i > 0 ? "1px solid var(--o-border)" : "none",
                    padding: "10px 6px",
                    font: "600 11px var(--font-inter)",
                    color: "var(--o-text-2)",
                    textTransform: "capitalize",
                  }}>
                    {m.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Linhas de obras */}
            {sites.map((s) => {
              const start = s.start_date ? new Date(s.start_date) : minDate;
              const end = s.end_date ? new Date(s.end_date) : maxDate;
              const offsetDays = Math.max(0, Math.floor((start.getTime() - minDate.getTime()) / 86400000));
              const durationDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
              const left = (offsetDays / totalDays) * 100;
              const width = (durationDays / totalDays) * 100;
              const color = STATUS_COLOR[s.status] ?? "var(--t-brand)";
              return (
                <div key={s.id} style={{
                  display: "grid",
                  gridTemplateColumns: `220px 1fr`,
                  borderBottom: "1px solid var(--o-mist)",
                  alignItems: "center",
                }}>
                  <Link href={`/obras/${s.id}`} style={{
                    padding: "10px 16px", fontSize: 13, color: "var(--o-text-1)",
                    textDecoration: "none", fontWeight: 500,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {s.name}
                  </Link>
                  <div style={{ position: "relative", height: 32 }}>
                    <div title={`${start.toLocaleDateString("pt-BR")} → ${end.toLocaleDateString("pt-BR")}`}
                      style={{
                        position: "absolute",
                        left: `${left}%`,
                        width: `${width}%`,
                        top: 6, bottom: 6,
                        background: color,
                        borderRadius: 6,
                        opacity: 0.85,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
