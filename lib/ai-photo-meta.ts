/**
 * Vocabulário compartilhado da análise de fotos por IA (etapas e alertas).
 * Módulo neutro (sem "use server"/"use client") para poder ser importado
 * tanto por server actions quanto por componentes de cliente.
 */

export const AI_STAGES = [
  "fundacao",
  "estrutura",
  "alvenaria",
  "instalacoes",
  "reboco",
  "contrapiso",
  "revestimento",
  "esquadrias",
  "pintura",
  "acabamento",
  "cobertura",
  "terraplenagem",
  "area_externa",
  "outro",
] as const;

export type AiStage = (typeof AI_STAGES)[number];

export const AI_STAGE_LABELS: Record<AiStage, string> = {
  fundacao: "Fundação",
  estrutura: "Estrutura",
  alvenaria: "Alvenaria",
  instalacoes: "Instalações",
  reboco: "Reboco",
  contrapiso: "Contrapiso",
  revestimento: "Revestimento",
  esquadrias: "Esquadrias",
  pintura: "Pintura",
  acabamento: "Acabamento",
  cobertura: "Cobertura",
  terraplenagem: "Terraplenagem",
  area_externa: "Área externa",
  outro: "Outro",
};

export function isAiStage(value: string): value is AiStage {
  return (AI_STAGES as readonly string[]).includes(value);
}

export function stageLabel(stage: string | null | undefined): string | null {
  if (!stage) return null;
  return isAiStage(stage) ? AI_STAGE_LABELS[stage] : stage;
}

export const AI_FLAGS = [
  "sem_epi",
  "capacete_ausente",
  "andaime_irregular",
  "fiacao_exposta",
  "area_desorganizada",
  "risco_queda",
] as const;

export type AiFlag = (typeof AI_FLAGS)[number];

export const AI_FLAG_LABELS: Record<AiFlag, string> = {
  sem_epi: "Sem EPI",
  capacete_ausente: "Capacete ausente",
  andaime_irregular: "Andaime irregular",
  fiacao_exposta: "Fiação exposta",
  area_desorganizada: "Área desorganizada",
  risco_queda: "Risco de queda",
};

export function isAiFlag(value: string): value is AiFlag {
  return (AI_FLAGS as readonly string[]).includes(value);
}

export function flagLabel(flag: string): string {
  return isAiFlag(flag) ? AI_FLAG_LABELS[flag] : flag;
}

/** Normaliza o jsonb ai_flags vindo do banco em um array seguro de strings. */
export function normalizeAiFlags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((f): f is string => typeof f === "string");
}
