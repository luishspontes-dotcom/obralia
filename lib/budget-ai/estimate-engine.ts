import type { PlanAnalysis, PlanEtapa } from "@/lib/budget-ai/plan-analysis";
import {
  etapaCostPerM2,
  etapaSampleCount,
  type HistoricalPriceIndex,
} from "@/lib/budget-ai/historical-prices";

export type EstimateInput = {
  title: string;
  clientName: string | null;
  address: string | null;
  builtAreaM2: number | null;
  poolAreaM2: number | null;
  terrainAreaM2: number | null;
  floorsCount: number | null;
  hasBasement: boolean;
  qualityStandard: string;
  fileNames: string[];
  planAnalysis?: PlanAnalysis | null;
};

export type BudgetTemplateItem = {
  id: string;
  code: string | null;
  group_name: string;
  description: string;
  unit: string;
  unit_cost: number;
  default_quantity: number | null;
  quantity_rule: Record<string, unknown> | null;
  confidence_baseline: number;
  needs_review_default: boolean;
  source_notes: string | null;
  sort_order: number;
};

export type GeneratedFact = {
  fact_key: string;
  label: string;
  value_text: string | null;
  value_numeric: number | null;
  unit: string | null;
  confidence: number;
  source: string;
  needs_review: boolean;
  metadata?: Record<string, unknown>;
};

export type GeneratedItem = {
  template_item_id: string | null;
  code: string | null;
  group_name: string;
  description: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  total: number;
  confidence: number;
  source: string;
  needs_review: boolean;
  sort_order: number;
  metadata: Record<string, unknown>;
};

export type GeneratedEstimate = {
  facts: GeneratedFact[];
  items: GeneratedItem[];
  subtotal: number;
  total: number;
  confidenceScore: number;
  sourceSummary: Record<string, unknown>;
  memorialText: string;
};

type QuantityResolution = {
  quantity: number;
  source: "usuario" | "planta_ia" | "planta_ia_parametrica" | "template_parametrico";
  basis: string;
  baseValue: number;
  measurementKey: string | null;
};

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const NUMBER = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
});

export function generateEstimateFromTemplate(
  input: EstimateInput,
  templateItems: BudgetTemplateItem[]
): GeneratedEstimate {
  const planAnalysis = input.planAnalysis ?? null;
  const builtArea = firstNumber(
    input.builtAreaM2,
    planAnalysis?.builtAreaM2,
    planAnalysis?.measurements.built_area_m2,
    424.56
  );
  const poolArea = firstNumber(
    input.poolAreaM2,
    planAnalysis?.poolAreaM2,
    planAnalysis?.measurements.pool_area_m2,
    0
  );
  const facts = buildFacts(input, builtArea, poolArea);

  const items = templateItems.map((item) => {
    const resolution = resolveQuantity(item, input, builtArea, poolArea);
    const total = roundMoney(resolution.quantity * Number(item.unit_cost ?? 0));
    const confidence = clampConfidence(
      Number(item.confidence_baseline ?? 0.55) +
        sourceConfidenceBonus(resolution.source, planAnalysis) +
        (item.needs_review_default ? -0.06 : 0.04)
    );
    const needsReview =
      item.needs_review_default ||
      confidence < 0.72 ||
      (resolution.source === "template_parametrico" && item.unit.toUpperCase() === "VB");

    return {
      template_item_id: item.id,
      code: item.code,
      group_name: item.group_name,
      description: item.description,
      quantity: resolution.quantity,
      unit: item.unit,
      unit_cost: Number(item.unit_cost ?? 0),
      total,
      confidence,
      source: resolution.source,
      needs_review: needsReview,
      sort_order: item.sort_order,
      metadata: {
        quantity_rule: item.quantity_rule ?? {},
        default_quantity: item.default_quantity,
        basis: resolution.basis,
        base_value: resolution.baseValue,
        measurement_key: resolution.measurementKey,
        source_notes: item.source_notes,
      },
    };
  });

  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.total, 0));
  const total = subtotal;
  const confidenceScore = weightedConfidence(items, facts);
  const sourceSummary = {
    mode: planAnalysis?.status === "analyzed"
      ? "planta_ia_com_template_detalhado"
      : "template_detalhado_sem_leitura_visual",
    template: "Meu Viver - planilha FER E MACIEL completa",
    generated_at: new Date().toISOString(),
    file_names: input.fileNames,
    plan_analysis: planAnalysis,
    warning:
      planAnalysis?.status === "analyzed"
        ? "Pre-orcamento automatico gerado a partir da planta e template detalhado. Itens sinalizados devem ser revisados antes de proposta final."
        : "Pre-orcamento automatico com leitura visual pendente. Configure a IA visual para reduzir premissas parametrizadas.",
  };

  return {
    facts,
    items,
    subtotal,
    total,
    confidenceScore,
    sourceSummary,
    memorialText: buildMemorial(input, builtArea, poolArea, subtotal),
  };
}

