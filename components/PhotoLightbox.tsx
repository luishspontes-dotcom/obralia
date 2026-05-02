"use client";

import { useState, useEffect, useCallback } from "react";
import { mediaUrl } from "@/lib/storage";

type Photo = {
  id: string;
  storage_path: string | null;
  thumbnail_path: string | null;
  caption: string | null;
};

export function PhotoGrid({ photos }: { photos: Photo[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

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
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
        gap: 6,
      }}>
        {photos.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setOpenIdx(i)}
            style={{
              padding: 0,
              border: 0,
              cursor: "pointer",
              aspectRatio: "1 / 1",
              background: "var(--o-border)",
              borderRadius: 6,
              overflow: "hidden",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mediaUrl(p.thumbnail_path ?? p.storage_path)}
              alt={p.caption ?? "Foto"}
              loading="lazy"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          </button>
        ))}
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
              style={{ maxWidth: "94vw", maxHeight: "84vh", objectFit: "contain" }}
            />
            <div style={{
              color: "rgba(255,255,255,0.85)",
              fontSize: 13,
              marginTop: 12,
            }}>
              {current.caption ?? ""} {photos.length > 1 && (
                <span style={{ color: "rgba(255,255,255,0.5)", marginLeft: 12 }} className="tnum">
                  {(openIdx ?? 0) + 1} / {photos.length}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
