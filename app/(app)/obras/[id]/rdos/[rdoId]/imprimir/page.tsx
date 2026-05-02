import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { mediaUrl } from "@/lib/storage";
import { PrintButton } from "@/components/PrintButton";

type Site = { id: string; name: string; client_name: string | null; address: string | null; contract_number: string | null };
type DR = {
  id: string; number: number; date: string; status: string;
  weather_morning: string | null; weather_afternoon: string | null;
  condition_morning: string | null; condition_afternoon: string | null;
  general_notes: string | null;
  approval_status_label: string | null;
};
type Activity = { id: string; description: string; progress_pct: number | null; notes: string | null };
type Workforce = { id: string; role: string; count: number };
type Equipment = { id: string; name: string; hours: number | null };
type Photo = { id: string; storage_path: string | null; thumbnail_path: string | null; caption: string | null };

export default async function ImprimirRdoPage({
  params,
}: {
  params: Promise<{ id: string; rdoId: string }>;
}) {
  const { id, rdoId } = await params;
  const supabase = await createServerSupabase();

  const { data: siteRaw } = await supabase
    .from("sites").select("id, name, client_name, address, contract_number").eq("id", id).maybeSingle();
  const site = siteRaw as Site | null;
  if (!site) notFound();

  const { data: rdoRaw } = await supabase
    .from("daily_reports")
    .select("id, number, date, status, weather_morning, weather_afternoon, condition_morning, condition_afternoon, general_notes, approval_status_label")
    .eq("id", rdoId).eq("site_id", id).maybeSingle();
  const rdo = rdoRaw as DR | null;
  if (!rdo) notFound();

  const [actsR, wfR, eqR, photosR] = await Promise.all([
    supabase.from("report_activities").select("id, description, progress_pct, notes").eq("daily_report_id", rdoId),
    supabase.from("report_workforce").select("id, role, count").eq("daily_report_id", rdoId),
    supabase.from("report_equipment").select("id, name, hours").eq("daily_report_id", rdoId),
    supabase.from("media").select("id, storage_path, thumbnail_path, caption").eq("daily_report_id", rdoId).eq("kind", "photo").limit(60),
  ]);

  const activities = (actsR.data ?? []) as Activity[];
  const workforce  = (wfR.data ?? []) as Workforce[];
  const equipment  = (eqR.data ?? []) as Equipment[];
  const photos     = (photosR.data ?? []) as Photo[];

  const d = new Date(rdo.date);
  const dateLong = d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  const totalWorkers = workforce.reduce((s, w) => s + (w.count ?? 0), 0);

  return (
    <>
      {/* Print stylesheet — esconde a topbar/sidebar do app */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: A4; margin: 16mm 14mm; }
          body { background: white !important; }
          .no-print { display: none !important; }
          .app-topbar, [class*="Sidebar"], [class*="Rail"] { display: none !important; }
          main, body > * { padding: 0 !important; margin: 0 !important; }
          .print-page { box-shadow: none !important; border: none !important; max-width: 100% !important; padding: 0 !important; }
          .avoid-break { break-inside: avoid; }
        }
        @media screen {
          body { background: #f4f7f8; }
        }
        .print-page { background: white; max-width: 800px; margin: 24px auto; padding: 40px 48px; box-shadow: 0 4px 24px rgba(0,0,0,0.06); border-radius: 8px; }
        .pr-header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 16px; border-bottom: 2px solid #08789B; margin-bottom: 24px; }
        .pr-brand { font: 800 22px var(--font-inter, system-ui); color: #08789B; letter-spacing: -0.02em; }
        .pr-brand small { display: block; font: 500 11px system-ui; color: #4a5568; letter-spacing: 0.06em; text-transform: uppercase; margin-top: 2px; }
        .pr-meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 24px; margin-bottom: 24px; }
        .pr-kv { display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px; border-bottom: 1px solid #e2e8f0; }
        .pr-kv-label { color: #4a5568; }
        .pr-kv-value { color: #1a202c; font-weight: 500; text-align: right; }
        .pr-section { margin-top: 22px; break-inside: avoid; }
        .pr-section-title { font: 700 13px system-ui; color: #08789B; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0; }
        .pr-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .pr-table td { padding: 8px 4px; border-bottom: 1px solid #edf2f7; }
        .pr-table tr:last-child td { border-bottom: none; }
        .pr-photos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 8px; }
        .pr-photo { aspect-ratio: 4 / 3; object-fit: cover; width: 100%; border-radius: 4px; }
        .pr-status { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 11px; font-weight: 600; background: #dcf5e8; color: #137a4d; }
        .pr-status.draft { background: #fef3c7; color: #92400e; }
        .pr-actions { max-width: 800px; margin: 24px auto 0; padding: 0 16px; display: flex; gap: 8px; justify-content: flex-end; }
        .pr-btn { padding: 9px 16px; border-radius: 8px; border: 1px solid #e2e8f0; background: white; font: 500 13px system-ui; color: #1a202c; text-decoration: none; cursor: pointer; }
        .pr-btn-primary { background: #08789B; color: white; border-color: #08789B; }
        .pr-progress { width: 80px; height: 6px; background: #edf2f7; border-radius: 999px; overflow: hidden; display: inline-block; vertical-align: middle; margin-right: 6px; }
        .pr-progress-fill { height: 100%; background: #08789B; }
      `}} />

      <div className="pr-actions no-print">
        <a href={`/obras/${id}/rdos/${rdoId}`} className="pr-btn">← Voltar</a>
        <PrintButton />
      </div>

      <div className="print-page">
        <div className="pr-header avoid-break">
          <div className="pr-brand">
            obralia
            <small>{site.client_name ?? "Relatório Diário de Obra"}</small>
          </div>
          <div style={{ textAlign: "right", fontSize: 12, color: "#4a5568" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#1a202c", letterSpacing: "-0.02em" }}>RDO #{rdo.number}</div>
            <div style={{ marginTop: 2 }}>
              <span className={`pr-status ${rdo.status === "draft" ? "draft" : ""}`}>
                {rdo.approval_status_label ?? (rdo.status === "approved" ? "Aprovado" : rdo.status === "review" ? "Em revisão" : "Rascunho")}
              </span>
            </div>
          </div>
        </div>

        <div className="pr-meta-grid avoid-break">
          <div className="pr-kv"><span className="pr-kv-label">Obra</span><span className="pr-kv-value">{site.name}</span></div>
          <div className="pr-kv"><span className="pr-kv-label">Data</span><span className="pr-kv-value" style={{ textTransform: "capitalize" }}>{dateLong}</span></div>
          {site.address && <div className="pr-kv"><span className="pr-kv-label">Endereço</span><span className="pr-kv-value">{site.address}</span></div>}
          {site.contract_number && <div className="pr-kv"><span className="pr-kv-label">Contrato</span><span className="pr-kv-value">{site.contract_number}</span></div>}
        </div>

        {/* Clima */}
        <div className="pr-section avoid-break">
          <div className="pr-section-title">Clima</div>
          <table className="pr-table">
            <tbody>
              <tr>
                <td style={{ width: 90, fontWeight: 500, color: "#4a5568" }}>Manhã</td>
                <td>{rdo.weather_morning ?? "—"}</td>
                <td style={{ color: "#4a5568" }}>{rdo.condition_morning ?? "—"}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 500, color: "#4a5568" }}>Tarde</td>
                <td>{rdo.weather_afternoon ?? "—"}</td>
                <td style={{ color: "#4a5568" }}>{rdo.condition_afternoon ?? "—"}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Mão de obra */}
        {workforce.length > 0 && (
          <div className="pr-section avoid-break">
            <div className="pr-section-title">Mão de obra · {totalWorkers} pessoas</div>
            <table className="pr-table">
              <tbody>
                {workforce.map((w) => (
                  <tr key={w.id}>
                    <td>{w.role}</td>
                    <td style={{ width: 60, textAlign: "right", fontWeight: 600, color: "#08789B" }}>{w.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Equipamentos */}
        {equipment.length > 0 && (
          <div className="pr-section avoid-break">
            <div className="pr-section-title">Equipamentos · {equipment.length}</div>
            <table className="pr-table">
              <tbody>
                {equipment.map((e) => (
                  <tr key={e.id}>
                    <td>{e.name}</td>
                    <td style={{ width: 80, textAlign: "right", color: "#4a5568" }}>{e.hours != null ? `${e.hours}h` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Atividades */}
        {activities.length > 0 && (
          <div className="pr-section">
            <div className="pr-section-title">Atividades · {activities.length}</div>
            <table className="pr-table">
              <tbody>
                {activities.map((a) => {
                  const pct = a.progress_pct ?? 0;
                  return (
                    <tr key={a.id}>
                      <td>
                        <div>{a.description}</div>
                        {a.notes && <div style={{ fontSize: 11, color: "#718096", marginTop: 2 }}>{a.notes}</div>}
                      </td>
                      <td style={{ width: 130, textAlign: "right", whiteSpace: "nowrap" }}>
                        <span className="pr-progress"><span className="pr-progress-fill" style={{ width: `${pct}%` }} /></span>
                        <span style={{ fontWeight: 600, color: "#08789B", fontSize: 12 }}>{pct}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Observações */}
        {rdo.general_notes && (
          <div className="pr-section">
            <div className="pr-section-title">Observações gerais</div>
            <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", color: "#1a202c" }}>{rdo.general_notes}</div>
          </div>
        )}

        {/* Fotos */}
        {photos.length > 0 && (
          <div className="pr-section">
            <div className="pr-section-title">Fotos · {photos.length}</div>
            <div className="pr-photos">
              {photos.slice(0, 24).map((p) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img key={p.id} src={mediaUrl(p.thumbnail_path ?? p.storage_path)} alt={p.caption ?? "Foto"} className="pr-photo" />
              ))}
            </div>
            {photos.length > 24 && (
              <div style={{ fontSize: 11, color: "#718096", textAlign: "center", marginTop: 6 }}>
                + {photos.length - 24} fotos no sistema
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 32, paddingTop: 14, borderTop: "1px solid #e2e8f0", fontSize: 10, color: "#a0aec0", textAlign: "center" }}>
          Gerado em {new Date().toLocaleString("pt-BR")} · obralia.com.br
        </div>
      </div>
    </>
  );
}
