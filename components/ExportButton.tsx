"use client";

type Row = Record<string, string | number | null | undefined>;

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function ExportButton({ rows, filename, label }: { rows: Row[]; filename: string; label?: string }) {
  function download() {
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(";"),
      ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(";")),
    ].join("\n");
    // BOM pra Excel reconhecer UTF-8
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button type="button" onClick={download} className="chip" style={{ cursor: "pointer" }}>
      ⬇ {label ?? "Exportar CSV"}
    </button>
  );
}