/**
 * Gera o orcamento a partir das ETAPAS lidas pela Claude na planta,
 * no formato exato das planilhas historicas (numero, descricao, qtde,
 * unidade, custo unit, custo total). Precos NUNCA sao inventados:
 * vem do indice historico {etapa -> R$/m2 mediano} aplicado a area total.
 * Itens de etapas sem referencia historica ficam com custo 0 e flag
 * "definir preço" (metadata.definir_preco = true).
 */
export function generateEstimateFromEtapas(
  input: EstimateInput,
  etapas: PlanEtapa[],
  priceIndex: HistoricalPriceIndex
): GeneratedEstimate {
  const planAnalysis = input.planAnalysis ?? null;
  const builtArea = firstNumber(
    input.builtAreaM2,
    planAnalysis?.areaTotalM2,
    planAnalysis?.builtAreaM2,
    planAnalysis?.measurements.built_area_m2,
    0
  );
  const poolArea = firstNumber(
    input.poolAreaM2,
    planAnalysis?.poolAreaM2,
    planAnalysis?.measurements.pool_area_m2,
    0
  );
  const facts = buildFacts(input, builtArea, poolArea);
  const items: GeneratedItem[] = [];
  let sortOrder = 10;

  for (const etapa of etapas) {
    const groupName = `${etapa.numero}. ${etapa.nome}`;
    const costPerM2 = etapaCostPerM2(priceIndex, etapa.nome);
    const sampleCount = etapaSampleCount(priceIndex, etapa.nome);
    const etapaBudget = costPerM2 !== null && builtArea > 0 ? costPerM2 * builtArea : null;
    const itemCount = etapa.itens.length;

    for (const [index, etapaItem] of etapa.itens.entries()) {
      const quantity = roundQuantity(
        etapaItem.qtdeEstimada !== null && etapaItem.qtdeEstimada > 0 ? etapaItem.qtdeEstimada : 1,
        etapaItem.unidade
      );
      const hasHistoricalPrice = etapaBudget !== null && itemCount > 0;
      const itemBudget = hasHistoricalPrice ? etapaBudget / itemCount : 0;
      const unitCost = hasHistoricalPrice && quantity > 0 ? roundMoney(itemBudget / quantity) : 0;
      const total = roundMoney(quantity * unitCost);
      const confidence = clampConfidence(
        hasHistoricalPrice
          ? 0.5 + 0.03 * Math.min(3, sampleCount) + 0.2 * (planAnalysis?.confidence ?? 0.65)
          : 0.4
      );

      items.push({
        template_item_id: null,
        code: `${etapa.numero}.${index + 1}`,
        group_name: groupName,
        description: etapaItem.descricao,
        quantity,
        unit: etapaItem.unidade || "VB",
        unit_cost: unitCost,
        total,
        confidence,
        source: "planta_ia",
        needs_review: true,
        sort_order: sortOrder,
        metadata: {
          etapa_numero: etapa.numero,
          etapa_nome: etapa.nome,
          qtde_estimada_planta: etapaItem.qtdeEstimada,
          observacao: etapaItem.observacao,
          definir_preco: !hasHistoricalPrice,
          price_source: hasHistoricalPrice ? "historico_mediana_r$_m2" : "sem_referencia_historica",
          etapa_custo_m2_historico: costPerM2,
          etapa_amostras_historico: sampleCount,
          area_base_m2: builtArea,
        },
      });
      sortOrder += 10;
    }
  }

  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.total, 0));
  const confidenceScore = weightedConfidence(items, facts);
  const pendingPriceCount = items.filter(
    (item) => item.metadata.definir_preco === true
  ).length;

  const sourceSummary = {
    mode: "claude_planta_etapas_historico",
    template: "Taxonomia historica Meu Viver (planilha FER E MACIEL)",
    generated_at: new Date().toISOString(),
    file_names: input.fileNames,
    plan_analysis: planAnalysis,
    historical_price_sources: priceIndex.sources,
    pending_price_items: pendingPriceCount,
    warning:
      pendingPriceCount > 0
        ? `Pre-orcamento gerado pela leitura da planta (Claude) com precos do historico por etapa. ${pendingPriceCount} item(ns) sem referencia historica estao com custo 0 e flag "definir preço".`
        : "Pre-orcamento gerado pela leitura da planta (Claude) com precos medianos do historico por etapa. Revise antes da proposta final.",
  };

  return {
    facts,
    items,
    subtotal,
    total: subtotal,
    confidenceScore,
    sourceSummary,
    memorialText:
      planAnalysis?.memorialDescritivo ?? buildMemorial(input, builtArea, poolArea, subtotal),
  };
}

