"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { countPending, syncPendingRdos, RDO_QUEUE_EVENT } from "@/lib/offline/rdo-queue";

type Mode = "hidden" | "offline" | "syncing" | "synced";

/**
 * Pill fixa e discreta no rodapé:
 * - Offline → "📴 Offline — X RDOs na fila"
 * - Voltou online → sincroniza a fila e mostra "✅ Sincronizado" por 3s.
 */
export function OfflineIndicator() {
  const [mode, setMode] = useState<Mode>("hidden");
  const [pending, setPending] = useState(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshCount = useCallback(async () => {
    try {
      setPending(await countPending());
    } catch {
      // IndexedDB indisponível (modo privado antigo etc.) — segue sem contador
    }
  }, []);

  const trySync = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    let count = 0;
    try {
      count = await countPending();
    } catch {
      return;
    }
    if (count === 0) return;

    setMode("syncing");
    const { synced } = await syncPendingRdos();
    await refreshCount();

    if (synced > 0) {
      setMode("synced");
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setMode("hidden"), 3000);
    } else {
      setMode(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "hidden");
    }
  }, [refreshCount]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const goOffline = () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setMode("offline");
      void refreshCount();
    };
    const goOnline = () => {
      setMode("hidden");
      void trySync();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void trySync();
    };
    const onQueueChanged = () => {
      void refreshCount();
    };

    // estado inicial
    if (!navigator.onLine) goOffline();
    else void trySync();

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(RDO_QUEUE_EVENT, onQueueChanged);

    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(RDO_QUEUE_EVENT, onQueueChanged);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [refreshCount, trySync]);

  if (mode === "hidden") return null;

  const label =
    mode === "offline"
      ? pending > 0
        ? `📴 Offline — ${pending} ${pending === 1 ? "RDO na fila" : "RDOs na fila"}`
        : "📴 Offline — RDOs serão salvos no aparelho"
      : mode === "syncing"
        ? "🔄 Sincronizando…"
        : "✅ Sincronizado";

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 16px",
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 500,
        background: mode === "offline" ? "var(--o-dark)" : "var(--o-paper)",
        color: mode === "offline" ? "var(--o-text-on-dark)" : "var(--o-text-1)",
        border: "1px solid var(--o-border)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
        pointerEvents: "none",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </div>
  );
}
