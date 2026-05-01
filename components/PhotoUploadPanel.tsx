"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ImagePlus,
  Loader2,
  UploadCloud,
  X,
} from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/client";

type DailyReportOption = {
  id: string;
  number: number;
  date: string;
  status: string | null;
};

type SelectedFile = {
  id: string;
  file: File;
  previewUrl: string;
  status: "queued" | "compressing" | "uploading" | "saving" | "done" | "error";
  message?: string;
};

type PreparedImage = {
  file: File;
  width: number | null;
  height: number | null;
};

export function PhotoUploadPanel({
  siteId,
  organizationId,
  canUpload,
  dailyReports,
  defaultDailyReportId = "",
  lockDailyReport = false,
}: {
  siteId: string;
  organizationId: string;
  canUpload: boolean;
  dailyReports: DailyReportOption[];
  defaultDailyReportId?: string;
  lockDailyReport?: boolean;
}) {
  const router = useRouter();
  const [caption, setCaption] = useState("");
  const [dailyReportId, setDailyReportId] = useState(defaultDailyReportId);
  const [selected, setSelected] = useState<SelectedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const selectedRef = useRef<SelectedFile[]>([]);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    return () => {
      selectedRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

  const doneCount = selected.filter((item) => item.status === "done").length;
  const hasFiles = selected.length > 0;
  const isUploading = selected.some((item) =>
    ["compressing", "uploading", "saving"].includes(item.status)
  );

  const selectedReportLabel = useMemo(() => {
    const report = dailyReports.find((item) => item.id === dailyReportId);
    if (!report) return "Sem RDO";
    return `RDO #${report.number}`;
  }, [dailyReportId, dailyReports]);

  if (!canUpload) return null;

  function onSelectFiles(files: FileList | null) {
    setError(null);
    selected.forEach((item) => URL.revokeObjectURL(item.previewUrl));

    const nextFiles = Array.from(files ?? [])
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, 24)
      .map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        status: "queued" as const,
      }));

    setSelected(nextFiles);
  }

  function updateFile(id: string, patch: Partial<SelectedFile>) {
    setSelected((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }

  function clearSelection() {
    selected.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setSelected([]);
    setError(null);
  }

  async function uploadSelected() {
    if (selected.length === 0 || isUploading) return;

    setError(null);
    const supabase = createBrowserSupabase();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError("Sessão expirada. Entre novamente para enviar fotos.");
      return;
    }

    for (const item of selected) {
      try {
        updateFile(item.id, { status: "compressing", message: "Otimizando" });
        const prepared = await prepareImage(item.file);
        const takenAt = new Date(item.file.lastModified || Date.now());
        const path = buildStoragePath({
          organizationId,
          siteId,
          dailyReportId,
          file: prepared.file,
          takenAt,
        });

        updateFile(item.id, { status: "uploading", message: "Enviando" });
        const upload = await supabase.storage
          .from("media")
          .upload(path, prepared.file, {
            cacheControl: "31536000",
            contentType: prepared.file.type,
            upsert: false,
          });

        if (upload.error) throw upload.error;

        updateFile(item.id, { status: "saving", message: "Registrando" });
        const insert = await supabase.from("media").insert({
          site_id: siteId,
          daily_report_id: dailyReportId || null,
          kind: "photo",
          storage_path: path,
          thumbnail_path: path,
          caption: caption.trim() || item.file.name,
          taken_at: takenAt.toISOString(),
          taken_by: user.id,
          size_bytes: prepared.file.size,
          width: prepared.width,
          height: prepared.height,
        });

        if (insert.error) {
          await supabase.storage.from("media").remove([path]);
          throw insert.error;
        }

        updateFile(item.id, { status: "done", message: "Enviada" });
      } catch (cause) {
        updateFile(item.id, {
          status: "error",
          message:
            cause instanceof Error
              ? cause.message
              : "Não foi possível enviar esta foto.",
        });
      }
    }

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div
      style={{
        background: "var(--o-paper)",
        border: "1px solid var(--o-border)",
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 14,
        }}
      >
        <div>
          <div style={{ font: "700 15px var(--font-inter)" }}>
            Enviar fotos de campo
          </div>
          <div style={{ color: "var(--o-text-2)", fontSize: 12, marginTop: 2 }}>
            Imagens são otimizadas no aparelho antes do envio.
          </div>
        </div>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            display: "grid",
            placeItems: "center",
            color: "var(--t-brand)",
            background: "var(--t-brand-soft)",
            flex: "0 0 auto",
          }}
        >
          <Camera size={19} />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <label style={fieldLabelStyle}>
          Legenda
          <input
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            placeholder="Ex: concretagem da laje"
            style={inputStyle}
          />
        </label>

        <label style={fieldLabelStyle}>
          Vincular ao RDO
          <select
            value={dailyReportId}
            onChange={(event) => setDailyReportId(event.target.value)}
            disabled={lockDailyReport}
            style={inputStyle}
          >
            <option value="">Sem RDO</option>
            {dailyReports.map((report) => (
              <option key={report.id} value={report.id}>
                RDO #{report.number} ·{" "}
                {new Date(report.date).toLocaleDateString("pt-BR")}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label
        style={{
          border: "1px dashed var(--o-border)",
          background: "var(--o-cream)",
          borderRadius: 12,
          minHeight: 112,
          display: "grid",
          placeItems: "center",
          textAlign: "center",
          padding: 18,
          cursor: "pointer",
        }}
      >
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(event) => onSelectFiles(event.target.files)}
          style={{ display: "none" }}
        />
        <span>
          <ImagePlus size={24} style={{ color: "var(--t-brand)", marginBottom: 8 }} />
          <span style={{ display: "block", font: "700 14px var(--font-inter)" }}>
            Selecionar ou capturar fotos
          </span>
          <span style={{ display: "block", color: "var(--o-text-2)", fontSize: 12, marginTop: 4 }}>
            Até 24 imagens por envio · destino: {selectedReportLabel}
          </span>
        </span>
      </label>

      {hasFiles && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))",
              gap: 8,
              marginTop: 12,
            }}
          >
            {selected.map((item) => (
              <div
                key={item.id}
                style={{
                  position: "relative",
                  aspectRatio: "1 / 1",
                  borderRadius: 8,
                  overflow: "hidden",
                  background: "var(--o-border)",
                  border:
                    item.status === "error"
                      ? "1px solid var(--st-late)"
                      : "1px solid var(--o-border)",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.previewUrl}
                  alt={item.file.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: "auto 0 0",
                    background: "rgba(0,0,0,0.64)",
                    color: "white",
                    padding: "5px 6px",
                    fontSize: 10,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {statusIcon(item.status)}
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.message ?? item.file.name}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginTop: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ color: "var(--o-text-2)", fontSize: 12 }}>
              {doneCount > 0
                ? `${doneCount}/${selected.length} enviadas`
                : `${selected.length} ${selected.length === 1 ? "foto selecionada" : "fotos selecionadas"}`}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                onClick={clearSelection}
                disabled={isUploading}
                style={secondaryButtonStyle}
              >
                <X size={15} /> Limpar
              </button>
              <button
                type="button"
                onClick={uploadSelected}
                disabled={isUploading || isPending}
                style={primaryButtonStyle}
              >
                {isUploading || isPending ? (
                  <Loader2 size={16} className="spin-icon" />
                ) : (
                  <UploadCloud size={16} />
                )}
                Enviar
              </button>
            </div>
          </div>
        </>
      )}

      {error && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 12,
            color: "var(--st-late)",
            fontSize: 12,
          }}
        >
          <AlertTriangle size={15} /> {error}
        </div>
      )}
    </div>
  );
}