function buildFacts(input: EstimateInput, builtArea: number, poolArea: number): GeneratedFact[] {
  const planAnalysis = input.planAnalysis ?? null;
  const terrainArea = firstNumberOrNull(input.terrainAreaM2, planAnalysis?.terrainAreaM2);
  const floorsCount = firstNumberOrNull(input.floorsCount, planAnalysis?.floorsCount);
  const hasPlanBasement = typeof planAnalysis?.hasBasement === "boolean";
  const hasBasement = input.hasBasement || planAnalysis?.hasBasement === true;
  const qualityStandard = input.qualityStandard || planAnalysis?.qualityStandard || "alto_padrao";
  const facts: GeneratedFact[] = [
    {
      fact_key: "built_area_m2",
      label: "Area construida",
      value_text: `${NUMBER.format(builtArea)} m2`,
      value_numeric: builtArea,
      unit: "m2",
      confidence: input.builtAreaM2 ? 0.92 : planAnalysis?.builtAreaM2 ? planAnalysis.confidence : 0.55,
      source: input.builtAreaM2 ? "usuario" : planAnalysis?.builtAreaM2 ? "planta_ia" : "template_referencia",
      needs_review: !input.builtAreaM2 && !planAnalysis?.builtAreaM2,
    },
    {
      fact_key: "pool_area_m2",
      label: "Area de piscina",
      value_text: `${NUMBER.format(poolArea)} m2`,
      value_numeric: poolArea,
      unit: "m2",
      confidence: input.poolAreaM2 ? 0.9 : planAnalysis?.poolAreaM2 ? planAnalysis.confidence : 0.55,
      source: input.poolAreaM2 ? "usuario" : planAnalysis?.poolAreaM2 ? "planta_ia" : "template_referencia",
      needs_review: !input.poolAreaM2 && !planAnalysis?.poolAreaM2,
    },
    {
      fact_key: "terrain_area_m2",
      label: "Area do terreno",
      value_text: terrainArea ? `${NUMBER.format(terrainArea)} m2` : "Nao informada",
      value_numeric: terrainArea,
      unit: "m2",
      confidence: input.terrainAreaM2 ? 0.86 : planAnalysis?.terrainAreaM2 ? planAnalysis.confidence : 0.35,
      source: input.terrainAreaM2 ? "usuario" : planAnalysis?.terrainAreaM2 ? "planta_ia" : "pendente",
      needs_review: !terrainArea,
    },
    {
      fact_key: "floors_count",
      label: "Pavimentos",
      value_text: floorsCount ? String(floorsCount) : "Nao informado",
      value_numeric: floorsCount,
      unit: "un",
      confidence: input.floorsCount ? 0.82 : planAnalysis?.floorsCount ? planAnalysis.confidence : 0.4,
      source: input.floorsCount ? "usuario" : planAnalysis?.floorsCount ? "planta_ia" : "pendente",
      needs_review: !floorsCount,
    },
    {
      fact_key: "has_basement",
      label: "Subsolo",
      value_text: hasBasement ? "Sim" : "Nao",
      value_numeric: hasBasement ? 1 : 0,
      unit: null,
      confidence: input.hasBasement ? 0.75 : hasPlanBasement ? planAnalysis?.confidence ?? 0.65 : 0.45,
      source: input.hasBasement ? "usuario" : hasPlanBasement ? "planta_ia" : "pendente",
      needs_review: !input.hasBasement && !hasPlanBasement,
    },
    {
      fact_key: "quality_standard",
      label: "Padrao",
      value_text: standardLabel(qualityStandard),
      value_numeric: null,
      unit: null,
      confidence: input.qualityStandard ? 0.75 : planAnalysis?.qualityStandard ? planAnalysis.confidence : 0.45,
      source: input.qualityStandard ? "usuario" : planAnalysis?.qualityStandard ? "planta_ia" : "pendente",
      needs_review: !qualityStandard,
    },
    {
      fact_key: "source_files",
      label: "Arquivos enviados",
      value_text: input.fileNames.length ? input.fileNames.join(", ") : "Nenhum arquivo anexado",
      value_numeric: input.fileNames.length,
      unit: "un",
      confidence: input.fileNames.length ? 0.75 : 0.25,
      source: "upload",
      needs_review: input.fileNames.length === 0,
    },
  ];

  if (planAnalysis) {
    facts.push({
      fact_key: "plan_ai_status",
      label: "Leitura da planta",
      value_text: planAnalysis.summary,
      value_numeric: planAnalysis.confidence,
      unit: null,
      confidence: planAnalysis.confidence,
      source: planAnalysis.status === "analyzed" ? "planta_ia" : "sistema",
      needs_review: planAnalysis.status !== "analyzed",
      metadata: {
        status: planAnalysis.status,
        model: planAnalysis.model,
      },
    });
  }

  if (planAnalysis?.status === "analyzed") {
    for (const fact of planAnalysis.facts) {
      const numeric = typeof fact.value === "number" ? fact.value : null;
      facts.push({
        fact_key: `planta_${fact.key}`.slice(0, 80),
        label: fact.label,
        value_text: fact.value === null ? null : String(fact.value),
        value_numeric: numeric,
        unit: fact.unit,
        confidence: fact.confidence,
        source: "planta_ia",
        needs_review: fact.confidence < 0.75,
        metadata: {
          evidence: fact.evidence,
        },
      });
    }
  }

  for (const [index, risk] of (planAnalysis?.risks ?? []).slice(0, 8).entries()) {
    facts.push({
      fact_key: `plan_risk_${index + 1}`,
      label: "Risco/pendencia da planta",
      value_text: risk,
      value_numeric: null,
      unit: null,
      confidence: 0.5,
      source: "planta_ia",
      needs_review: true,
    });
  }

  return facts;
}

