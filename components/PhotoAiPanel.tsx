import Link from "next/link";
import { Sparkles } from "lucide-react";
import { analyzePhotos } from "@/lib/ai-photos";

/** Wrapper void pro <form action> (analyzePhotos retorna contagens). */
async function analyzePhotosAction(formData: FormData): Promise<void> {
  "use server";
  await analyzePhotos(formData);
}

/**
 * Controles de IA da galeria de fotos: botão "Analisar fotos com IA" (admin),
 * card de alertas de segurança dos últimos 30 dias e feedback do último lote.
 * Server component — o botão dispara a server action analyzePhotos via form.
 */
export function PhotoAiPanel({
  siteId,
  canEdit,
  pendingCount,
  flaggedPhotoCount,
  flagTotal,
  flagsActive,
  analyzedNotice,
  failedNotice,
  tooLargeNotice,
}: {
  siteId: string;
  canEdit: boolean;
  pendingCount: number;
  flaggedPhotoCount: number;
  flagTotal: number;
  flagsActive: boolean;
  analyzedNotice: number | null;
  failedNotice: number;
  tooLargeNotice: number;
}) {
  const showAnalyze = canEdit && pendingCount > 0;
  const showSafety = flaggedPhotoCount > 0;
  const showNotice = analyzedNotice !== null;
  if (!showAnalyze && !showSafety && !showNotice) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
      {showNotice && (
        <div
          style={{
            fontSize: 12,
            color: "#2e7d32",
            background: "#eef7ee",
            border: "1px solid #cde5cd",
            borderRadius: 6,
            padding: "8px 12px",
          }}
        >
          ✨ {analyzedNotice} foto{analyzedNotice === 1 ? "" : "s"} analisada{analyzedNotice === 1 ? "" : "s"} pela IA.
          {tooLargeNotice > 0 ? ` ${tooLargeNotice} pulada${tooLargeNotice === 1 ? "" : "s"} (imagem muito grande).` : ""}
          {failedNotice > 0 ? ` ${failedNotice} falha${failedNotice === 1 ? "" : "s"} — tente novamente.` : ""}
        </div>
      )}

      {showSafety && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            fontSize: 12,
            color: "#b3261e",
            background: "#fdf1f0",
            border: "1px solid #f3d2cf",
            borderRadius: 6,
            padding: "8px 12px",
          }}
        >
          <span>
            ⚠️ {flagTotal} alerta{flagTotal === 1 ? "" : "s"} de segurança em {flaggedPhotoCount} foto
            {flaggedPhotoCount === 1 ? "" : "s"} nos últimos 30 dias
          </span>
          {flagsActive ? (
            <Link href={`/obras/${siteId}/fotos`} style={{ color: "#b3261e", fontWeight: 600, whiteSpace: "nowrap" }}>
              limpar filtro
            </Link>
          ) : (
            <Link href={`/obras/${siteId}/fotos?flags=1`} style={{ color: "#b3261e", fontWeight: 600, whiteSpace: "nowrap" }}>
              ver →
            </Link>
          )}
        </div>
      )}

      {showAnalyze && (
        <form action={analyzePhotosAction} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input type="hidden" name="siteId" value={siteId} />
          <input type="hidden" name="batch" value="50" />
          <input type="hidden" name="redirectTo" value="fotos" />
          <button className="diario-blue-button" type="submit" title="Gera legenda, etapa e alertas de segurança por IA">
            <Sparkles size={15} />
            Analisar fotos com IA
          </button>
          <span style={{ fontSize: 12, color: "#777" }} className="tnum">
            {pendingCount} pendente{pendingCount === 1 ? "" : "s"} · até 50 por vez
          </span>
        </form>
      )}
    </div>
  );
}
