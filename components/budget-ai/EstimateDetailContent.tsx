import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Plus, RefreshCcw, Save, Trash2 } from "lucide-react";
import {
  addEstimateItem,
  approveAiEstimate,
  deleteEstimateItem,
  generateMemorialValidado,
  reprocessAiEstimate,
  saveEstimateMemorial,
  updateEstimateItem,
} from "@/lib/budget-ai/actions";
import { createServerSupabase } from "@/lib/supabase/server";
import { untypedDb } from "@/lib/supabase/untyped";
import { ExportButton } from "@/components/ExportButton";
import { DeleteEstimateButton } from "@/components/budget-ai/DeleteEstimateButton";
import { MemorialViewer } from "@/components/budget-ai/MemorialViewer";

type Estimate = {
  id: string;
  site_id: string | null;
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
  source_summary: unknown | null;
  created_at: string | null;
  sites: { name: string } | null;
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

type MemorialValidadoMeta = {
  generated_at?: string;
  model?: string | null;
  item_count?: number;
  base?: string;
};

type PlanAnalysisSummary = {
  status?: string;
  model?: string | null;
  summary?: string;
  confidence?: number;
  risks?: string[];
  measurements?: Record<string, number>;
};

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const NUM = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

export async function EstimateDetailContent({
  estimateId,
  expectedSiteId,
  backHrefOverride,
  backLabelOverride,
}: {
  estimateId: string;
  expectedSiteId?: string;
  backHrefOverride?: string;
  backLabelOverride?: string;
}) {
  const id = estimateId;
  const supabase = await createServerSupabase();
  const db = untypedDb(supabase);

  const [estimateR, factsR, itemsR, filesR] = await Promise.all([
    db
      .from("ai_estimates")
      .select("id, site_id, title, client_name, address, built_area_m2, pool_area_m2, terrain_area_m2, floors_count, has_basement, quality_standard, status, subtotal, total, confidence_score, memorial_text, source_summary, created_at, sites(name)")
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
  if (expectedSiteId && estimate.site_id !== expectedSiteId) notFound();

  const facts = (factsR.data ?? []) as Fact[];
  const items = (itemsR.data ?? []) as Item[];
  const files = (filesR.data ?? []) as EstimateFile[];
  const reviewItems = items.filter((item) => item.needs_review).length;
  const grouped = groupItems(items);
  const planAnalysis = extractPlanAnalysis(estimate.source_summary);
  const memorialValidado = extractMemorialValidado(estimate.source_summary);
  const generateMemorialAction = generateMemorialValidado.bind(null, estimate.id);
  const backHref = backHrefOverride ?? (estimate.site_id ? `/obras/${estimate.site_id}/orcamento-ia` : "/orcamento-ia");
  const backLabel = backLabelOverride ?? (estimate.site_id ? `← Orçamento IA · ${estimate.sites?.name ?? "Obra"}` : "← Orçamento IA");

  return (
    <div>
      <div className="page-hero">
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <Link href={backHref} style={{ color: "var(--o-text-2)", textDecoration: "none", fontSize: 13 }}>
            {backLabel}
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
          <Metric label={estimate.status === "approved" ? "Validação técnica" : "Confiança técnica"} value={`${Math.round(Number(estimate.confidence_score ?? 0) * 100)}%`} tone={estimate.status === "approved" ? "ok" : undefined} />
          <Metric label="Itens gerados" value={String(items.length)} />
          <Metric label="Itens com premissa" value={String(reviewItems)} tone={reviewItems ? "warn" : "ok"} />
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

              <details style={{ border: "1px solid var(--o-border)", borderRadius: 10, marginBottom: 14, background: "var(--o-soft)", overflow: "hidden" }}>
                <summary style={{ cursor: "pointer", padding: "12px 14px", fontWeight: 700, color: "var(--t-brand)", display: "flex", alignItems: "center", gap: 8 }}>
                  <Plus size={15} /> Adicionar item no orçamento
                </summary>
                <form action={addEstimateItem} style={{ display: "grid", gap: 10, padding: 14, borderTop: "1px solid var(--o-border)" }}>
                  <input type="hidden" name="estimate_id" value={estimate.id} />
                  <div className="ai-budget-editor-grid" style={{ display: "grid", gridTemplateColumns: "90px minmax(150px, 1fr) minmax(220px, 2fr)", gap: 10 }}>
                    <EditorField label="Código">
                      <input name="code" style={editorInputStyle} placeholder="Ex.: 41.1" />
                    </EditorField>
                    <EditorField label="Grupo">
                      <input name="group_name" style={editorInputStyle} placeholder="Itens complementares" />
                    </EditorField>
                    <EditorField label="Descrição">
                      <input name="description" style={editorInputStyle} placeholder="Descrição do novo item" />
                    </EditorField>
                  </div>
                  <div className="ai-budget-editor-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                    <EditorField label="Quantidade">
                      <input name="quantity" inputMode="decimal" defaultValue="1" style={editorInputStyle} />
                    </EditorField>
                    <EditorField label="Unidade">
                      <input name="unit" defaultValue="VB" style={editorInputStyle} />
                    </EditorField>
                    <EditorField label="Custo unitário">
                      <input name="unit_cost" inputMode="decimal" defaultValue="0" style={editorInputStyle} />
                    </EditorField>
                  </div>
                  <button className="btn-brand" type="submit" style={{ justifySelf: "start", display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <Plus size={15} /> Adicionar item
                  </button>
                </form>
              </details>

              <div style={{ display: "grid", gap: 12 }}>
                {grouped.map((group) => (
                  <div key={group.name} style={{ border: "1px solid var(--o-border)", borderRadius: 10, overflow: "hidden" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "12px 14px", background: "var(--o-soft)", borderBottom: "1px solid var(--o-border)" }}>
                      <strong>{group.name}</strong>
                      <span className="tnum" style={{ fontWeight: 700 }}>{BRL.format(group.total)}</span>
                    </div>
                    {group.items.map((item) => (
                      <EditableItemRow key={item.id} estimateId={estimate.id} item={item} />
                    ))}
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Memorial descritivo">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 14 }}>
                <div style={{ flex: "1 1 280px", minWidth: 0 }}>
                  {memorialValidado ? (
                    <>
                      <p style={{ margin: 0, color: "var(--st-done)", fontSize: 13, fontWeight: 600 }}>
                        Memorial do orçamento validado gerado em {formatGeneratedAt(memorialValidado.generated_at)}.
                      </p>
                      <p style={{ margin: "4px 0 0", color: "var(--o-text-2)", fontSize: 12 }}>
                        Se alterar itens do orçamento, regere o memorial para manter escopo e quantidades alinhados.
                      </p>
                    </>
                  ) : (
                    <p style={{ margin: 0, color: "var(--o-text-2)", fontSize: 13 }}>
                      O memorial definitivo é redigido a partir dos itens do orçamento validado.
                      <strong style={{ color: "var(--o-accent)" }}> Revise e ajuste os itens antes de gerar.</strong>
                    </p>
                  )}
                </div>
                <form action={generateMemorialAction}>
                  {memorialValidado ? (
                    <button className="chip" type="submit" style={{ cursor: "pointer" }}>
                      ↻ Regerar memorial do orçamento validado
                    </button>
                  ) : (
                    <button className="btn-brand" type="submit" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      📄 Gerar memorial do orçamento validado
                    </button>
                  )}
                </form>
              </div>

              {estimate.memorial_text ? (
                <div style={{ display: "grid", gap: 10 }}>
                  {!memorialValidado && (
                    <span style={{ justifySelf: "start", color: "var(--o-accent)", background: "var(--o-accent-soft)", borderRadius: 999, padding: "6px 10px", font: "700 11px var(--font-inter)" }}>
                      Rascunho automático da planta — será substituído pelo memorial do orçamento validado
                    </span>
                  )}
                  <MemorialViewer memorial={estimate.memorial_text} title={estimate.title} />
                </div>
              ) : (
                <p style={{ margin: 0, color: "var(--o-text-2)", fontSize: 13 }}>
                  Nenhum memorial gerado ainda. Valide os itens do orçamento e use o botão acima, ou escreva abaixo.
                </p>
              )}
              <details style={{ marginTop: 14 }}>
                <summary style={{ cursor: "pointer", color: "var(--t-brand)", fontSize: 13, fontWeight: 700 }}>
                  Editar memorial
                </summary>
                <form action={saveEstimateMemorial} style={{ display: "grid", gap: 12, marginTop: 12 }}>
                  <input type="hidden" name="estimate_id" value={estimate.id} />
                  <textarea
                    name="memorial_text"
                    defaultValue={estimate.memorial_text ?? ""}
                    rows={24}
                    style={editorTextareaStyle}
                    placeholder="Memorial descritivo do orçamento..."
                  />
                  <button className="btn-brand" type="submit" style={{ justifySelf: "start", display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <Save size={15} /> Salvar memorial
                  </button>
                </form>
              </details>
            </Section>
          </div>

          <aside style={{ display: "grid", gap: 18 }}>
            <Section title="Leitura da planta">
              <PlanAnalysisPanel analysis={planAnalysis} />
            </Section>

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
                <DeleteEstimateButton
                  estimateId={estimate.id}
                  redirectTo={backHref}
                  label="Apagar orçamento"
                />
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

function EditableItemRow({ estimateId, item }: { estimateId: string; item: Item }) {
  return (
    <div style={{ borderTop: "1px solid var(--o-mist)" }}>
      <div className="ai-budget-item-row" style={{ display: "grid", gridTemplateColumns: "72px minmax(0, 1fr) 110px 120px", gap: 12, padding: "11px 14px", alignItems: "center" }}>
        <span className="tnum" style={{ color: "var(--o-text-3)", fontSize: 12 }}>{item.code}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: "var(--o-text-1)", fontWeight: 600 }}>{item.description}</div>
          <div style={{ color: item.needs_review ? "var(--o-accent)" : "var(--o-text-3)", fontSize: 12, marginTop: 2 }}>
            {sourceLabel(item.source)} · {itemReviewLabel(item)} · confiança {Math.round(item.confidence * 100)}%
          </div>
        </div>
        <span className="tnum" style={{ color: "var(--o-text-2)", fontSize: 12 }}>
          {NUM.format(item.quantity)} {item.unit}
        </span>
        <strong className="tnum" style={{ textAlign: "right" }}>{BRL.format(item.total)}</strong>
      </div>

      <details style={{ padding: "0 14px 12px" }}>
        <summary style={{ cursor: "pointer", color: "var(--t-brand)", fontSize: 12, fontWeight: 700, padding: "0 0 8px 72px" }}>
          Editar item
        </summary>
        <div style={{ background: "var(--o-soft)", border: "1px solid var(--o-border)", borderRadius: 10, padding: 12 }}>
          <form action={updateEstimateItem} style={{ display: "grid", gap: 10 }}>
            <input type="hidden" name="estimate_id" value={estimateId} />
            <input type="hidden" name="item_id" value={item.id} />
            <div className="ai-budget-editor-grid" style={{ display: "grid", gridTemplateColumns: "90px minmax(150px, 1fr) minmax(220px, 2fr)", gap: 10 }}>
              <EditorField label="Código">
                <input name="code" defaultValue={item.code ?? ""} style={editorInputStyle} />
              </EditorField>
              <EditorField label="Grupo">
                <input name="group_name" defaultValue={item.group_name} style={editorInputStyle} />
              </EditorField>
              <EditorField label="Descrição">
                <input name="description" defaultValue={item.description} style={editorInputStyle} />
              </EditorField>
            </div>
            <div className="ai-budget-editor-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <EditorField label="Quantidade">
                <input name="quantity" inputMode="decimal" defaultValue={String(item.quantity)} style={editorInputStyle} />
              </EditorField>
              <EditorField label="Unidade">
                <input name="unit" defaultValue={item.unit} style={editorInputStyle} />
              </EditorField>
              <EditorField label="Custo unitário">
                <input name="unit_cost" inputMode="decimal" defaultValue={String(item.unit_cost)} style={editorInputStyle} />
              </EditorField>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--o-text-2)", fontSize: 12, fontWeight: 700 }}>
              <input name="needs_review" type="checkbox" defaultChecked={item.needs_review} />
              Manter item como pendente de revisão
            </label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btn-brand" type="submit" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <Save size={15} /> Salvar item
              </button>
              <button
                className="chip"
                type="submit"
                formAction={deleteEstimateItem}
                formNoValidate
                style={{ color: "var(--st-late)", cursor: "pointer" }}
              >
                <Trash2 size={14} /> Apagar item
              </button>
            </div>
          </form>
        </div>
      </details>
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

function EditorField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 5 }}>
      <span style={{ color: "var(--o-text-2)", font: "700 10px var(--font-inter)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      {children}
    </label>
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

function PlanAnalysisPanel({ analysis }: { analysis: PlanAnalysisSummary | null }) {
  if (!analysis) {
    return (
      <p style={{ margin: 0, color: "var(--o-text-2)", fontSize: 13 }}>
        Sem metadados de leitura visual neste estudo. Reprocesse após anexar uma planta.
      </p>
    );
  }

  const status = analysis.status ?? "unknown";
  const isAnalyzed = status === "analyzed";
  const risks = Array.isArray(analysis.risks) ? analysis.risks.slice(0, 5) : [];
  const measurementCount = analysis.measurements ? Object.keys(analysis.measurements).length : 0;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <span style={{
          color: isAnalyzed ? "var(--st-done)" : "var(--o-accent)",
          background: isAnalyzed ? "rgba(90,141,140,.12)" : "var(--o-accent-soft)",
          borderRadius: 999,
          padding: "6px 10px",
          font: "700 11px var(--font-inter)",
        }}>
          {planStatusLabel(status)}
        </span>
        <span className="tnum" style={{ color: "var(--o-text-2)", fontSize: 12 }}>
          {Math.round(Number(analysis.confidence ?? 0) * 100)}%
        </span>
      </div>
      <p style={{ margin: 0, color: "var(--o-text-1)", fontSize: 13, lineHeight: 1.55 }}>
        {analysis.summary ?? "Resumo da leitura indisponivel."}
      </p>
      <div style={{ color: "var(--o-text-3)", fontSize: 12 }}>
        {analysis.model ? `Modelo: ${analysis.model}` : "Modelo: nao executado"} · medições: {measurementCount}
      </div>
      {risks.length > 0 && (
        <div style={{ display: "grid", gap: 6 }}>
          {risks.map((risk, index) => (
            <div key={`${risk}-${index}`} style={{ color: "var(--o-text-2)", fontSize: 12, borderTop: "1px solid var(--o-mist)", paddingTop: 6 }}>
              {risk}
            </div>
          ))}
        </div>
      )}
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

function extractPlanAnalysis(value: unknown): PlanAnalysisSummary | null {
  if (!value || typeof value !== "object") return null;
  const planAnalysis = (value as { plan_analysis?: unknown }).plan_analysis;
  if (!planAnalysis || typeof planAnalysis !== "object") return null;
  return planAnalysis as PlanAnalysisSummary;
}

function extractMemorialValidado(value: unknown): MemorialValidadoMeta | null {
  if (!value || typeof value !== "object") return null;
  const meta = (value as { memorial_validado?: unknown }).memorial_validado;
  if (!meta || typeof meta !== "object") return null;
  return meta as MemorialValidadoMeta;
}

const DATE_TIME = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

function formatGeneratedAt(iso: string | undefined): string {
  if (!iso) return "data não registrada";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "data não registrada" : DATE_TIME.format(date);
}

function planStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    analyzed: "IA visual ativa",
    missing_key: "Chave IA ausente",
    no_plan_file: "Sem planta",
    failed: "Leitura falhou",
  };
  return labels[status] ?? status;
}

function sourceLabel(source: string): string {
  const labels: Record<string, string> = {
    usuario: "Campo manual",
    parametros_usuario: "Campo manual",
    planta_ia: "Leitura da planta",
    planta_ia_parametrica: "Derivado da planta",
    template_parametrico: "Template parametrico",
  };
  return labels[source] ?? source;
}

function itemReviewLabel(item: Item): string {
  if (!item.needs_review) return "base validada";
  if (item.source === "planta_ia" && Number(item.unit_cost ?? 0) === 0) {
    return "definir preço";
  }
  if (item.source === "template_parametrico" && item.unit.toUpperCase() === "VB") {
    return "verba de referencia";
  }
  if (item.source === "template_parametrico") return "premissa do template";
  return "revisar quantitativo";
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

const editorInputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--o-border)",
  borderRadius: 8,
  background: "white",
  color: "var(--o-text-1)",
  padding: "9px 10px",
  font: "400 13px var(--font-inter)",
  outline: "none",
};

const editorTextareaStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 420,
  border: "1px solid var(--o-border)",
  borderRadius: 10,
  background: "white",
  color: "var(--o-text-1)",
  padding: 14,
  font: "400 13px/1.65 var(--font-inter)",
  outline: "none",
  resize: "vertical",
};
