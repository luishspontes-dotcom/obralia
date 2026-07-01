import type { UntypedSupabase } from "@/lib/supabase/untyped";

/**
 * Taxonomia oficial das ETAPAS-mae dos orcamentos historicos da Meu Viver
 * (extraida da PLANILHA ORCAMENTARIA FER E MACIEL, numeracao 1..40).
 * A IA deve classificar todo item de orcamento dentro destas etapas.
 */
export const HISTORICAL_ETAPAS: ReadonlyArray<{ numero: number; nome: string }> = [
  { numero: 1, nome: "Comissões de Venda" },
  { numero: 2, nome: "INSS" },
  { numero: 3, nome: "Serviços PJ Engenharia" },
  { numero: 4, nome: "Taxas" },
  { numero: 5, nome: "Seguro de Vida" },
  { numero: 6, nome: "Projetos Estruturais/ Arquitetônicos" },
  { numero: 7, nome: "Taxas do CREA" },
  { numero: 8, nome: "MÃO DE OBRA CIVIL" },
  { numero: 9, nome: "HIDRÁULICA - M. D.O" },
  { numero: 10, nome: "ELÉTRICA - M. D. O" },
  { numero: 11, nome: "REVESTIMENTO CERÂMICO - M. D. O" },
  { numero: 12, nome: "PORTAS INTERNAS - M. D. O" },
  { numero: 13, nome: "PINTURA - M. D. O" },
  { numero: 14, nome: "EPI's e Uniformes - Funcionários" },
  { numero: 15, nome: "Eventos de Marketing/ Promoção de Imagem" },
  { numero: 16, nome: "SERVIÇOS INICIAIS" },
  { numero: 17, nome: "MANUTENÇÃO DE OBRA" },
  { numero: 18, nome: "Locações de Máquinas e Equipamentos" },
  { numero: 19, nome: "Despesa com Frete/ Despesa com Transporte" },
  { numero: 20, nome: "FUNDAÇÃO SERVIÇOS PERFURAÇÃO" },
  { numero: 21, nome: "ESTRUTURA - MATERIAL" },
  { numero: 22, nome: "LAJE - MATERIAL" },
  { numero: 23, nome: "ALVENARIA - MATERIAL" },
  { numero: 24, nome: "REBOCO INTERNO/ EXTERNO MATERIAL" },
  { numero: 25, nome: "CONTRA PISO - MATERIAL" },
  { numero: 26, nome: "CALHAS E RUFOS" },
  { numero: 27, nome: "COBERTURA - MATERIAL" },
  { numero: 28, nome: "ESQUADRIAS - MATERIAL E M.D. O" },
  { numero: 29, nome: "PORTAS INTERNAS - MATERIAL" },
  { numero: 30, nome: "MÁRMORE - MATERIAL E M.D.O" },
  { numero: 31, nome: "REVESTIMENTO CERÂMICO - MATERIAL" },
  { numero: 32, nome: "GESSO" },
  { numero: 33, nome: "PINTURA - MATERIAL" },
  { numero: 34, nome: "ELÉTRICA - MATERIAL" },
  { numero: 35, nome: "HIDRÁULICA - MATERIAL" },
  { numero: 36, nome: "PISCINAS - MATERIAL E M.D.O" },
  { numero: 37, nome: "PAVER" },
  { numero: 38, nome: "MAQUINAS E EQUIPAMENTOS" },
  { numero: 39, nome: "MÃO DE OBRA EXTRA" },
  { numero: 40, nome: "SERVIÇOS COMPLEMENTARES" },
];

export type HistoricalPriceIndex = {
  /** etapa normalizada -> R$/m2 mediano observado no historico */
  costPerM2ByEtapa: Map<string, number>;
  /** quantas amostras (obras/templates) sustentam cada mediana */
  sampleCountByEtapa: Map<string, number>;
  sources: string[];
};

type TemplateRow = {
  id: string;
  name: string;
  base_area_m2: unknown;
};

type TemplateItemRow = {
  template_id: string;
  group_name: string;
  unit_cost: unknown;
  default_quantity: unknown;
};

type EstimateRefRow = {
  id: string;
  built_area_m2: unknown;
};

type EstimateItemRow = {
  estimate_id: string;
  group_name: string;
  total: unknown;
};

/**
 * Monta um indice {etapa -> R$/m2 mediano} a partir do historico real:
 * 1. templates de orcamento (budget_template_items, normalizados pela base_area_m2);
 * 2. orcamentos IA ja aprovados da organizacao (ai_estimate_items / ai_estimates).
 * Nenhum preco e inventado: etapas sem amostra ficam fora do indice.
 */
