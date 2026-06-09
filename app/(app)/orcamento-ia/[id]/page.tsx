import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, RefreshCcw } from "lucide-react";
import { approveAiEstimate, reprocessAiEstimate } from "@/lib/budget-ai/actions";
import { createServerSupabase } from "@/lib/supabase/server";
import { untypedDb } from "@/lib/supabase/untyped";
import { ExportButton } from "@/components/ExportButton";

type Estimate = {
  id: string;
  title: string;
  client_name: string | null;
  address: string | null;
  built_area_m2: number | null;
  pool_area_m2: number | null;
  terrain_area_m2: number | null;
  floors_count: number | null;
  has_basement: boolean;
  quality_standard: string;
  status: string;
  subtotal: number;
  total: number;
  confidence_score: number;
  memorial_text: string | null;
  created_at: string | null;
};

type Fact = {
  id: string;
  label: string;
  value_text: string | null;
  value_numeric: number | null;
  unit: string | null;
  confidence: number;
  source: string;
  needs_review: boolean;
};

type Item = {
  id: string;
  code: string | null;
  group_name: string;
  description: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  total: number;
  confidence: number;
  source: string;
  needs_review: boolean;
  sort_order: number;
};

type EstimateFile = {
  id: string;
  kind: string;
  file_name: string;
  size_bytes: number | null;
  created_at: string | null;
};

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const NUM = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