function resolveQuantity(
  item: BudgetTemplateItem,
  input: EstimateInput,
  builtArea: number,
  poolArea: number
): QuantityResolution {
  const rule = item.quantity_rule ?? {};
  const basis = typeof rule.basis === "string" ? rule.basis : "fallback";
  const factor = toNumber(rule.factor, 1);
  const fallback = toNumber(rule.fallback, Number(item.default_quantity ?? 0));
  const planAnalysis = input.planAnalysis ?? null;
  const measurements = planAnalysis?.measurements ?? {};
  const floors = input.floorsCount ?? planAnalysis?.floorsCount ?? 2;
  const hasBasement = input.hasBasement || planAnalysis?.hasBasement === true;
  const measurementKey = measurementKeyForBasis(basis);
  const measuredValue =
    measurementKey && typeof measurements[measurementKey] === "number"
      ? measurements[measurementKey]
      : null;
  const builtAreaSource = input.builtAreaM2
    ? "usuario"
    : planAnalysis?.builtAreaM2 || measurements.built_area_m2
      ? "planta_ia"
      : "template_parametrico";
  const poolAreaSource = input.poolAreaM2
    ? "usuario"
    : planAnalysis?.poolAreaM2 || measurements.pool_area_m2
      ? "planta_ia"
      : "template_parametrico";

  const valueByBasis: Record<string, number> = {
    fixed: fallback,
    fallback,
    built_area_m2: builtArea,
    pool_area_m2: poolArea,
    has_pool_fixed: poolArea > 0 ? fallback : 0,
    has_basement_fixed: hasBasement ? fallback : 0,
    contract_value_pct: fallback,
    floor_area_estimate: builtArea * 0.96,
    wet_wall_area_estimate: builtArea * 0.565,
    roof_area_estimate: builtArea * 0.492,
    ceiling_area_estimate: builtArea * 1.2,
    structure_kg_estimate: builtArea * 28.26,
    concrete_m3_estimate: builtArea * 0.106,
    foundation_meter_estimate: builtArea * (input.hasBasement ? 1.18 : 1.06),
    block_unit_estimate: builtArea * 32.98,
    masonry_bag_estimate: builtArea * 0.612,
    render_m3_estimate: builtArea * 0.094,
    ac_points_estimate: Math.max(1, Math.round(builtArea / 47)),
    floors_count: floors,
  };

  const baseValue = measuredValue ?? valueByBasis[basis] ?? fallback;
  const raw = baseValue * factor;
  const quantity = !Number.isFinite(raw) || raw < 0 ? 0 : roundQuantity(raw, item.unit);
  let source: QuantityResolution["source"] = "template_parametrico";

  if (measuredValue !== null) {
    source = "planta_ia";
  } else if (basis === "built_area_m2") {
    source = builtAreaSource;
  } else if (basis === "pool_area_m2") {
    source = poolAreaSource;
  } else if (
    [
      "floor_area_estimate",
      "wet_wall_area_estimate",
      "roof_area_estimate",
      "ceiling_area_estimate",
      "structure_kg_estimate",
      "concrete_m3_estimate",
      "foundation_meter_estimate",
      "block_unit_estimate",
      "masonry_bag_estimate",
      "render_m3_estimate",
      "ac_points_estimate",
    ].includes(basis)
  ) {
    source = builtAreaSource === "planta_ia" ? "planta_ia_parametrica" : builtAreaSource;
  } else if (basis === "has_basement_fixed" && typeof planAnalysis?.hasBasement === "boolean") {
    source = input.hasBasement ? "usuario" : "planta_ia_parametrica";
  }

  return {
    quantity,
    source,
    basis,
    baseValue,
    measurementKey: measuredValue !== null ? measurementKey : null,
  };
}

