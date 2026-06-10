export const DIARIO_SOURCE_PROVIDER = "diario_de_obra";
export const OBRALIA_SOURCE_PROVIDER = "obralia";

export const VISIBLE_SOURCE_PROVIDERS = [
  DIARIO_SOURCE_PROVIDER,
  OBRALIA_SOURCE_PROVIDER,
];

/**
 * Escopo para wbs_items (tarefas/EAP): inclui também o legado do ClickUp
 * (external_provider = 'import'), que pertence às obras deduplicadas mas
 * tem procedência própria. Sem isso, as 1.300+ atividades importadas
 * (326 em andamento) somem dos contadores, de /tarefas e do cálculo de risco.
 */
export const WBS_SOURCE_PROVIDERS = [
  DIARIO_SOURCE_PROVIDER,
  OBRALIA_SOURCE_PROVIDER,
  "import",
];
