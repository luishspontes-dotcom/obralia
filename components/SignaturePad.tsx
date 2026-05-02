"use client";

import { useEffect, useRef, useState } from "react";
import { saveSignature } from "@/lib/rdo-actions";

export function SignaturePad({ rdoId, siteId, existing }: { rdoId: string; siteId: string; existing?: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fafafa";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#1a202c";
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  function getPos(e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    let cx = 0, cy = 0;
    if ("touches" in e) {
      const t = e.touches[0] ?? e.changedTouches[0];
      if (!t) return null;
      cx = t.clientX; cy = t.clientY;
    } else {
      cx = e.clientX; cy = e.clientY;
    }
    return {
      x: ((cx - rect.left) / rect.width) * canvas.width,
      y: ((cy - rect.top) / rect.height) * canvas.height,
    };
  }

  function start(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    const p = getPos(e);
    const ctx = canvasRef.current?.getContext("2d");
    if (!p || !ctx) return;
    setDrawing(true);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing) return;
    e.preventDefault();
    const p = getPos(e);
    const ctx = canvasRef.current?.getContext("2d");
    if (!p || !ctx) return;
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setHasInk(true);
  }

  function end() {
    setDrawing(false);
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.fillStyle = "#fafafa";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  }

  if (existing) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={existing} alt="Assinatura" style={{
          maxWidth: 400, height: "auto", border: "1px solid var(--o-border)",
          borderRadius: 8, background: "white",
        }} />
        <div style={{ fontSize: 12, color: "var(--o-text-3)" }}>
          Assinatura registrada · clique &ldquo;Re-assinar&rdquo; pra substituir
        </div>
        <button type="button" className="chip" onClick={() => location.reload()} style={{ width: "fit-content" }}>
          Re-assinar
        </button>
      </div>
    );
  }

  return (
    <form
      action={async (fd) => {
        const canvas = canvasRef.current;
        if (!canvas || !hasInk) return;
        setSubmitting(true);
        try {
          fd.set("rdoId", rdoId);
          fd.set("siteId", siteId);
          fd.set("data_url", canvas.toDataURL("image/png"));
          await saveSignature(fd);
        } finally { setSubmitting(false); }
      }}
      style={{ display: "flex", flexDirection: "column", gap: 10 }}
    >
      <canvas
        ref={canvasRef}
        width={500}
        height={180}
        onMouseDown={start}
        onMouseMove={draw}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={draw}
        onTouchEnd={end}
        style={{
          width: "100%",
          maxWidth: 500,
          height: 180,
          border: "1px dashed var(--o-border)",
          borderRadius: 8,
          touchAction: "none",
          background: "#fafafa",
          cursor: "crosshair",
        }}
      />
      <input
        name="signer_name"
        placeholder="Nome de quem está assinando"
        style={{
          maxWidth: 300, padding: "8px 12px",
          border: "1px solid var(--o-border)", borderRadius: 8,
          font: "400 13px var(--font-inter)",
        }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" className="btn-brand" disabled={!hasInk || submitting}
          style={{ padding: "8px 16px", fontSize: 13, opacity: (!hasInk || submitting) ? 0.5 : 1, cursor: (!hasInk || submitting) ? "not-allowed" : "pointer" }}>
          {submitting ? "Salvando…" : "Salvar assinatura"}
        </button>
        <button type="button" onClick={clear} className="chip">Limpar</button>
      </div>
    </form>
  );
}