function buildMemorial(
  input: EstimateInput,
  builtArea: number,
  poolArea: number,
  subtotal: number
): string {
  const planAnalysis = input.planAnalysis ?? null;
  const title = input.title || "Estudo preliminar";
  const client = input.clientName || planAnalysis?.clientName || "cliente a definir";
  const address = input.address || planAnalysis?.address || "endereco a confirmar";
  const floorsValue = input.floorsCount ?? planAnalysis?.floorsCount;
  const floors = floorsValue ? `${floorsValue} pavimento(s)` : "pavimentos a confirmar";
  const basement = input.hasBasement || planAnalysis?.hasBasement === true ? "com subsolo previsto" : "sem subsolo informado";
  const poolText = poolArea > 0 ? `e piscina estimada em ${NUMBER.format(poolArea)} m2` : "sem piscina informada";
  const readingText =
    planAnalysis?.status === "analyzed"
      ? `Leitura visual da planta: ${planAnalysis.summary}`
      : "Leitura visual da planta pendente; este memorial usa o template detalhado e premissas parametricas ate a IA visual estar configurada.";
  const planSections = planAnalysis?.memorialSections.length
    ? [
        "",
        "Escopo extraido da planta",
        ...planAnalysis.memorialSections.flatMap((section, index) => [
          `${index + 1}. ${section.title}`,
          section.body,
          section.evidence ? `Evidencia: ${section.evidence}` : "",
        ]),
      ]
    : [];

  return [
    `MEMORIAL DESCRITIVO PRELIMINAR - ${title.toUpperCase()}`,
    "",
    `Cliente/obra: ${client}. Local: ${address}.`,
    `Escopo inicial considerado: residencia de alto padrao com area construida estimada em ${NUMBER.format(builtArea)} m2, ${floors}, ${basement}, ${poolText}.`,
    readingText,
    ...planSections,
    "",
    "1. Administracao e canteiro",
    "Acompanhamento tecnico, planejamento fisico-financeiro, documentacao de obra e estrutura basica de canteiro devem ser previstos conforme contrato e normas vigentes.",
    "",
    "2. Servicos iniciais e movimentacao de terra",
    "Contempla locacao de obra, gabarito, limpeza inicial, acessos provisorios e terraplanagem preliminar. Cortes, aterros e subsolo dependem de topografia, sondagem e projeto estrutural.",
    "",
    "3. Fundacoes e estrutura",
    "Previsao parametrica de fundacoes, concreto, aco, formas, lajes, vigas, pilares e escadaria. Quantitativos estruturais exigem validacao com projeto estrutural executivo.",
    "",
    "4. Vedacoes, contrapiso e revestimentos argamassados",
    "Inclui alvenaria, chapisco, reboco, contrapiso, requadros e preparos para revestimentos, conforme padrao de acabamento validado com o cliente.",
    "",
    "5. Instalacoes",
    "Instalacoes eletricas, dados, hidrossanitarias, infraestrutura de ar condicionado e pontos complementares foram estimados por parametro. Pontos finais dependem de compatibilizacao.",
    "",
    "6. Cobertura, impermeabilizacoes e complementos",
    "Previstos cobertura, calhas, rufos, impermeabilizacoes e itens complementares conforme leitura preliminar do escopo.",
    "",
    "7. Acabamentos",
    "Gesso, pintura, pisos, revestimentos, marmores, esquadrias e portas aparecem como verbas/parametros iniciais. Materiais especificos, marcas, paginações e itens a cargo do contratante devem ser confirmados.",
    "",
    `Valor preliminar parametrico: ${BRL.format(subtotal)}. Este valor nao substitui orcamento executivo; serve como base de partida para revisao tecnica e comercial.`,
  ].join("\n");
}

