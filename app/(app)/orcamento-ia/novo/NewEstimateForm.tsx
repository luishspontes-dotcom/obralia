"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud } from "lucide-react";
import {
  failAiEstimate,
  finalizeAiEstimateUpload,
  prepareAiEstimate,
} from "@/lib/budget-ai/actions";
import { MAX_PLAN_TOTAL_BYTES, PLAN_LIMIT_MESSAGE } from "@/lib/budget-ai/limits";
import { createBrowserSupabase } from "@/lib/supabase/client";

type Site = { id: string; name: string };

type UploadedFilePayload = {
  kind: "plan" | "proposal" | "spreadsheet" | "other";
  file_name: string;
  storage_bucket: "exports";
  storage_path: string;
  content_type: string | null;
  size_bytes: number;
};

const uploadFields: Array<{ name: string; kind: UploadedFilePayload["kind"] }> = [
  { name: "plan_files", kind: "plan" },
  { name: "proposal_files", kind: "proposal" },
  { name: "spreadsheet_files", kind: "spreadsheet" },
];

export function NewEstimateForm({
  sites,
  initialSiteId = "",
  lockSite = false,
}: {
  sites: Site[];
  initialSiteId?: string;
  lockSite?: boolean;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [status, setStatus] = useState<"idle" | "creating" | "uploading" | "processing" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    let estimateId: string | null = null;

    try {
      setStatus("creating");
      setMessage("Criando estudo...");
      const source = new FormData(form);
      const planFiles = source
        .getAll("plan_files")
        .filter((file): file is File => file instanceof File && file.size > 0);
      if (planFiles.length === 0) {
        throw new Error("Envie ao menos uma planta em PDF para gerar o estudo.");
      }
      // Recusa amigável antes mesmo do upload (limite ~80 páginas / 20MB).
      const planBytes = planFiles.reduce((sum, file) => sum + file.size, 0);
      if (planBytes > MAX_PLAN_TOTAL_BYTES) {
        throw new Error(PLAN_LIMIT_MESSAGE);
      }
      const prepared = await prepareAiEstimate(scalarFormData(source));
      estimateId = prepared.estimateId;

      setStatus("uploading");
      const uploaded = await uploadFiles(source, prepared.organizationId, prepared.estimateId);

      // Finalização rápida: só registra os arquivos. A leitura da planta pela
      // Claude roda de forma assíncrona na página do estudo (1 a 3 minutos).
      setStatus("processing");
      setMessage("Abrindo o estudo... a leitura da planta continua em segundo plano.");
      const finalizeData = new FormData();
      finalizeData.set("estimate_id", prepared.estimateId);
      finalizeData.set("files_json", JSON.stringify(uploaded));
      await finalizeAiEstimateUpload(finalizeData);

      const linkedSiteId = typeof source.get("site_id") === "string" ? String(source.get("site_id")).trim() : "";
      router.push(
        linkedSiteId
          ? `/obras/${linkedSiteId}/orcamento-ia/${prepared.estimateId}`
          : `/orcamento-ia/${prepared.estimateId}`
      );
      router.refresh();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Nao foi possivel gerar o estudo.";
      if (estimateId) {
        const failData = new FormData();
        failData.set("estimate_id", estimateId);
        failData.set("message", errorMessage);
        await failAiEstimate(failData).catch(() => undefined);
      }
      setStatus("error");
      setMessage(errorMessage);
    }
  }

  async function uploadFiles(
    source: FormData,
    organizationId: string,
    estimateId: string
  ): Promise<UploadedFilePayload[]> {
    const files = uploadFields.flatMap((field) =>
      source
        .getAll(field.name)
        .filter((file): file is File => file instanceof File && file.size > 0)
        .map((file) => ({ file, kind: field.kind }))
    );
    const uploaded: UploadedFilePayload[] = [];

    for (const [index, entry] of files.entries()) {
      setMessage(`Enviando arquivo ${index + 1} de ${files.length}...`);
      const storagePath = `${organizationId}/estimativas/${estimateId}/${entry.kind}-${Date.now()}-${index}-${safeFileName(entry.file.name)}`;
      const { error } = await supabase.storage.from("exports").upload(storagePath, entry.file, {
        contentType: entry.file.type || "application/octet-stream",
        upsert: false,
        metadata: {
          estimate_id: estimateId,
          kind: entry.kind,
        },
      });

      if (error) throw new Error(error.message);
      uploaded.push({
        kind: entry.kind,
        file_name: entry.file.name,
        storage_bucket: "exports",
        storage_path: storagePath,
        content_type: entry.file.type || null,
        size_bytes: entry.file.size,
      });
    }

    return uploaded;
  }

  const isBusy = status === "creating" || status === "uploading" || status === "processing";

  return (
    <form onSubmit={handleSubmit} className="card" style={{ padding: 22 }}>
      <div className="ai-budget-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="Nome do estudo" required>
          <input name="title" required defaultValue="Estudo preliminar" style={inputStyle} />
        </Field>
        <Field label="Obra vinculada">
          {lockSite ? (
            <>
              <input type="hidden" name="site_id" value={initialSiteId} />
              <div style={{ ...inputStyle, background: "var(--o-soft)", fontWeight: 700 }}>
                {sites.find((site) => site.id === initialSiteId)?.name ?? "Obra selecionada"}
              </div>
            </>
          ) : (
            <select name="site_id" defaultValue={initialSiteId} style={inputStyle}>
              <option value="">Sem vinculo por enquanto</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>{site.name}</option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Cliente">
          <input name="client_name" placeholder="A IA tenta extrair da planta quando existir" style={inputStyle} />
        </Field>
        <Field label="Endereço">
          <input name="address" placeholder="Condomínio, lote, cidade..." style={inputStyle} />
        </Field>
        <Field label="Área construída (m²)">
          <input name="built_area_m2" inputMode="decimal" placeholder="Opcional; a IA tenta ler da planta" style={inputStyle} />
        </Field>
        <Field label="Área da piscina (m²)">
          <input name="pool_area_m2" inputMode="decimal" placeholder="Opcional" style={inputStyle} />
        </Field>
        <Field label="Área do terreno (m²)">
          <input name="terrain_area_m2" inputMode="decimal" placeholder="Ex.: 418,18" style={inputStyle} />
        </Field>
        <Field label="Pavimentos">
          <input name="floors_count" inputMode="numeric" placeholder="Opcional" style={inputStyle} />
        </Field>
        <Field label="Padrão">
          <select name="quality_standard" defaultValue="alto_padrao" style={inputStyle}>
            <option value="alto_padrao">Alto padrão</option>
            <option value="medio_alto">Médio alto</option>
            <option value="economico">Econômico</option>
          </select>
        </Field>
        <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 24, color: "var(--o-text-1)", fontWeight: 600 }}>
          <input name="has_basement" type="checkbox" />
          Possui subsolo/corte relevante
        </label>
      </div>

      <div style={{ marginTop: 24, borderTop: "1px solid var(--o-border)", paddingTop: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <UploadCloud size={18} color="var(--t-brand)" />
          <h2 style={{ margin: 0, font: "700 18px var(--font-inter)" }}>Arquivos da análise</h2>
        </div>
        <div className="ai-budget-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <FileField label="Planta PDF" name="plan_files" accept=".pdf,application/pdf" required />
          <FileField label="Memorial/proposta PDF" name="proposal_files" accept=".pdf,application/pdf" />
          <FileField label="Planilha XLSX" name="spreadsheet_files" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
        </div>
      </div>

      <div style={{ marginTop: 22, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <p style={{ margin: 0, color: status === "error" ? "var(--st-late)" : "var(--o-text-2)", fontSize: 12, maxWidth: 620 }}>
          {message || "A planta é a fonte principal. Campos manuais só corrigem ou complementam o que a leitura visual não conseguir defender."}
        </p>
        <button type="submit" className="btn-brand" disabled={isBusy} style={{ display: "inline-flex", alignItems: "center", gap: 8, opacity: isBusy ? 0.72 : 1 }}>
          {isBusy ? "Gerando..." : "Gerar estudo preliminar"}
        </button>
      </div>
    </form>
  );
}

function scalarFormData(source: FormData): FormData {
  const output = new FormData();
  const fields = [
    "title",
    "site_id",
    "client_name",
    "address",
    "built_area_m2",
    "pool_area_m2",
    "terrain_area_m2",
    "floors_count",
    "quality_standard",
  ];

  for (const field of fields) {
    const value = source.get(field);
    if (typeof value === "string") output.set(field, value);
  }

  if (source.get("has_basement") === "on") output.set("has_basement", "on");
  return output;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ font: "600 12px var(--font-inter)", color: "var(--o-text-2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}{required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}

function FileField({ label, name, accept, required }: { label: string; name: string; accept: string; required?: boolean }) {
  const inputId = useId();
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);

  return (
    <div style={{ display: "grid", gap: 8, border: "1px dashed var(--o-border-2)", borderRadius: 10, padding: 14, background: "var(--o-soft)" }}>
      <span style={{ fontWeight: 700, color: "var(--o-text-1)" }}>{label}{required ? " *" : ""}</span>
      <input
        id={inputId}
        name={name}
        type="file"
        accept={accept}
        multiple
        onChange={(event) => setSelectedFiles(Array.from(event.currentTarget.files ?? []).map((file) => file.name))}
        style={visuallyHiddenInputStyle}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <label
          htmlFor={inputId}
          className="chip"
          style={{ cursor: "pointer", justifyContent: "center", color: "var(--t-brand)", background: "white" }}
        >
          Selecionar arquivos
        </label>
        <span style={{ color: "var(--o-text-2)", fontSize: 12, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
          {selectedFiles.length === 0
            ? "Nenhum arquivo selecionado"
            : selectedFiles.length === 1
              ? selectedFiles[0]
              : `${selectedFiles.length} arquivos selecionados`}
        </span>
      </div>
      <span style={{ color: "var(--o-text-2)", fontSize: 12 }}>
        {required ? "Arquivo principal para orçamento e memorial." : "Opcional; melhora a comparação quando existir."}
      </span>
    </div>
  );
}

function safeFileName(value: string): string {
  const fallback = "arquivo";
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120) || fallback
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--o-border)",
  borderRadius: 8,
  background: "white",
  color: "var(--o-text-1)",
  padding: "10px 12px",
  font: "400 14px var(--font-inter)",
  outline: "none",
};

const visuallyHiddenInputStyle: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
};
