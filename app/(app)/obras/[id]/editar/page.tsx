import { notFound } from "next/navigation";
import { Camera, Save, X } from "lucide-react";
import { ObraSidebar } from "@/components/layout/ObraSidebar";
import { createServerSupabase } from "@/lib/supabase/server";
import { updateSite, uploadSiteCover } from "@/lib/rdo-actions";
import { fetchAllPages } from "@/lib/supabase/fetch-all";
import { VISIBLE_SOURCE_PROVIDERS } from "@/lib/rdo-source-scope";
import { mediaUrl } from "@/lib/storage";

type Site = {
  id: string;
  name: string;
  client_name: string | null;
  address: string | null;
  start_date: string | null;
  end_date: string | null;
  contract_number: string | null;
  status: string | null;
  lat: number | null;
  lng: number | null;
  cover_url: string | null;
};

export default async function EditarObraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: siteRaw } = await supabase
    .from("sites")
    .select("id, name, client_name, address, start_date, end_date, contract_number, status, lat, lng, cover_url")
    .eq("id", id)
    .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
    .maybeSingle();
  const site = siteRaw as Site | null;
  if (!site) notFound();

  const { data: reportsRaw } = await supabase
    .from("daily_reports")
    .select("id")
    .eq("site_id", id)
    .in("external_provider", VISIBLE_SOURCE_PROVIDERS);
  const { data: tasksRaw } = await supabase
    .from("wbs_items")
    .select("id")
    .eq("site_id", id)
    .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
    .not("parent_id", "is", null);
  const mediaRows = await fetchAllPages<{ kind: string | null }>(() =>
    supabase
      .from("media")
      .select("kind")
      .eq("site_id", id)
      .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
  );
  const reports = (reportsRaw ?? []) as { id: string }[];
  const tasks = (tasksRaw ?? []) as { id: string }[];
  const photoCount = mediaRows.filter((media) => media.kind === "photo").length;
  const videoCount = mediaRows.filter((media) => media.kind === "video").length;
  const fileCount = mediaRows.filter((media) => media.kind === "file").length;

  return (
    <div className="do-obra-layout">
      <ObraSidebar
        site={site}
        active="edit"
        counts={{
          reports: reports.length,
          tasks: tasks.length,
          photos: photoCount,
          videos: videoCount,
          files: fileCount,
        }}
      />

      <main className="do-obra-main">
        <div className="diario-container">
          <div className="do-obra-header">
            <h1>Editar obra</h1>
          </div>

          <div className="do-form-card">
            <form action={uploadSiteCover} className="do-cover-editor">
              <input type="hidden" name="siteId" value={id} />
              <div className="do-cover-editor__inner">
                <div
                  className="do-cover-editor__thumb"
                  style={{ backgroundImage: site.cover_url ? `url(${mediaUrl(site.cover_url)})` : undefined }}
                />
                <span style={{ color: "#777", fontSize: 12 }}>Imagem da obra</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                  <label className="diario-blue-button" style={{ cursor: "pointer" }}>
                    <Camera size={15} />
                    Adicionar
                    <input type="file" name="cover" accept="image/*" required style={{ display: "none" }} />
                  </label>
                  <button className="diario-red-button" type="submit">
                    <Save size={15} />
                    Salvar imagem
                  </button>
                  <button className="diario-red-button" type="button" disabled style={{ opacity: 0.75 }}>
                    <X size={15} />
                    Excluir
                  </button>
                </div>
              </div>
            </form>

            <form action={updateSite}>
              <input type="hidden" name="id" value={id} />

              <div className="do-radio-row">
                <label>
                  <input type="radio" defaultChecked readOnly /> Cadastro completo
                </label>
                <label>
                  <input type="radio" readOnly /> Cadastro simples
                </label>
              </div>

              <div className="do-form-grid">
                <Field label="Nome *" wide>
                  <input name="name" required defaultValue={site.name} placeholder="Ex.: Shopping Santa Luzia" />
                </Field>
                <Field label="Responsável" half>
                  <input placeholder="Ex.: Eng. Carlos Silva" />
                </Field>
                <Field label="Tipo de contrato" half>
                  <select defaultValue="Cliente">
                    <option>Cliente</option>
                    <option>Própria</option>
                    <option>Investimento</option>
                  </select>
                </Field>
                <Field label="Cliente" half>
                  <input name="client_name" defaultValue={site.client_name ?? ""} placeholder="Ex.: Prefeitura" />
                </Field>
                <Field label="Data início *">
                  <input name="start_date" type="date" defaultValue={site.start_date ?? ""} />
                </Field>
                <Field label="Previsão de término *">
                  <input name="end_date" type="date" defaultValue={site.end_date ?? ""} />
                </Field>
                <Field label="N° do contrato">
                  <input name="contract_number" defaultValue={site.contract_number ?? ""} />
                </Field>
                <Field label="Status">
                  <select name="status" defaultValue={site.status ?? "in_progress"}>
                    <option value="in_progress">Em andamento</option>
                    <option value="not_started">Não iniciada</option>
                    <option value="paused">Pausada</option>
                    <option value="done">Concluída</option>
                    <option value="cancelled">Cancelada</option>
                  </select>
                </Field>
                <Field label="Endereço" wide>
                  <input name="address" defaultValue={site.address ?? ""} placeholder="Ex.: Av. ABC, 100, Centro" />
                </Field>
                <Field label="Observação" wide>
                  <textarea defaultValue={site.address ?? ""} />
                </Field>
                <Field label="Latitude">
                  <input name="lat" type="number" step="0.000001" defaultValue={site.lat ?? ""} />
                </Field>
                <Field label="Longitude">
                  <input name="lng" type="number" step="0.000001" defaultValue={site.lng ?? ""} />
                </Field>
              </div>

              <div className="do-form-actions">
                <button type="submit" className="diario-blue-button">
                  <Save size={15} />
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  children,
  wide = false,
  half = false,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
  half?: boolean;
}) {
  return (
    <div className={`do-form-field ${wide ? "is-wide" : ""} ${half ? "is-half" : ""}`}>
      <label>{label}</label>
      {children}
    </div>
  );
}
