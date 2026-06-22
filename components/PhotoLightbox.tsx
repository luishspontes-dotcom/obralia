"use client";

import { useState, useEffect, useCallback } from "react";
import { mediaUrl, thumbUrl } from "@/lib/storage";
import { stageLabel, flagLabel, normalizeAiFlags } from "@/lib/ai-photo-meta";

type Photo = {
  id: string;
  storage_path: string | null;
  thumbnail_path: string | null;
  caption: string | null;
  /** Campos opcionais da análise por IA (galeria envia, RDO pode omitir) */
  ai_caption?: string | null;
  ai_stage?: string | null;
  ai_flags?: unknown;
};

export function PhotoGrid({
  photos,
  variant = "grid",
}: {
  photos: Photo[];
  variant?: "grid" | "strip";
}) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const strip = variant === "strip";

  const close = useCallback(() => setOpenIdx(null), []);
  const next = useCallback(() => {
    setOpenIdx((i) => (i === null ? null : (i + 1) % photos.length));
  }, [photos.length]);
  const prev = useCallback(() => {
    setOpenIdx((i) => (i === null ? null : (i - 1 + photos.length) % photos.length));
  }, [photos.length]);

  useEffect(() => {
    if (openIdx === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [openIdx, close, next, prev]);

  const current = openIdx !== null ? photos[openIdx] : null;

  return (
    <>
      <div style={{
        ...(strip
          ? {}
          : {
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: 6,
            }),
      }} className={strip ? "diario-photo-strip" : "photo-grid"}>
        {photos.map((p, i) => {
          const flags = normalizeAiFlags(p.ai_flags);
          const stage = stageLabel(p.ai_stage);
          const title = p.ai_caption ?? p.caption ?? undefined;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setOpenIdx(i)}
              title={title}
              style={{
                position: "relative",
                padding: 0,
                border: 0,
                cursor: "pointer",
                aspectRatio: strip ? undefined : "1 / 1",
                background: "var(--o-border)",
                borderRadius: strip ? 0 : 6,
                overflow: "hidden",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumbUrl(p.thumbnail_path ?? p.storage_path, 400)}
                alt={title ?? "Foto"}
                loading="lazy"
                decoding="async"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                  aspectRatio: strip ? undefined : "1 / 1",
                }}
              />
              {stage && (
                <span
                  style={{
                    position: "absolute",
                    left: 4,
                    bottom: 4,
                    fontSize: 10,
                    lineHeight: "14px",
                    padding: "1px 6px",
                    borderRadius: 999,
                    background: "rgba(0,0,0,0.62)",
                    color: "rgba(255,255,255,0.92)",
                    maxWidth: "calc(100% - 8px)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {stage}
                </span>
              )}
              {flags.length > 0 && (
                <span
                  title={`Alertas: ${flags.map(flagLabel).join(", ")}`}
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 4,
                    fontSize: 11,
                    lineHeight: "16px",
                    padding: "0 5px",
                    borderRadius: 999,
                    background: "rgba(179,38,30,0.92)",
                    color: "white",
                  }}
                >
                  ⚠️{flags.length > 1 ? ` ${flags.length}` : ""}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {current && (
        <div
          onClick={close}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.92)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); close(); }}
            aria-label="Fechar"
            style={{
              position: "absolute",
              top: 16,
              right: 20,
              background: "rgba(255,255,255,0.1)",
              color: "white",
              border: 0,
              width: 44,
              height: 44,
              borderRadius: 999,
              fontSize: 22,
              cursor: "pointer",
            }}
          >×</button>
          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); prev(); }}
                aria-label="Anterior"
                style={{
                  position: "absolute",
                  left: 20,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "rgba(255,255,255,0.1)",
                  color: "white",
                  border: 0,
                  width: 44,
                  height: 44,
                  borderRadius: 999,
                  fontSize: 22,
                  cursor: "pointer",
                }}
              >‹</button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); next(); }}
                aria-label="Próxima"
                style={{
                  position: "absolute",
                  right: 20,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "rgba(255,255,255,0.1)",
                  color: "white",
                  border: 0,
                  width: 44,
                  height: 44,
                  borderRadius: 999,
                  fontSize: 22,
                  cursor: "pointer",
                }}
              >›</button>
            </>
          )}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "94vw",
              maxHeight: "92vh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mediaUrl(current.storage_path ?? current.thumbnail_path)}
              alt={current.caption ?? "Foto"}
              decoding="async"
              style={{ maxWidth: "94vw", maxHeight: "84vh", objectFit: "contain" }}
            />
            <div style={{
              color: "rgba(255,255,255,0.85)",
              fontSize: 13,
              marginTop: 12,
              textAlign: "center",
            }}>
              {current.caption ?? ""} {photos.length > 1 && (
                <span style={{ color: "rgba(255,255,255,0.5)", marginLeft: 12 }} className="tnum">
                  {(openIdx ?? 0) + 1} / {photos.length}
                </span>
              )}
              {(current.ai_caption || current.ai_stage || normalizeAiFlags(current.ai_flags).length > 0) && (
                <div style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
                  {current.ai_caption && current.ai_caption !== current.caption && (
                    <span style={{ fontStyle: "italic" }}>✨ {current.ai_caption}</span>
                  )}
                  {stageLabel(current.ai_stage) && (
                    <span style={{
                      marginLeft: 8,
                      padding: "1px 7px",
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.14)",
                      fontSize: 11,
                    }}>
                      {stageLabel(current.ai_stage)}
                    </span>
                  )}
                  {normalizeAiFlags(current.ai_flags).length > 0 && (
                    <span style={{ marginLeft: 8, color: "#ff8a80" }}>
                      ⚠️ {normalizeAiFlags(current.ai_flags).map(flagLabel).join(" · ")}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
