import Link from "next/link";
import { notFound } from "next/navigation";
import { Ruler } from "lucide-react";
import { ObraSidebar } from "@/components/layout/ObraSidebar";
import { createServerSupabase } from "@/lib/supabase/server";
import { VISIBLE_SOURCE_PROVIDERS } from "@/lib/rdo-source-scope";

type Site = {
  id: string;
  name: string;
  cover_url: string | null;
};

type Medicao = {
  id: string;
  number: number;
  period_start: string;
  period_end: string;
  status: string;
  total_value: number | null;
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft: { label: "Rascunho", cls: "is-paused" },
  submitted: { label: "Enviada", cls: "" },
  approved: { label: "Aprovada", cls: "is-done" },
};

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function fmtDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

export default async function ObraMedicoesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();

  const { data: siteRaw } = await supabase
    .from("sites")
    .select("id, name, cover_url")
    .eq("id", id)
    .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
    .maybeSingle();
  const site = siteRaw as Site | null;
  if (!site) notFound();

  const [{ data: medicoesRaw }, { count: reportsCount }] = await Promise.all([
    supabase
      .from("medicoes")
      .select("id, number, period_start, period_end, status, total_value")
      .eq("site_id", id)
      .order("number", { ascending: false }),
    supabase
      .from("daily_reports")
      .select("*", { count: "exact", head: true })
      .eq("site_id", id)
      .in("external_provider", VISIBLE_SOURCE_PROVIDERS),
  ]);
  const medicoes = (medicoesRaw ?? []) as Medicao[];

  return (
    <div className="do-obra-layout">
      <ObraSidebar
        site={site}
        active="medicoes"
        counts={{
          reports: reportsCount ?? 0,
          medicoes: medicoes.length,
        }}
      />

      <main className="do-obra-main">
        <div className="diario-container">
          <div className="diario-page-header">
            <div>
              <h1>Medições ({medicoes.length})</h1>
              <p>{site.name}</p>
            </div>
            <div className="diario-toolbar">
              <Link href={`/obras/${id}/medicoes/nova`} className="diario-blue-button">
                + Nova medição
              </Link>
            </div>
          </div>

          {medicoes.length === 0 ? (
            <section className="do-panel" style={{ padding: "48px 32px", textAlign: "center" }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 14,
                  background: "var(--t-brand-soft)",
                  color: "var(--t-brand)",
                  display: "grid",
                  placeItems: "center",
                  margin: "0 auto 16px",
                }}
              >
                <Ruler size={26} />
              </div>
              <h2 style={{ margin: "0 0 8px", font: "600 18px var(--font-inter)", color: "var(--o-text-1)" }}>
                Nenhuma medição ainda
              </h2>
              <p style={{ margin: "0 auto 18px", maxWidth: 520, fontSize: 14, color: "var(--o-text-2)", lineHeight: 1.6 }}>
                O boletim de medição consolida o avanço físico da obra em um período (geralmente mensal),
                servindo de base para faturamento e prestação de contas ao cliente. Ao criar uma medição,
                os itens são pré-preenchidos automaticamente com as atividades dos RDOs aprovados do período.
              </p>
              <Link href={`/obras/${id}/medicoes/nova`} className="diario-blue-button" style={{ display: "inline-block" }}>
                + Criar primeira medição
              </Link>
            </section>
          ) : (
            <section className="do-panel">
              <div className="do-table-wrap">
                <table className="do-table">
                  <thead>
                    <tr>
                      <th>N°</th>
                      <th>Período</th>
                      <th>Status</th>
                      <th>Total</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {medicoes.map((medicao) => {
                      const meta = STATUS_META[medicao.status] ?? STATUS_META.draft;
                      return (
                        <tr key={medicao.id}>
                          <td className="tnum">
                            <Link href={`/obras/${id}/medicoes/${medicao.id}`}>#{medicao.number}</Link>
                          </td>
                          <td className="tnum">
                            {fmtDate(medicao.period_start)} – {fmtDate(medicao.period_end)}
                          </td>
                          <td>
                            <span className={`diario-status-badge ${meta.cls}`}>{meta.label}</span>
                          </td>
                          <td className="tnum">{brl.format(medicao.total_value ?? 0)}</td>
                          <td>
                            <Link
                              href={`/obras/${id}/medicoes/${medicao.id}`}
                              style={{ fontSize: 13, color: "var(--t-brand)", fontWeight: 500, textDecoration: "none" }}
                            >
                              Abrir →
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
