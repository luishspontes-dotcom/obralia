"use client";

import { useRef, useState } from "react";
import { uploadPhotos } from "@/lib/rdo-actions";

/**
 * Tenta extrair GPS + taken_at via window.exifr (carregado dinamicamente).
 * Falha silenciosamente em arquivos sem EXIF (vídeos, screenshots).
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

export function PhotoUploader({ siteId, rdoId }: { siteId: string; rdoId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [count, setCount] = useState(0);

  return (
    <form
      action={async (fd) => {
        setUploading(true);
        try {
          // Para cada arquivo, tenta extrair EXIF e adiciona ao FormData como meta_<idx>
          const files = fd.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
          const metas: Array<Record<string, unknown>> = [];
          for (const f of files) metas.push((await readExifSafe(f)) ?? {});
          fd.set("photo_meta_json", JSON.stringify(metas));
          await uploadPhotos(fd);
        } finally {
          setUploading(false); setCount(0);
          if (inputRef.current) inputRef.current.value = "";
        }
      }}
      style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}
    >
      <input type="hidden" name="siteId" value={siteId} />
      <input type="hidden" name="rdoId" value={rdoId} />
      <input
        ref={inputRef}
        type="file"
        name="photos"
        accept="image/*,video/*"
        capture="environment"
        multiple
        onChange={(e) => setCount(e.target.files?.length ?? 0)}
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
    </form>
  );
}