export default async function OrcamentoIaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const db = untypedDb(supabase);

  const [estimateR, factsR, itemsR, filesR] = await Promise.all([
    db
      .from("ai_estimates")
      .select("id, title, client_name, address, built_area_m2, pool_area_m2, terrain_area_m2, floors_count, has_basement, quality_standard, status, subtotal, total, confidence_score, memorial_text, created_at")
      .eq("id", id)
      .maybeSingle(),
    db
      .from("ai_extracted_facts")
      .select("id, label, value_text, value_numeric, unit, confidence, source, needs_review")
      .eq("estimate_id", id)
      .order("created_at", { ascending: true }),
    db
      .from("ai_estimate_items")
      .select("id, code, group_name, description, quantity, unit, unit_cost, total, confidence, source, needs_review, sort_order")
      .eq("estimate_id", id)
      .order("sort_order", { ascending: true }),
    db
      .from("ai_estimate_files")
      .select("id, kind, file_name, size_bytes, created_at")
      .eq("estimate_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (estimateR.error) throw new Error(estimateR.error.message);
  const estimate = estimateR.data as Estimate | null;
  if (!estimate) notFound();

  const facts = (factsR.data ?? []) as Fact[];
  const items = (itemsR.data ?? []) as Item[];
  const files = (filesR.data ?? []) as EstimateFile[];
  const reviewItems = items.filter((item) => item.needs_review).length;
  const grouped = groupItems(items);

  return (
    <div>
      <div className="page-hero">
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <Link href="/orcamento-ia" style={{ color: "var(--o-text-2)", textDecoration: "none", fontSize: 13 }}>
            ← Orçamento IA
          </Link>
          <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div>
              <h1 style={{ margin: "0 0 8px", font: "700 32px var(--font-inter)", letterSpacing: "-0.025em" }}>
                {estimate.title}
              </h1>
              <p style={{ margin: 0, color: "var(--o-text-2)", fontSize: 14 }}>
                {[estimate.client_name, estimate.address].filter(Boolean).join(" · ") || "Estudo preliminar"}
              </p>
            </div>
            <StatusPill status={estimate.status} />
          </div>
        </div>
      </div>

      <div style={{ padding: "0 24px 40px", maxWidth: 1280, margin: "0 auto" }}>
        <div className="stat-grid ai-budget-metrics-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 18 }}>
          <Metric label="Total preliminar" value={BRL.format(Number(estimate.total ?? 0))} />
          <Metric label="Confiança média" value={`${Math.round(Number(estimate.confidence_score ?? 0) * 100)}%`} />
          <Metric label="Itens gerados" value={String(items.length)} />
          <Metric label="Itens a revisar" value={String(reviewItems)} tone={reviewItems ? "warn" : "ok"} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 360px", gap: 18, alignItems: "start" }} className="ai-budget-detail-grid">
          <div style={{ display: "grid", gap: 18 }}>
            <Section title="Orçamento preliminar">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
                <p style={{ margin: 0, color: "var(--o-text-2)", fontSize: 13 }}>
                  Base parametrizada pelo template Meu Viver. Revise os itens sinalizados antes de enviar proposta.
                </p>
                <ExportButton
                  label="Exportar CSV"
                  filename={`orcamento-ia-${estimate.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                  rows={items.map((item) => ({
                    codigo: item.code ?? "",
                    grupo: item.group_name,
                    descricao: item.description,
                    quantidade: item.quantity,
                    unidade: item.unit,
                    custo_unitario: item.unit_cost,
                    total: item.total,
                    confianca: item.confidence,
                    revisar: item.needs_review ? "sim" : "nao",
                  }))}
                />
              </div>

              <div style={{ display: "grid", gap: 12 }}>
                {grouped.map((group) => (
                  <div key={group.name} style={{ border: "1px solid var(--o-border)", borderRadius: 10, overflow: "hidden" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "12px 14px", background: "var(--o-soft)", borderBottom: "1px solid var(--o-border)" }}>
                      <strong>{group.name}</strong>
                      <span className="tnum" style={{ fontWeight: 700 }}>{BRL.format(group.total)}</span>
                    </div>
                    {group.items.map((item) => (
                      <div key={item.id} className="ai-budget-item-row" style={{ display: "grid", gridTemplateColumns: "72px minmax(0, 1fr) 110px 120px", gap: 12, padding: "11px 14px", borderTop: "1px solid var(--o-mist)", alignItems: "center" }}>
                        <span className="tnum" style={{ color: "var(--o-text-3)", fontSize: 12 }}>{item.code}</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: "var(--o-text-1)", fontWeight: 600 }}>{item.description}</div>
                          <div style={{ color: item.needs_review ? "var(--o-accent)" : "var(--o-text-3)", fontSize: 12, marginTop: 2 }}>
                            {item.needs_review ? "Revisar quantitativo" : "Base parametrica"} · confiança {Math.round(item.confidence * 100)}%
                          </div>
                        </div>
                        <span className="tnum" style={{ color: "var(--o-text-2)", fontSize: 12 }}>
                          {NUM.format(item.quantity)} {item.unit}
                        </span>
                        <strong className="tnum" style={{ textAlign: "right" }}>{BRL.format(item.total)}</strong>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Memorial descritivo preliminar">
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", font: "400 13px/1.7 var(--font-inter)", color: "var(--o-text-1)", background: "var(--o-soft)", borderRadius: 10, padding: 16 }}>
                {estimate.memorial_text ?? "Memorial ainda nao gerado."}
              </pre>
            </Section>
          </div>

          <aside style={{ display: "grid", gap: 18 }}>
            <Section title="Ações">
              <div style={{ display: "grid", gap: 10 }}>
                <form action={reprocessAiEstimate}>
                  <input type="hidden" name="estimate_id" value={estimate.id} />
                  <button className="chip" type="submit" style={{ width: "100%", justifyContent: "center", cursor: "pointer" }}>
                    <RefreshCcw size={14} /> Reprocessar
                  </button>
                </form>
                <form action={approveAiEstimate}>
                  <input type="hidden" name="estimate_id" value={estimate.id} />
                  <button className="btn-brand" type="submit" style={{ width: "100%", justifyContent: "center", display: "inline-flex", gap: 8 }}>
                    <CheckCircle2 size={15} /> Marcar aprovado
                  </button>
                </form>
              </div>
            </Section>

            <Section title="Fatos extraídos">
              <div style={{ display: "grid", gap: 10 }}>
                {facts.map((fact) => (
                  <div key={fact.id} style={{ borderBottom: "1px solid var(--o-mist)", paddingBottom: 9 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <strong style={{ fontSize: 13 }}>{fact.label}</strong>
                      {fact.needs_review && <span style={{ color: "var(--o-accent)", fontSize: 11 }}>revisar</span>}
                    </div>
                    <div style={{ color: "var(--o-text-2)", marginTop: 2 }}>{fact.value_text ?? "Nao informado"}</div>
                    <div style={{ color: "var(--o-text-3)", fontSize: 11, marginTop: 2 }}>
                      {fact.source} · confiança {Math.round(fact.confidence * 100)}%
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Arquivos">
              {files.length === 0 ? (
                <p style={{ margin: 0, color: "var(--o-text-2)", fontSize: 13 }}>Nenhum arquivo anexado.</p>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {files.map((file) => (
                    <div key={file.id} style={{ border: "1px solid var(--o-border)", borderRadius: 8, padding: 10 }}>
                      <div style={{ fontWeight: 600, color: "var(--o-text-1)", overflow: "hidden", textOverflow: "ellipsis" }}>{file.file_name}</div>
                      <div style={{ color: "var(--o-text-2)", fontSize: 12 }}>{kindLabel(file.kind)} · {formatBytes(file.size_bytes)}</div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </aside>
        </div>
      </div>
    </div>
  );
}

function groupItems(items: Item[]): Array<{ name: string; total: number; items: Item[] }> {
  const groups = new Map<string, Item[]>();
  for (const item of items) {
    const list = groups.get(item.group_name) ?? [];
    list.push(item);
    groups.set(item.group_name, list);
  }
  return [...groups.entries()].map(([name, groupItems]) => ({
    name,
    items: groupItems,
    total: groupItems.reduce((sum, item) => sum + Number(item.total ?? 0), 0),
  }));
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card" style={{ padding: 18 }}>
      <h2 style={{ margin: "0 0 12px", font: "700 18px var(--font-inter)", letterSpacing: "-0.01em" }}>{title}</h2>
      {children}
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "warn" | "ok" }) {
  return (
    <div className="stat-card">
      <div style={{ font: "600 11px var(--font-inter)", color: "var(--o-text-2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{label}</div>
      <div className="tnum" style={{ font: "700 24px var(--font-inter)", color: tone === "warn" ? "var(--o-accent)" : tone === "ok" ? "var(--st-done)" : "var(--o-text-1)" }}>{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const meta: Record<string, { label: string; color: string; bg: string }> = {
    draft: { label: "Rascunho", color: "var(--o-text-2)", bg: "var(--o-soft)" },
    processing: { label: "Processando", color: "var(--t-brand)", bg: "var(--t-brand-mist)" },
    review: { label: "Revisar", color: "var(--o-accent)", bg: "var(--o-accent-soft)" },
    approved: { label: "Aprovado", color: "var(--st-done)", bg: "rgba(90,141,140,.12)" },
    failed: { label: "Falhou", color: "var(--st-late)", bg: "rgba(180,61,61,.12)" },
  };
  const current = meta[status] ?? meta.draft;
  return (
    <span style={{ color: current.color, background: current.bg, borderRadius: 999, padding: "7px 12px", font: "600 12px var(--font-inter)" }}>
      {current.label}
    </span>
  );
}

function kindLabel(kind: string): string {
  const labels: Record<string, string> = {
    plan: "Planta",
    proposal: "Memorial/proposta",
    spreadsheet: "Planilha",
    other: "Outro",
  };
  return labels[kind] ?? kind;
}

function formatBytes(value: number | null): string {
  if (!value) return "0 KB";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
