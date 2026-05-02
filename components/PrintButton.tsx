"use client";

export function PrintButton({ label = "Imprimir / Salvar PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="pr-btn pr-btn-primary"
    >
      {label}
    </button>
  );
}
