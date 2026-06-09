import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentRole, canWrite, canManageUsers } from "@/lib/permissions";
import { VISIBLE_SOURCE_PROVIDERS } from "@/lib/rdo-source-scope";
import {
  addMedicaoItem,
  deleteMedicao,
  deleteMedicaoItem,
  setMedicaoStatus,
  updateMedicaoItem,
} from "@/lib/medicao-actions";
import { MedicaoPrintButton } from "@/components/MedicaoPrintButton";

type Site = { id: string; name: string; client_name: string | null };

type Medicao = {
  id: string;
  number: number;
  period_start: string;
  period_end: string;
  status: string;
  notes: string | null;
  total_value: number | null;
  created_at: string | null;
  approved_at: string | null;
};

type MedicaoItem = {
  id: string;
  description: string;
  unit: string | null;
  contracted_qty: number | null;
  previous_qty: number | null;
  period_qty: number | null;
  unit_price: number | null;
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft: { label: "Rascunho", cls: "status-paused" },
  submitted: { label: "Enviada p/ aprovação", cls: "status-progress" },
  approved: { label: "Aprovada", cls: "status-done" },
};

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const qty = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

function fmtDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

const GRID = "minmax(180px, 1fr) 64px 92px 92px 92px 104px 112px 72px";

export default async function MedicaoDetailPage({
  params,
}: {
  params: Promise<{ id: string; medicaoId: string }>;
}) {
  const { id, medicaoId } = await params;
  const supabase = await createServerSupabase();

  const { data: siteRaw } = await supabase
    .from("sites")
    .select("id, name, client_name")
    .eq("id", id)
    .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
    .maybeSingle();
  const site = siteRaw as Site | null;
  if (!site) notFound();

  const { data: medicaoRaw } = await supabase
    .from("medicoes")
    .select("id, number, period_start, period_end, status, notes, total_value, created_at, approved_at")
    .eq("id", medicaoId)
    .eq("site_id", id)
    .maybeSingle();
  const medicao = medicaoRaw as Medicao | null;
  if (!medicao) notFound();

  const { data: itemsRaw } = await supabase
    .from("medicao_items")
    .select("id, description, unit, contracted_qty, previous_qty, period_qty, unit_price")
    .eq("medicao_id", medicaoId)
    .order("description", { ascending: true });
  const items = (itemsRaw ?? []) as MedicaoItem[];

  const role = await getCurrentRole();
  const canEdit = canWrite(role);
  const isAdmin = canManageUsers(role);
  const editable = canEdit && medicao.status !== "approved";

  const meta = STATUS_META[medicao.status] ?? STATUS_META.draft;
  const total = medicao.total_value ?? 0;
  const subtotalOf = (item: MedicaoItem): number | null =>
    item.unit_price != null && item.period_qty != null ? item.period_qty * item.unit_price : null;

  return (
    <div>
      <div className="page-hero">
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div className="no-print" style={{ marginBottom: 12, fontSize: 13 }}>
            <Link href="/obras" style={{ color: "var(--o-text-2)", textDecoration: "none" }}>← Obras</Link>
            <span style={{ color: "var(--o-text-3)", margin: "0 8px" }}>/</span>
            <Link href={`/obras/${id}`} style={{ color: "var(--o-text-2)", textDecoration: "none" }}>{site.name}</Link>
            <span style={{ color: "var(--o-text-3)", margin: "0 8px" }}>/</span>
            <Link href={`/obras/${id}/medicoes`} style={{ color: "var(--o-text-2)", textDecoration: "none" }}>Medições</Link>
            <span style={{ color: "var(--o-text-3)", margin: "0 8px" }}>/</span>
            <span style={{ color: "var(--o-text-1)", fontWeight: 500 }} className="tnum">#{medicao.number}</span>
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--t-brand)", fontWeight: 600, marginBottom: 8 }}>
                Boletim de medição
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
                <h1 className="tnum" style={{ margin: 0, font: "700 36px var(--font-inter)", letterSpacing: "-0.025em", color: "var(--t-brand)" }}>
                  Medição #{medicao.number}
                </h1>
                <span className={`status ${meta.cls}`}>{meta.label}</span>
              </div>
              <div className="tnum" style={{ fontSize: 14, color: "var(--o-text-2)" }}>
                Período: {fmtDate(medicao.period_start)} – {fmtDate(medicao.period_end)}
              </div>
              <div style={{ fontSize: 15, marginTop: 6 }}>
                <span style={{ color: "var(--o-text-2)" }}>Total medido: </span>
                <strong className="tnum" style={{ color: "var(--t-brand)", fontSize: 18 }}>{brl.format(total)}</strong>
              </div>
              {medicao.approved_at && (
                <div style={{ fontSize: 12, color: "var(--o-text-3)", marginTop: 4 }}>
                  Aprovada em {new Date(medicao.approved_at).toLocaleString("pt-BR")}
                </div>
              )}
            </div>

            {/* Ações */}
            <div className="action-bar no-print" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <MedicaoPrintButton />
              {canEdit && medicao.status === "draft" && (
                <form action={setMedicaoStatus} style={{ display: "inline" }}>
                  <input type="hidden" name="medicaoId" value={medicaoId} />
                  <input type="hidden" name="siteId" value={id} />
                  <input type="hidden" name="status" value="submitted" />
                  <button type="submit" className="chip" style={{ background: "var(--t-brand-soft)", color: "var(--t-brand)", border: "1px solid var(--t-brand)", cursor: "pointer" }}>
                    📤 Enviar p/ aprovação
                  </button>
                </form>
              )}
              {isAdmin && medicao.status === "submitted" && (
                <form action={setMedicaoStatus} style={{ display: "inline" }}>
                  <input type="hidden" name="medicaoId" value={medicaoId} />
                  <input type="hidden" name="siteId" value={id} />
                  <input type="hidden" name="status" value="approved" />
                  <button type="submit" className="chip" style={{ background: "var(--st-done-soft, #dcf5e8)", color: "var(--st-done, #137a4d)", border: "1px solid var(--st-done, #137a4d)", cursor: "pointer" }}>
                    ✓ Aprovar
                  </button>
                </form>
              )}
              {isAdmin && medicao.status === "approved" && (
                <form action={setMedicaoStatus} style={{ display: "inline" }}>
                  <input type="hidden" name="medicaoId" value={medicaoId} />
                  <input type="hidden" name="siteId" value={id} />
                  <input type="hidden" name="status" value="draft" />
                  <button type="submit" className="chip" style={{ cursor: "pointer" }}>
                    ↺ Reabrir
                  </button>
                </form>
              )}
              {canEdit && medicao.status === "draft" && (
                <form action={deleteMedicao} style={{ display: "inline" }}>
                  <input type="hidden" name="medicaoId" value={medicaoId} />
                  <input type="hidden" name="siteId" value={id} />
                  <button type="submit" className="chip" style={{ color: "#b3261e", borderColor: "#f5c6c2", cursor: "pointer" }}>
                    Excluir
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>

      <div id="medicao-print" style={{ padding: "0 24px 32px", maxWidth: 1280, margin: "0 auto" }}>
        {/* Cabeçalho da versão impressa */}
        <div className="medicao-print-only" style={{ marginBottom: 16 }}>
          <h1 className="tnum" style={{ margin: "0 0 4px", font: "700 22px var(--font-inter)" }}>
            Boletim de Medição #{medicao.number} — {site.name}
          </h1>
          <div className="tnum" style={{ fontSize: 13 }}>
            {site.client_name ? `Cliente: ${site.client_name} · ` : ""}
            Período: {fmtDate(medicao.period_start)} a {fmtDate(medicao.period_end)} · Status: {meta.label} · Total: {brl.format(total)}
          </div>
        </div>

        {medicao.notes && (
          <div className="card" style={{ padding: "16px 20px", marginBottom: 20 }}>
            <h3 className="section-title" style={{ marginBottom: 8 }}>📝 Observações</h3>
            <div style={{ fontSize: 14, color: "var(--o-text-1)", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{medicao.notes}</div>
          </div>
        )}

        {/* Tabela só-leitura para impressão */}
        <div className="medicao-print-only">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                {["Descrição", "Unid", "Qtd contratada", "Acum. anterior", "Qtd período", "Preço unit.", "Subtotal"].map((h) => (
                  <th key={h} style={{ border: "1px solid #ccc", padding: "6px 8px", textAlign: "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const sub = subtotalOf(item);
                return (
                  <tr key={item.id}>
                    <td style={printCell}>{item.description}</td>
                    <td style={printCell}>{item.unit ?? "—"}</td>
                    <td style={printCell} className="tnum">{item.contracted_qty != null ? qty.format(item.contracted_qty) : "—"}</td>
                    <td style={printCell} className="tnum">{item.previous_qty != null ? qty.format(item.previous_qty) : "—"}</td>
                    <td style={printCell} className="tnum">{item.period_qty != null ? qty.format(item.period_qty) : "—"}</td>
                    <td style={printCell} className="tnum">{item.unit_price != null ? brl.format(item.unit_price) : "—"}</td>
                    <td style={printCell} className="tnum">{sub != null ? brl.format(sub) : "—"}</td>
                  </tr>
                );
              })}
              <tr>
                <td colSpan={6} style={{ ...printCell, fontWeight: 700, textAlign: "right" }}>Total</td>
                <td style={{ ...printCell, fontWeight: 700 }} className="tnum">{brl.format(total)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Tabela editável (tela) */}
        <div className="no-print" style={{ marginBottom: 28 }}>
          <h3 className="section-title">Itens medidos · {items.length}</h3>

          <div className="card" style={{ padding: 0, overflowX: "auto" }}>
            <div style={{ minWidth: 920 }}>
              {/* Cabeçalho das colunas */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: GRID,
                  gap: 8,
                  alignItems: "center",
                  padding: "10px 18px",
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--o-text-3)",
                  borderBottom: "1px solid var(--o-border)",
                }}
              >
                <span>Descrição</span>
                <span>Unid</span>
                <span style={{ textAlign: "right" }}>Contratada</span>
                <span style={{ textAlign: "right" }}>Acum. ant.</span>
                <span style={{ textAlign: "right" }}>Período</span>
                <span style={{ textAlign: "right" }}>Preço unit.</span>
                <span style={{ textAlign: "right" }}>Subtotal</span>
                <span />
              </div>

              {items.length === 0 && (
                <div style={{ padding: "18px", fontSize: 13, color: "var(--o-text-3)" }}>
                  Nenhum item — não havia atividades em RDOs aprovados no período. Adicione itens manualmente abaixo.
                </div>
              )}

              {items.map((item, i) => {
                const sub = subtotalOf(item);
                if (!editable) {
                  return (
                    <div
                      key={item.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: GRID,
                        gap: 8,
                        alignItems: "center",
                        padding: "10px 18px",
                        fontSize: 13,
                        borderTop: i === 0 ? "none" : "1px solid var(--o-border)",
                        color: "var(--o-text-1)",
                      }}
                    >
                      <span style={{ fontWeight: 500 }}>{item.description}</span>
                      <span>{item.unit ?? "—"}</span>
                      <span className="tnum" style={{ textAlign: "right" }}>{item.contracted_qty != null ? qty.format(item.contracted_qty) : "—"}</span>
                      <span className="tnum" style={{ textAlign: "right" }}>{item.previous_qty != null ? qty.format(item.previous_qty) : "—"}</span>
                      <span className="tnum" style={{ textAlign: "right" }}>{item.period_qty != null ? qty.format(item.period_qty) : "—"}</span>
                      <span className="tnum" style={{ textAlign: "right" }}>{item.unit_price != null ? brl.format(item.unit_price) : "—"}</span>
                      <span className="tnum" style={{ textAlign: "right", fontWeight: 600 }}>{sub != null ? brl.format(sub) : "—"}</span>
                      <span />
                    </div>
                  );
                }
                return (
                  <form
                    key={item.id}
                    action={updateMedicaoItem}
                    style={{
                      display: "grid",
                      gridTemplateColumns: GRID,
                      gap: 8,
                      alignItems: "center",
                      padding: "8px 18px",
                      borderTop: i === 0 ? "none" : "1px solid var(--o-border)",
                    }}
                  >
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="medicaoId" value={medicaoId} />
                    <input type="hidden" name="siteId" value={id} />
                    <input name="description" defaultValue={item.description} required style={cellInput} />
                    <input name="unit" defaultValue={item.unit ?? ""} placeholder="un" style={cellInput} />
                    <input name="contracted_qty" type="number" step="0.01" defaultValue={item.contracted_qty ?? ""} style={cellInputNum} className="tnum" />
                    <input name="previous_qty" type="number" step="0.01" defaultValue={item.previous_qty ?? ""} style={cellInputNum} className="tnum" />
                    <input name="period_qty" type="number" step="0.01" defaultValue={item.period_qty ?? ""} style={cellInputNum} className="tnum" />
                    <input name="unit_price" type="number" step="0.01" defaultValue={item.unit_price ?? ""} placeholder="R$" style={cellInputNum} className="tnum" />
                    <span className="tnum" style={{ textAlign: "right", fontSize: 13, fontWeight: 600, color: sub != null ? "var(--t-brand)" : "var(--o-text-3)" }}>
                      {sub != null ? brl.format(sub) : "—"}
                    </span>
                    <span style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                      <button type="submit" title="Salvar linha" style={iconButton}>💾</button>
                      <button type="submit" formAction={deleteMedicaoItem} title="Remover item" style={{ ...iconButton, color: "#b3261e" }}>×</button>
                    </span>
                  </form>
                );
              })}

              {/* Total */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: GRID,
                  gap: 8,
                  alignItems: "center",
                  padding: "12px 18px",
                  borderTop: "2px solid var(--o-border)",
                  fontSize: 14,
                }}
              >
                <span style={{ fontWeight: 600, color: "var(--o-text-2)", gridColumn: "1 / 7", textAlign: "right" }}>
                  Total da medição (itens com preço)
                </span>
                <span className="tnum" style={{ textAlign: "right", fontWeight: 700, color: "var(--t-brand)" }}>
                  {brl.format(total)}
                </span>
                <span />
              </div>
            </div>
          </div>

          {/* Adicionar item manual */}
          {editable && (
            <form action={addMedicaoItem} className="card" style={{ padding: "14px 18px", marginTop: 12 }}>
              <input type="hidden" name="medicaoId" value={medicaoId} />
              <input type="hidden" name="siteId" value={id} />
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--o-text-2)", marginBottom: 8 }}>
                Adicionar item manual
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(160px, 1fr) 64px 92px 92px 92px 104px auto", gap: 8, alignItems: "center" }}>
                <input name="description" required placeholder="Descrição do serviço" style={cellInput} />
                <input name="unit" placeholder="un" style={cellInput} />
                <input name="contracted_qty" type="number" step="0.01" placeholder="Contrat." style={cellInputNum} className="tnum" />
                <input name="previous_qty" type="number" step="0.01" placeholder="Acum." style={cellInputNum} className="tnum" />
                <input name="period_qty" type="number" step="0.01" placeholder="Período" style={cellInputNum} className="tnum" />
                <input name="unit_price" type="number" step="0.01" placeholder="Preço R$" style={cellInputNum} className="tnum" />
                <button type="submit" className="btn-brand" style={{ padding: "8px 14px", fontSize: 12, whiteSpace: "nowrap" }}>
                  + Adicionar
                </button>
              </div>
            </form>
          )}

          {!editable && medicao.status === "approved" && (
            <p style={{ fontSize: 12, color: "var(--o-text-3)", marginTop: 10 }}>
              Medição aprovada — itens bloqueados para edição. Reabra a medição para alterar.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

const printCell: React.CSSProperties = {
  border: "1px solid #ccc",
  padding: "5px 8px",
};

const cellInput: React.CSSProperties = {
  width: "100%",
  background: "var(--o-paper)",
  border: "1px solid var(--o-border)",
  borderRadius: 7,
  padding: "7px 9px",
  font: "400 13px var(--font-inter)",
  color: "var(--o-text-1)",
  outline: "none",
};

const cellInputNum: React.CSSProperties = {
  ...cellInput,
  textAlign: "right",
};

const iconButton: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 6,
  border: "1px solid var(--o-border)",
  background: "transparent",
  color: "var(--o-text-2)",
  fontSize: 13,
  cursor: "pointer",
  lineHeight: 1,
  display: "grid",
  placeItems: "center",
};
