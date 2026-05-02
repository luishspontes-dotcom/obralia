"use client";

import { useRef, useState } from "react";
import { uploadPhotos } from "@/lib/rdo-actions";

export function PhotoUploader({ siteId, rdoId }: { siteId: string; rdoId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [count, setCount] = useState(0);

  return (
    <form
      action={async (fd) => {
        setUploading(true);
        try { await uploadPhotos(fd); }
        finally { setUploading(false); setCount(0); if (inputRef.current) inputRef.current.value = ""; }
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