async function prepareImage(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Arquivo não é uma imagem.");
  }

  if (file.type === "image/gif") {
    return { file, width: null, height: null };
  }

  const bitmap = await createImageBitmap(file);
  const maxSide = 1920;
  const ratio = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * ratio));
  const height = Math.max(1, Math.round(bitmap.height * ratio));

  if (ratio === 1 && file.size <= 1_500_000) {
    bitmap.close();
    return { file, width, height };
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) {
    bitmap.close();
    return { file, width, height };
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error("Falha ao otimizar imagem."));
      },
      "image/jpeg",
      0.82
    );
  });

  return {
    file: new File([blob], replaceExtension(file.name, "jpg"), {
      type: "image/jpeg",
      lastModified: file.lastModified,
    }),
    width,
    height,
  };
}

function buildStoragePath({
  organizationId,
  siteId,
  dailyReportId,
  file,
  takenAt,
}: {
  organizationId: string;
  siteId: string;
  dailyReportId: string;
  file: File;
  takenAt: Date;
}) {
  const ext = extensionFor(file);
  const dateFolder = takenAt.toISOString().slice(0, 10);
  const scope = dailyReportId ? `rdos/${dailyReportId}` : "site";

  return `${organizationId}/${siteId}/${scope}/${dateFolder}/${crypto.randomUUID()}.${ext}`;
}

function extensionFor(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";
  return "jpg";
}

function replaceExtension(name: string, extension: string) {
  return `${name.replace(/\.[^.]+$/, "")}.${extension}`;
}

function statusIcon(status: SelectedFile["status"]) {
  if (status === "done") return <CheckCircle2 size={12} />;
  if (status === "error") return <AlertTriangle size={12} />;
  if (["compressing", "uploading", "saving"].includes(status)) {
    return <Loader2 size={12} className="spin-icon" />;
  }
  return <ImagePlus size={12} />;
}

const fieldLabelStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  color: "var(--o-text-2)",
  font: "600 12px var(--font-inter)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--o-cream)",
  border: "1px solid var(--o-border)",
  borderRadius: 8,
  padding: "10px 12px",
  font: "400 14px var(--font-inter)",
  color: "var(--o-text-1)",
  outline: "none",
};

const primaryButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  border: 0,
  background: "var(--o-accent)",
  color: "white",
  borderRadius: 8,
  padding: "10px 14px",
  font: "700 13px var(--font-inter)",
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  border: "1px solid var(--o-border)",
  background: "var(--o-paper)",
  color: "var(--o-text-1)",
  borderRadius: 8,
  padding: "10px 14px",
  font: "700 13px var(--font-inter)",
  cursor: "pointer",
};
