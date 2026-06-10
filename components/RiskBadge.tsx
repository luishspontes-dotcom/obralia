import type { CSSProperties } from "react";

/**
 * Classificação visual do risco de atraso (score 0-100 calculado em lib/risk.ts).
 * <30 verde "No prumo" · 30-60 amarelo "Atenção" · >60 vermelho "Risco alto".
 */

export type RiskTone = "green" | "yellow" | "red" | "gray";

export type RiskLevelInfo = { label: string; tone: RiskTone; color: string };

export function riskLevel(score: number | null | undefined): RiskLevelInfo {
  if (score == null) return { label: "Sem dados", tone: "gray", color: "#9e9e9e" };
  if (score > 60) return { label: "Risco alto", tone: "red", color: "#e53935" };
  if (score >= 30) return { label: "Atenção", tone: "yellow", color: "#f0a213" };
  return { label: "No prumo", tone: "green", color: "#39b54a" };
}

export function RiskBadge({
  score,
  showScore = false,
  style,
}: {
  score: number | null | undefined;
  showScore?: boolean;
  style?: CSSProperties;
}) {
  const level = riskLevel(score);
  return (
    <span
      className="diario-status-badge"
      style={{ background: level.color, ...style }}
      title={score != null ? `Score de risco: ${Math.round(score)}/100` : "Risco ainda não calculado"}
    >
      {level.label}
      {showScore && score != null ? ` · ${Math.round(score)}` : ""}
    </span>
  );
}
