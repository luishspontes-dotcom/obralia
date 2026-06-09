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
  const builtArea = input.builtAreaM2 ?? 424.56;
  const poolArea = input.poolAreaM2 ?? 0;
  const facts = buildFacts(input, builtArea, poolArea);

  const items = templateItems.map((item) => {
    const quantity = resolveQuantity(item, input, builtArea, poolArea);
    const total = roundMoney(quantity * Number(item.unit_cost ?? 0));
    const source =
      item.needs_review_default || quantity === Number(item.default_quantity ?? quantity)
        ? "template_parametrico"
        : "parametros_usuario";
    const confidence = clampConfidence(
      Number(item.confidence_baseline ?? 0.55) +
        (input.builtAreaM2 ? 0.04 : -0.08) +
        (item.needs_review_default ? -0.06 : 0.04)
    );

    return {
      template_item_id: item.id,
      code: item.code,
      group_name: item.group_name,
      description: item.description,
      quantity,
      unit: item.unit,
      unit_cost: Number(item.unit_cost ?? 0),
      total,
      confidence,
      source,
      needs_review: item.needs_review_default || confidence < 0.72,
      sort_order: item.sort_order,
      metadata: {
        quantity_rule: item.quantity_rule ?? {},
        default_quantity: item.default_quantity,
        source_notes: item.source_notes,
      },
    };
  });

  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.total, 0));
  const total = subtotal;
  const confidenceScore = weightedConfidence(items, facts);
  const sourceSummary = {
    mode: "mvp_parametrico",
    template: "Meu Viver - alto padrao residencial",
    generated_at: new Date().toISOString(),
    file_names: input.fileNames,
    warning:
      "Pre-orcamento automatico. Quantitativos e escopos devem ser revisados antes de proposta final.",
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

function buildFacts(input: EstimateInput, builtArea: number, poolArea: number): GeneratedFact[] {
  return [
    {
      fact_key: "built_area_m2",
      label: "Area construida",
      value_text: `${NUMBER.format(builtArea)} m2`,
      value_numeric: builtArea,
      unit: "m2",
      confidence: input.builtAreaM2 ? 0.92 : 0.55,
      source: input.builtAreaM2 ? "usuario" : "template_referencia",
      needs_review: !input.builtAreaM2,
    },
    {
      fact_key: "pool_area_m2",
      label: "Area de piscina",
      value_text: `${NUMBER.format(poolArea)} m2`,
      value_numeric: poolArea,
      unit: "m2",
      confidence: input.poolAreaM2 ? 0.9 : 0.55,
      source: input.poolAreaM2 ? "usuario" : "template_referencia",
      needs_review: !input.poolAreaM2,
    },
    {
      fact_key: "terrain_area_m2",
      label: "Area do terreno",
      value_text: input.terrainAreaM2 ? `${NUMBER.format(input.terrainAreaM2)} m2` : "Nao informada",
      value_numeric: input.terrainAreaM2,
      unit: "m2",
      confidence: input.terrainAreaM2 ? 0.86 : 0.35,
      source: input.terrainAreaM2 ? "usuario" : "pendente",
      needs_review: !input.terrainAreaM2,
    },
    {
      fact_key: "floors_count",
      label: "Pavimentos",
      value_text: input.floorsCount ? String(input.floorsCount) : "Nao informado",
      value_numeric: input.floorsCount,
      unit: "un",
      confidence: input.floorsCount ? 0.82 : 0.4,
      source: input.floorsCount ? "usuario" : "pendente",
      needs_review: !input.floorsCount,
    },
    {
      fact_key: "has_basement",
      label: "Subsolo",
      value_text: input.hasBasement ? "Sim" : "Nao",
      value_numeric: input.hasBasement ? 1 : 0,
      unit: null,
      confidence: 0.75,
      source: "usuario",
      needs_review: false,
    },
    {
      fact_key: "quality_standard",
      label: "Padrao",
      value_text: standardLabel(input.qualityStandard),
      value_numeric: null,
      unit: null,
      confidence: 0.75,
      source: "usuario",
      needs_review: false,
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
}

function resolveQuantity(
  item: BudgetTemplateItem,
  input: EstimateInput,
  builtArea: number,
  poolArea: number
): number {
  const rule = item.quantity_rule ?? {};
  const basis = typeof rule.basis === "string" ? rule.basis : "fallback";
  const factor = toNumber(rule.factor, 1);
  const fallback = toNumber(rule.fallback, Number(item.default_quantity ?? 0));
  const floors = input.floorsCount ?? 2;

  const valueByBasis: Record<string, number> = {
    fixed: fallback,
    fallback,
    built_area_m2: builtArea,
    pool_area_m2: poolArea,
    has_pool_fixed: poolArea > 0 ? fallback : 0,
    has_basement_fixed: input.hasBasement ? fallback : 0,
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

  const raw = (valueByBasis[basis] ?? fallback) * factor;
  if (!Number.isFinite(raw) || raw < 0) return 0;
  return roundQuantity(raw, item.unit);
}

function buildMemorial(
  input: EstimateInput,
  builtArea: number,
  poolArea: number,
  subtotal: number
): string {
  const title = input.title || "Estudo preliminar";
  const client = input.clientName || "cliente a definir";
  const address = input.address || "endereco a confirmar";
  const floors = input.floorsCount ? `${input.floorsCount} pavimento(s)` : "pavimentos a confirmar";
  const basement = input.hasBasement ? "com subsolo previsto" : "sem subsolo informado";
  const poolText = poolArea > 0 ? `e piscina estimada em ${NUMBER.format(poolArea)} m2` : "sem piscina informada";

  return [
    `MEMORIAL DESCRITIVO PRELIMINAR - ${title.toUpperCase()}`,
    "",
    `Cliente/obra: ${client}. Local: ${address}.`,
    `Escopo inicial considerado: residencia de alto padrao com area construida estimada em ${NUMBER.format(builtArea)} m2, ${floors}, ${basement}, ${poolText}.`,
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
  const normalized = unit.toUpperCase();
  if (["UNID", "UN", "SC"].includes(normalized)) return Math.round(value);
  if (["KG"].includes(normalized)) return Math.round(value);
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function clampConfidence(value: number): number {
  return Math.max(0.1, Math.min(0.95, Math.round(value * 100) / 100));
}
