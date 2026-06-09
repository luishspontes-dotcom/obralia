import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { createMedicao } from "@/lib/medicao-actions";
import { VISIBLE_SOURCE_PROVIDERS } from "@/lib/rdo-source-scope";

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function NovaMedicaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();

  const { data: siteRaw } = await supabase
    .from("sites")
    .select("id, name")
    .eq("id", id)
    .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
    .maybeSingle();
  const site = siteRaw as { id: string; name: string } | null;
  if (!site) redirect("/obras");

  // Default: mês corrente
  const now = new Date();
  const monthStart = toISODate(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthEnd = toISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  return (
    <div>
      <div className="page-hero">
        <div style={{ maxWidth: 880, margin: "0 auto" }}>
          <div style={{ marginBottom: 12, fontSize: 13 }}>
            <Link href="/obras" style={{ color: "var(--o-text-2)", textDecoration: "none" }}>← Obras</Link>
            <span style={{ color: "var(--o-text-3)", margin: "0 8px" }}>/</span>
            <Link href={`/obras/${id}`} style={{ color: "var(--o-text-2)", textDecoration: "none" }}>{site.name}</Link>
            <span style={{ color: "var(--o-text-3)", margin: "0 8px" }}>/</span>
            <Link href={`/obras/${id}/medicoes`} style={{ color: "var(--o-text-2)", textDecoration: "none" }}>Medições</Link>
            <span style={{ color: "var(--o-text-3)", margin: "0 8px" }}>/</span>
            <span style={{ color: "var(--o-text-1)", fontWeight: 500 }}>Nova</span>
          </div>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--t-brand)", fontWeight: 600, marginBottom: 8 }}>
            Boletim de medição
          </div>
          <h1 style={{ margin: "0 0 6px", font: "700 32px var(--font-inter)", letterSpacing: "-0.025em" }}>
            Nova medição
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "var(--o-text-2)" }}>
            {site.name} · defina o período que será medido.
          </p>
        </div>
      </div>

      <div style={{ padding: "0 24px 32px", maxWidth: 880, margin: "0 auto" }}>
        <form action={createMedicao} className="card" style={{ padding: "22px 24px" }}>
          <input type="hidden" name="siteId" value={id} />

          <div
            style={{
              padding: "12px 16px",
              marginBottom: 18,
              borderRadius: 10,
              background: "var(--t-brand-soft)",
              border: "1px solid var(--t-brand)",
              fontSize: 13,
              color: "var(--o-text-1)",
              lineHeight: 1.55,
            }}
          >
            📋 Os itens da medição serão <strong>pré-preenchidos automaticamente</strong> com as
            atividades dos <strong>RDOs aprovados</strong> dentro do período escolhido — cada
            atividade entra com o maior avanço (%) registrado no período. Depois você pode ajustar
            quantidades, preços e adicionar itens manualmente.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
            <label style={labelStyle}>
              Início do período
              <input type="date" name="period_start" required defaultValue={monthStart} style={inputStyle} className="tnum" />
            </label>
            <label style={labelStyle}>
              Fim do período
              <input type="date" name="period_end" required defaultValue={monthEnd} style={inputStyle} className="tnum" />
            </label>
          </div>

          <label style={{ ...labelStyle, marginBottom: 18 }}>
            Observações (opcional)
            <textarea
              name="notes"
              rows={3}
              placeholder="Ex: medição referente ao contrato nº…, condições de faturamento…"
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </label>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <Link href={`/obras/${id}/medicoes`} className="chip" style={{ textDecoration: "none" }}>
              Cancelar
            </Link>
            <button type="submit" className="btn-brand" style={{ padding: "10px 20px", fontSize: 14 }}>
              Criar medição
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontSize: 13,
  fontWeight: 500,
  color: "var(--o-text-2)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--o-paper)",
  border: "1px solid var(--o-border)",
  borderRadius: 8,
  padding: "10px 12px",
  font: "400 14px var(--font-inter)",
  color: "var(--o-text-1)",
  outline: "none",
};
