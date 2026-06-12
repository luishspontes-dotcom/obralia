/**
 * Limites operacionais da leitura visual de plantas (Orçamento IA).
 * Mantido num módulo isolado (sem dependências de servidor) para que
 * o client component do formulário possa validar antes do upload.
 */

export const MAX_PLAN_TOTAL_BYTES = 20 * 1024 * 1024; // 20MB somando todas as plantas
export const MAX_PLAN_PAGES = 80; // ~80 páginas por PDF de planta

export const PLAN_LIMIT_MESSAGE =
  "A planta é muito grande para a leitura automática (limite: ~80 páginas ou 20MB no total). " +
  "Divida o PDF em partes menores ou envie apenas as pranchas principais e tente de novo.";