export async function buildHistoricalPriceIndex(
  db: UntypedSupabase,
  organizationId: string
): Promise<HistoricalPriceIndex> {
  const samplesByEtapa = new Map<string, number[]>();
  const sources: string[] = [];

  // Fonte 1: templates historicos (planilha FER E MACIEL importada como template).
  const { data: templatesRaw } = await db
    .from("budget_templates")
    .select("id, name, base_area_m2")
    .or(`organization_id.eq.${organizationId},organization_id.is.null`);
  const templates = ((templatesRaw ?? []) as TemplateRow[]).filter(
    (template) => toNumber(template.base_area_m2) > 0
  );

  if (templates.length > 0) {
    const { data: templateItemsRaw } = await db
      .from("budget_template_items")
      .select("template_id, group_name, unit_cost, default_quantity")
      .in("template_id", templates.map((template) => template.id));
    const templateItems = (templateItemsRaw ?? []) as TemplateItemRow[];

    for (const template of templates) {
      const area = toNumber(template.base_area_m2);
      if (area <= 0) continue;
      const totals = new Map<string, number>();
      for (const item of templateItems) {
        if (item.template_id !== template.id) continue;
        const total = toNumber(item.unit_cost) * toNumber(item.default_quantity);
        if (total <= 0) continue;
        const key = normalizeEtapaName(item.group_name);
        totals.set(key, (totals.get(key) ?? 0) + total);
      }
      for (const [etapa, total] of totals.entries()) {
        pushSample(samplesByEtapa, etapa, total / area);
      }
      if (totals.size > 0) sources.push(`template:${template.name}`);
    }
  }

  // Fonte 2: orcamentos IA aprovados da organizacao (historico vivo do dono).
  const { data: approvedRaw } = await db
    .from("ai_estimates")
    .select("id, built_area_m2")
    .eq("organization_id", organizationId)
    .eq("status", "approved");
  const approved = ((approvedRaw ?? []) as EstimateRefRow[]).filter(
    (estimate) => toNumber(estimate.built_area_m2) > 0
  );

  if (approved.length > 0) {
    const { data: estimateItemsRaw } = await db
      .from("ai_estimate_items")
      .select("estimate_id, group_name, total")
      .in("estimate_id", approved.map((estimate) => estimate.id));
    const estimateItems = (estimateItemsRaw ?? []) as EstimateItemRow[];

    for (const estimate of approved) {
      const area = toNumber(estimate.built_area_m2);
      const totals = new Map<string, number>();
      for (const item of estimateItems) {
        if (item.estimate_id !== estimate.id) continue;
        const total = toNumber(item.total);
        if (total <= 0) continue;
        const key = normalizeEtapaName(item.group_name);
        totals.set(key, (totals.get(key) ?? 0) + total);
      }
      for (const [etapa, total] of totals.entries()) {
        pushSample(samplesByEtapa, etapa, total / area);
      }
      if (totals.size > 0) sources.push(`orcamento_aprovado:${estimate.id}`);
    }
  }

  const costPerM2ByEtapa = new Map<string, number>();
  const sampleCountByEtapa = new Map<string, number>();
  for (const [etapa, samples] of samplesByEtapa.entries()) {
    costPerM2ByEtapa.set(etapa, median(samples));
    sampleCountByEtapa.set(etapa, samples.length);
  }

  // Fonte 0 (prioritaria): taxas curadas e editaveis (budget_rates), semeadas
  // da planilha da Meu Viver e recalibraveis pela tela de gestao. Sao a fonte
  // de verdade e SOBREPOEM as medianas calculadas acima.
  const { data: ratesRaw } = await db
    .from("budget_rates")
    .select("etapa_nome, cost_per_m2, sample_count")
    .eq("organization_id", organizationId);
  const rates = (ratesRaw ?? []) as Array<{
    etapa_nome: string;
    cost_per_m2: unknown;
    sample_count: unknown;
  }>;
  for (const rate of rates) {
    const cost = toNumber(rate.cost_per_m2);
    if (cost <= 0) continue;
    const key = normalizeEtapaName(rate.etapa_nome);
    costPerM2ByEtapa.set(key, cost);
    sampleCountByEtapa.set(
      key,
      Math.max(sampleCountByEtapa.get(key) ?? 0, toNumber(rate.sample_count) || 1)
    );
  }
  if (rates.length > 0) sources.unshift("taxas_editaveis:budget_rates");

  return { costPerM2ByEtapa, sampleCountByEtapa, sources };
}

export function etapaCostPerM2(index: HistoricalPriceIndex, etapaNome: string): number | null {
  const direct = index.costPerM2ByEtapa.get(normalizeEtapaName(etapaNome));
  if (typeof direct === "number" && Number.isFinite(direct) && direct > 0) return direct;
  return null;
}

export function etapaSampleCount(index: HistoricalPriceIndex, etapaNome: string): number {
  return index.sampleCountByEtapa.get(normalizeEtapaName(etapaNome)) ?? 0;
}

/**
 * Normaliza nomes de etapa para casar variantes de acentuacao, caixa,
 * pontuacao e espacamento (ex.: "HIDRAULICA - M. D.O" ~ "Hidráulica MDO").
 * A chave final remove TODOS os separadores: e usada apenas em memoria
 * (indice e lookup usam a mesma funcao), nunca persistida.
 */
export function normalizeEtapaName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
}

export function findHistoricalEtapa(nome: string): { numero: number; nome: string } | null {
  const normalized = normalizeEtapaName(nome);
  for (const etapa of HISTORICAL_ETAPAS) {
    if (normalizeEtapaName(etapa.nome) === normalized) return etapa;
  }
  return null;
}

function pushSample(map: Map<string, number[]>, key: string, value: number) {
  if (!Number.isFinite(value) || value <= 0) return;
  const list = map.get(key) ?? [];
  list.push(value);
  map.set(key, list);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}
