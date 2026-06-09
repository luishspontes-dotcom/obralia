"use client";

/**
 * Botão de impressão da medição. Embute o CSS de @media print que isola
 * a área #medicao-print (cabeçalho + tabela de itens) e esconde o resto do app.
 */
export function MedicaoPrintButton() {
  return (
    <>
      <button type="button" className="chip" style={{ cursor: "pointer" }} onClick={() => window.print()}>
        ⎙ Imprimir
      </button>
      <style>{`
        .medicao-print-only { display: none; }
        @media print {
          .medicao-print-only { display: block !important; }
          body * { visibility: hidden !important; }
          #medicao-print, #medicao-print * { visibility: visible !important; }
          #medicao-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0;
            margin: 0;
          }
          #medicao-print .no-print { display: none !important; }
          #medicao-print .card,
          #medicao-print table {
            box-shadow: none !important;
            border-color: #ccc !important;
          }
          @page { margin: 14mm; }
        }
      `}</style>
    </>
  );
}
