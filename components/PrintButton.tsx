"use client";

export function PrintButton({
  label = "Imprimir / Salvar PDF",
  className = "pr-btn pr-btn-primary",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={className}
    >
      {label}
    </button>
  );
}
