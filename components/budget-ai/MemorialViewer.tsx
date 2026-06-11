"use client";

import { useMemo, useState } from "react";
import { Copy, Check, Printer } from "lucide-react";

/**
 * Exibe o memorial descritivo gerado pela IA (markdown simples renderizado)
 * com acoes de copiar e imprimir. O texto cru continua editavel na secao
 * "Editar memorial" logo abaixo (preservada).
 */
export function MemorialViewer({ memorial, title }: { memorial: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const html = useMemo(() => markdownToHtml(memorial), [memorial]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(memorial);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function handlePrint() {
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) return;
    printWindow.document.write(
      [
        "<!DOCTYPE html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\" />",
        `<title>Memorial descritivo - ${escapeHtml(title)}</title>`,
        "<style>",
        "body { font: 13px/1.65 'Helvetica Neue', Arial, sans-serif; color: #1c1c1c; max-width: 760px; margin: 32px auto; padding: 0 24px; }",
        "h1 { font-size: 20px; } h2 { font-size: 16px; margin-top: 22px; } h3 { font-size: 14px; }",
        "ul { padding-left: 20px; } li { margin: 3px 0; }",
        "p { margin: 8px 0; }",
        "@media print { body { margin: 0; } }",
        "</style></head><body>",
        html,
        "</body></html>",
      ].join("")
    );
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          className="chip"
          onClick={handleCopy}
          style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copiado!" : "Copiar"}
        </button>
        <button
          type="button"
          className="chip"
          onClick={handlePrint}
          style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <Printer size={14} /> Imprimir
        </button>
      </div>
      <div
        className="memorial-rendered"
        style={{
          border: "1px solid var(--o-border)",
          borderRadius: 10,
          background: "white",
          padding: "18px 20px",
          maxHeight: 560,
          overflowY: "auto",
          font: "400 13px/1.7 var(--font-inter)",
          color: "var(--o-text-1)",
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInline(value: string): string {
  return escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
}

/**
 * Conversor de markdown simples (titulos, listas, negrito, paragrafos).
 * O HTML e sempre escapado antes das transformacoes - seguro para
 * dangerouslySetInnerHTML.
 */
function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let listOpen = false;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      out.push(`<p>${paragraph.map(renderInline).join("<br />")}</p>`);
      paragraph = [];
    }
  };
  const closeList = () => {
    if (listOpen) {
      out.push("</ul>");
      listOpen = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      closeList();
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      closeList();
      const level = Math.min(4, heading[1].length + 1);
      out.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      continue;
    }

    const bullet = /^[-*]\s+(.*)$/.exec(trimmed);
    if (bullet) {
      flushParagraph();
      if (!listOpen) {
        out.push("<ul>");
        listOpen = true;
      }
      out.push(`<li>${renderInline(bullet[1])}</li>`);
      continue;
    }

    if (/^(---|\*\*\*)$/.test(trimmed)) {
      flushParagraph();
      closeList();
      out.push("<hr />");
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph();
  closeList();
  return out.join("\n");
}