function weightedConfidence(items: GeneratedItem[], facts: GeneratedFact[]): number {
  const itemTotal = items.reduce((sum, item) => sum + item.total, 0) || 1;
  const itemScore = items.reduce((sum, item) => sum + item.confidence * (item.total / itemTotal), 0);
  const factScore = facts.reduce((sum, fact) => sum + fact.confidence, 0) / Math.max(1, facts.length);
  return clampConfidence(itemScore * 0.75 + factScore * 0.25);
}

function firstNumber(...values: Array<number | null | undefined>): number {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return 0;
}

function firstNumberOrNull(...values: Array<number | null | undefined>): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function sourceConfidenceBonus(
  source: QuantityResolution["source"],
  planAnalysis: PlanAnalysis | null
): number {
  if (source === "usuario") return 0.08;
  if (source === "planta_ia") return 0.16 * (planAnalysis?.confidence ?? 0.65);
  if (source === "planta_ia_parametrica") return 0.1 * (planAnalysis?.confidence ?? 0.65);
  return -0.04;
}

function measurementKeyForBasis(basis: string): string | null {
  const aliases: Record<string, string> = {
    built_area_m2: "built_area_m2",
    pool_area_m2: "pool_area_m2",
    floor_area_estimate: "floor_area_m2",
    wet_wall_area_estimate: "wet_wall_area_m2",
    roof_area_estimate: "roof_area_m2",
    ceiling_area_estimate: "ceiling_area_m2",
    structure_kg_estimate: "structure_kg_estimate",
    concrete_m3_estimate: "concrete_m3_estimate",
    foundation_meter_estimate: "foundation_meter_estimate",
    block_unit_estimate: "block_unit_estimate",
    masonry_bag_estimate: "masonry_bag_estimate",
    render_m3_estimate: "render_m3_estimate",
    ac_points_estimate: "ac_points_estimate",
  };
  return aliases[basis] ?? null;
}

function standardLabel(value: string): string {
  const labels: Record<string, string> = {
    alto_padrao: "Alto padrao",
    medio_alto: "Medio alto",
    economico: "Economico",
  };
  return labels[value] ?? value;
}

function toNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundQuantity(value: number, unit: string): number {
  if (value > 0 && value < 1) return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
  const normalized = unit.toUpperCase();
  if (["UNID", "UN", "SC"].includes(normalized)) return Math.round(value);
  if (["KG"].includes(normalized)) return Math.round(value);
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function clampConfidence(value: number): number {
  return Math.max(0.1, Math.min(0.95, Math.round(value * 100) / 100));
}
