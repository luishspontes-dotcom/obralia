"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Acompanha o processamento assíncrono do estudo (Orçamento IA).
 *
 * - status 'processing': dispara UMA chamada POST /api/budget-ai/process
 *   (com a sessão do usuário) e faz polling do status a cada 5s via
 *   router.refresh(), mostrando o aviso com spinner.
 * - status 'failed': mostra a mensagem de erro e o botão "Tentar de novo",
 *   que refaz a chamada (a rota rearma o status pra 'processing').
 */
export function EstimateProcessingWatcher({
  estimateId,
  status,
  errorMessage,
}: {
  estimateId: string;
  status: string;
  errorMessage: string | null;
}) {
  const router = useRouter();
  const prevStatusRef = useRef<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  const isProcessing = status === "processing";
  const isFailed = status === "failed";
  const showSpinner = isProcessing || retrying;

  const triggerProcessing = useCallback(() => {
    void fetch("/api/budget-ai/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ estimateId }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as
            | { message?: unknown }
            | null;
          const message =
            payload && typeof payload.message === "string"
              ? payload.message
              : `Falha no processamento (HTTP ${response.status}).`;
          setRetryError(message);
        }
      })
      .catch(() => {
        setRetryError("Não foi possível falar com o servidor. Verifique a conexão e tente de novo.");
      })
      .finally(() => {
        setRetrying(false);
        router.refresh();
      });
  }, [estimateId, router]);

  // Dispara UMA vez por transição para 'processing' (inclui o primeiro mount
  // logo após a criação do estudo e o rearme do botão "Reprocessar").
  useEffect(() => {
    const previous = prevStatusRef.current;
    prevStatusRef.current = status;
    if (status !== "processing" || previous === "processing") return;
    setRetryError(null);
    triggerProcessing();
  }, [status, triggerProcessing]);

  // Polling do status a cada 5s enquanto processa.
  useEffect(() => {
    if (!showSpinner) return;
    const interval = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(interval);
  }, [showSpinner, router]);

  if (showSpinner) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          border: "1px solid var(--o-border)",
          background: "var(--t-brand-mist)",
          borderRadius: 12,
          padding: "16px 18px",
          marginBottom: 18,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 22,
            height: 22,
            flex: "0 0 auto",
            borderRadius: "50%",
            border: "3px solid var(--t-brand)",
            borderTopColor: "transparent",
            animation: "obralia-spin 0.9s linear infinite",
          }}
        />
        <div>
          <strong style={{ display: "block", color: "var(--t-brand)", fontSize: 14 }}>
            🤖 Lendo a planta... isso leva 1 a 3 minutos
          </strong>
          <span style={{ color: "var(--o-text-2)", fontSize: 12 }}>
            Pode continuar navegando; esta página atualiza sozinha quando o orçamento ficar pronto.
          </span>
        </div>
        <style>{"@keyframes obralia-spin { to { transform: rotate(360deg); } }"}</style>
      </div>
    );
  }

  if (isFailed) {
    return (
      <div
        role="alert"
        style={{
          border: "1px solid rgba(180,61,61,.35)",
          background: "rgba(180,61,61,.08)",
          borderRadius: 12,
          padding: "16px 18px",
          marginBottom: 18,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0, flex: "1 1 320px" }}>
          <strong style={{ display: "block", color: "var(--st-late)", fontSize: 14 }}>
            A leitura da planta falhou
          </strong>
          <span style={{ color: "var(--o-text-2)", fontSize: 12 }}>
            {retryError ?? errorMessage ?? "Erro inesperado ao processar o estudo."}
          </span>
        </div>
        <button
          type="button"
          className="btn-brand"
          onClick={() => {
            // Marca como 'processing' localmente e refaz a chamada; a rota
            // rearma o status no banco antes de rodar a análise de novo.
            prevStatusRef.current = "processing";
            setRetryError(null);
            setRetrying(true);
            triggerProcessing();
          }}
          style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
        >
          Tentar de novo
        </button>
      </div>
    );
  }

  return null;
}
