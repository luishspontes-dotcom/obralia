import Link from "next/link";
import { ArrowLeft, RefreshCw, Save } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { untypedDb } from "@/lib/supabase/untyped";
import { saveRates, recalibrateRates, addRealCostObservation } from "./actions";

type Rate = {
  id: string;
  etapa_numero: number | null;
  etapa_nome: string;
  unit: string;
  base: string;
  cost_per_m2: number;
  source: string;
  sample_count: number;
  updated_at: string | null;
};

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

const SOURCE_LABEL: Record<string, string> = {
  planilha_joaquim: "Planilha (seed)",
  manual: "Editado à mão",
  recalibrado: "Recalibrado (histórico)",
  custo_real_obra: "Custo real de obra",
};

function sourceBadge(source: string) {
  const label = SOURCE_LABEL[source] ?? source;
  const color =
    source === "recalibrado" || source === "custo_real_obra"
      ? "var(--st-done, #5a8d8c)"
      : source === "manual"
        ? "var(--t-brand)"
        : "var(--o-text-2)";
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color }}>{label}</span>
  );
}

export default async function TaxasOrcamentoPage() {
  const supabase = await createServerSupabase();
  const db = untypedDb(supabase);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profileRaw } = await db
    .from("profiles")
    .select("default_org_id")
    .eq("id", user?.id)
    .maybeSingle();
  const profile = profileRaw as { default_org_id: string | null } | null;
  const { data: orgsRaw } = await db.from("organizations").select("id, name");
  const orgs = (orgsRaw ?? []) as Array<{ id: string; name: string }>;
  const activeOrg = orgs.find((o) => o.id === profile?.default_org_id) ?? orgs[0] ?? null;

  const { data: ratesRaw } = activeOrg
    ? await db
        .from("budget_rates")
        .select("id, etapa_numero, etapa_nome, unit, base, cost_per_m2, source, sample_count, updated_at")
        .eq("organization_id", activeOrg.id)
        .order("etapa_numero", { ascending: true })
    : { data: [] };
  const rates = (ratesRaw ?? []) as Rate[];

  const somaM2 = rates
    .filter((r) => r.base === "built_area_m2")
    .reduce((s, r) => s + Number(r.cost_per_m2 ?? 0), 0);

  return (
    <div style={{ padding: "0 24px 40px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ margin: "16px 0 6px" }}>
        <Link href="/orcamento-ia" style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13, color: "var(--o-text-2)", textDecoration: "none" }}>
          <ArrowLeft size={14} /> Orçamento IA
        </Link>
      </div>
      <h1 style={{ font: "700 26px var(--font-inter)", margin: "0 0 6px", letterSpacing: "-0.02em" }}>
        Taxas do Orçamento IA (R$/m²)
      </h1>
      <p style={{ margin: "0 0 18px", fontSize: 14, color: "var(--o-text-2)", maxWidth: 760 }}>
        Estas são as taxas por etapa que alimentam o Orçamento IA: o custo de cada etapa =
        taxa (R$/m²) × área. Mantê-las atualizadas é o que garante que os orçamentos continuem
        certos com o tempo. Base atual (etapas por área construída):{" "}
        <strong>{BRL.format(somaM2)}/m²</strong>.
      </p>

      {/* Recalibração pelo histórico vivo (orçamentos aprovados) */}
      <div className="card" style={{ padding: "16px 18px", marginBottom: 16, display: "flex", gap: 14, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, color: "var(--o-text-2)", maxWidth: 620 }}>
          <strong style={{ color: "var(--o-text-1)" }}>Recalibrar pelo histórico.</strong>{" "}
          Recalcula as taxas a partir dos orçamentos IA já <em>aprovados</em> (mediana R$/m² por
          etapa). Só mexe nas etapas que têm base histórica real — nada é inventado.
        </div>
        <form action={recalibrateRates}>
          <button type="submit" className="btn-brand" style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
            <RefreshCw size={15} /> Recalibrar
          </button>
        </form>
      </div>

      {/* Edição manual das taxas */}
      <form action={saveRates}>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="do-table-wrap">
            <table className="do-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Etapa</th>
                  <th style={{ width: 90 }}>Base</th>
                  <th style={{ width: 150 }}>Taxa (R$/m²)</th>
                  <th style={{ width: 150 }}>Origem</th>
                  <th style={{ width: 70 }}>Amostras</th>
                </tr>
              </thead>
              <tbody>
                {rates.map((r) => (
                  <tr key={r.id}>
                    <td className="tnum" style={{ color: "var(--o-text-2)" }}>{r.etapa_numero ?? "—"}</td>
                    <td style={{ fontWeight: 600 }}>{r.etapa_nome}</td>
                    <td style={{ fontSize: 12, color: "var(--o-text-2)" }}>
                      {r.base === "pool_area_m2" ? "Piscina" : "Casa"}
                    </td>
                    <td>
                      <input type="hidden" name={`orig_${r.id}`} value={String(r.cost_per_m2)} />
                      <input
                        name={`rate_${r.id}`}
                        defaultValue={String(r.cost_per_m2)}
                        inputMode="decimal"
                        className="diario-input"
                        style={{ width: 130, height: 32, textAlign: "right" }}
                      />
                    </td>
                    <td>{sourceBadge(r.source)}</td>
                    <td className="tnum" style={{ color: "var(--o-text-2)" }}>{r.sample_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
          <button type="submit" className="btn-brand" style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
            <Save size={15} /> Salvar taxas
          </button>
        </div>
      </form>

      {/* Lançar custo real de obra concluída (mecanismo da Planilha1, assistido) */}
      <div className="card" style={{ padding: "18px 20px", marginTop: 22 }}>
        <h2 style={{ font: "700 16px var(--font-inter)", margin: "0 0 6px" }}>
          Lançar custo real de obra concluída
        </h2>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--o-text-2)", maxWidth: 760 }}>
          Quando uma obra fecha, informe o R$/m² real de uma etapa (da contabilidade). O valor
          entra como nova amostra e desloca a mediana daquela etapa — exatamente a lógica da sua
          Planilha1, agora contínua.
        </p>
        <form action={addRealCostObservation} style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <label style={{ display: "grid", gap: 4, fontSize: 12, color: "var(--o-text-2)" }}>
            Etapa
            <select name="rate_id" required className="diario-input" style={{ height: 34, minWidth: 260 }}>
              {rates.map((r) => (
                <option key={r.id} value={r.id}>
                  {(r.etapa_numero ?? "") + " " + r.etapa_nome}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 12, color: "var(--o-text-2)" }}>
            R$/m² real observado
            <input name="observed_r_m2" inputMode="decimal" required className="diario-input" style={{ height: 34, width: 160 }} placeholder="ex.: 905,50" />
          </label>
          <button type="submit" className="btn-brand" style={{ height: 34 }}>
            Lançar
          </button>
        </form>
      </div>
    </div>
  );
}
