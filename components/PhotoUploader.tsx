"use client";

import { useEffect, useRef, useState } from "react";
import { uploadPhotos } from "@/lib/rdo-actions";

const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100MB por arquivo (fotos e vídeos)

/**
 * Tenta extrair GPS + taken_at via window.exifr (carregado dinamicamente).
 * Falha silenciosamente em arquivos sem EXIF (vídeos, screenshots).
 * IMPORTANTE: só roda em imagens — exifr quebra com vídeo.
 */
async function readExifSafe(file: File): Promise<{ lat?: number; lng?: number; takenAt?: string; w?: number; h?: number } | null> {
  if (!file.type.startsWith("image/")) return null;
  try {
    const exifr = await import("exifr").catch(() => null);
    if (!exifr) return null;
    const data = await exifr.parse(file, { gps: true, tiff: true, exif: true });
    if (!data) return null;
    return {
      lat: typeof data.latitude === "number" ? data.latitude : undefined,
      lng: typeof data.longitude === "number" ? data.longitude : undefined,
      takenAt: data.DateTimeOriginal instanceof Date ? data.DateTimeOriginal.toISOString() : undefined,
      w: data.ExifImageWidth ?? data.ImageWidth,
      h: data.ExifImageHeight ?? data.ImageHeight,
    };
  } catch {
    return null;
  }
}

type Preview = { url: string; isVideo: boolean; name: string };

export function PhotoUploader({ siteId, rdoId }: { siteId: string; rdoId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previews, setPreviews] = useState<Preview[]>([]);
  const count = previews.length;

  // Libera os object URLs quando os previews mudam / componente desmonta
  useEffect(() => {
    return () => { previews.forEach(p => URL.revokeObjectURL(p.url)); };
  }, [previews]);

  function handleSelect(fileList: FileList | null) {
    const all = Array.from(fileList ?? []);
    const ok = all.filter(f => f.size <= MAX_FILE_BYTES);
    const rejected = all.filter(f => f.size > MAX_FILE_BYTES);

    if (rejected.length > 0) {
      alert(
        `${rejected.length === 1 ? "1 arquivo passou" : `${rejected.length} arquivos passaram`} do limite de 100MB e ${rejected.length === 1 ? "foi removido" : "foram removidos"} da seleção:\n` +
        rejected.map(f => `• ${f.name} (${Math.round(f.size / 1024 / 1024)}MB)`).join("\n") +
        `\n\nDica: grave vídeos mais curtos ou reduza a qualidade na câmera.`
      );
      // Mantém só os arquivos válidos no input
      const dt = new DataTransfer();
      ok.forEach(f => dt.items.add(f));
      if (inputRef.current) inputRef.current.files = dt.files;
    }

    setPreviews(ok.map(f => ({
      url: URL.createObjectURL(f),
      isVideo: f.type.startsWith("video/"),
      name: f.name,
    })));
  }

  return (
    <form
      action={async (fd) => {
        setUploading(true);
        try {
          // Para cada arquivo, tenta extrair EXIF (só imagens) e envia como photo_meta_json
          const files = fd.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
          const metas: Array<Record<string, unknown>> = [];
          for (const f of files) metas.push((await readExifSafe(f)) ?? {});
          fd.set("photo_meta_json", JSON.stringify(metas));
          await uploadPhotos(fd);
        } finally {
          setUploading(false); setPreviews([]);
          if (inputRef.current) inputRef.current.value = "";
        }
      }}
      style={{ display: "flex", flexDirection: "column", gap: 10 }}
    >
      <input type="hidden" name="siteId" value={siteId} />
      <input type="hidden" name="rdoId" value={rdoId} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <input
          ref={inputRef}
          type="file"
          name="photos"
          accept="image/*,video/*"
          capture="environment"
          multiple
          onChange={(e) => handleSelect(e.target.files)}
          style={{
            font: "400 13px var(--font-inter)",
            color: "var(--o-text-2)",
            maxWidth: 320,
          }}
        />
        <button type="submit" disabled={uploading || count === 0} className="btn-brand"
          style={{ padding: "10px 18px", fontSize: 13, opacity: (uploading || count === 0) ? 0.5 : 1, cursor: (uploading || count === 0) ? "not-allowed" : "pointer" }}>
          {uploading ? "Enviando…" : count > 0 ? `Enviar ${count} ${count === 1 ? "arquivo" : "arquivos"}` : "Selecione arquivos"}
        </button>
      </div>

      {previews.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {previews.map((p, i) => (
            <div key={i} title={p.name} style={{
              width: 72, height: 72, borderRadius: 8, overflow: "hidden",
              border: "1px solid var(--o-border)", background: "var(--o-mist)",
              position: "relative",
            }}>
              {p.isVideo ? (
                <video src={p.url} muted playsInline preload="metadata"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={p.url} alt={p.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              )}
              {p.isVideo && (
                <span style={{
                  position: "absolute", inset: 0, display: "grid", placeItems: "center",
                  fontSize: 18, color: "white", textShadow: "0 1px 4px rgba(0,0,0,.6)",
                  pointerEvents: "none",
                }}>▶</span>
              )}
            </div>
          ))}
        </div>
      )}

      <p style={{ margin: 0, fontSize: 11, color: "var(--o-text-3)" }}>
        Fotos e vídeos · até 100MB por arquivo
      </p>
    </form>
  );
}
