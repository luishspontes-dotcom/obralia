import { describe, expect, it } from "vitest";
import {
  generateEstimateFromTemplate,
  generateEstimateFromEtapas,
  type EstimateInput,
} from "@/lib/budget-ai/estimate-engine";
import type { PlanEtapa } from "@/lib/budget-ai/plan-analysis";
import type { HistoricalPriceIndex } from "@/lib/budget-ai/historical-prices";
import { normalizeEtapaName } from "@/lib/budget-ai/historical-prices";
import {
  FER_E_MACIEL_BUILT_AREA,
  FER_E_MACIEL_POOL_AREA,
  FER_E_MACIEL_TOTAL,
  ferEMacielTemplateItems,
} from "./fer-e-maciel-fixture";

function baseInput(overrides: Partial<EstimateInput> = {}): EstimateInput {
  return {
    title: "Estudo de teste",
    clientName: "FER E MACIEL",
    address: "Endereco de teste",
    builtAreaM2: FER_E_MACIEL_BUILT_AREA,
    poolAreaM2: FER_E_MACIEL_POOL_AREA,
    terrainAreaM2: 600,
    floorsCount: 3,
    hasBasement: true,
    qualityStandard: "alto_padrao",
    fileNames: ["planta.pdf"],
    planAnalysis: null,
    ...overrides,
  };
}

describe("generateEstimateFromTemplate — referencia FER E MACIEL", () => {
  it("reproduz o total geral da planilha (R$ 1.566.669,68) com os dados da obra de referencia", () => {
    const estimate = generateEstimateFromTemplate(baseInput(), ferEMacielTemplateItems());
    expect(estimate.total).toBe(FER_E_MACIEL_TOTAL);
    expect(estimate.subtotal).toBe(estimate.total);
    expect(estimate.items).toHaveLength(104);
  });

  it("cada item fecha total = quantidade x custo unitario (regra F = C x E da planilha)", () => {
    const estimate = generateEstimateFromTemplate(baseInput(), ferEMacielTemplateItems());
    for (const item of estimate.items) {
      const expected = Math.round((item.quantity * item.unit_cost + Number.EPSILON) * 100) / 100;
      expect(item.total).toBe(expected);
    }
  });

  it("reproduz quantidades parametricas exatas da planilha (fator x area)", () => {
    const estimate = generateEstimateFromTemplate(baseInput(), ferEMacielTemplateItems());
    const byDescription = new Map(estimate.items.map((item) => [item.description, item]));
    // Ancoras da planilha FER E MACIEL (celulas C/F verificadas na planilha original)
    expect(byDescription.get("MÃO DE OBRA CIVIL - MAGNO")?.quantity).toBe(424.56);
    expect(byDescription.get("MÃO DE OBRA CIVIL - MAGNO")?.total).toBe(373612.8);
    expect(byDescription.get("MÃO DE OBRA REVESTIMENTOS PISO")?.quantity).toBe(407.95);
    expect(byDescription.get("MÃO DE OBRA ARMADOR")?.quantity).toBe(12000);
    expect(byDescription.get("CONCRETAGEM ESTACAS")?.quantity).toBe(45);
    expect(byDescription.get("LAJE PRE MOLDADA SUPERIOR")?.quantity).toBe(248.85);
    expect(byDescription.get("FORRO INTERNO E EXTERNO")?.quantity).toBe(510);
    expect(byDescription.get("MDO")?.total).toBe(63206); // piscina 24,31 m2 x R$ 2.600
    expect(byDescription.get("RECEITA FEDERAL/NOTA")?.total).toBe(70164); // 3,6% x R$ 1.949.000
    expect(byDescription.get("INFRA DE AR CONDICIONADO")?.quantity).toBe(9); // round(424,56 / 47)
  });

  it("zera itens de subsolo quando a obra nao tem subsolo", () => {
    const estimate = generateEstimateFromTemplate(
      baseInput({ hasBasement: false }),
      ferEMacielTemplateItems()
    );
    const basementItems = estimate.items.filter((item) =>
      ["PERFURAÇÃO DE ESTACAS SUBSOLO", "TERRAPLANAGEM CORTE SUBSOLO", "TERRAPLANAGEM ACABAMENTO SUBSOLO"].includes(
        item.description
      )
    );
    expect(basementItems).toHaveLength(3);
    for (const item of basementItems) {
      expect(item.quantity).toBe(0);
      expect(item.total).toBe(0);
    }
    // total cai exatamente os R$ 38.000 dos tres itens de subsolo
    expect(estimate.total).toBe(Math.round((FER_E_MACIEL_TOTAL - 38000) * 100) / 100);
  });

  it("zera o item de piscina quando nao ha piscina", () => {
    const estimate = generateEstimateFromTemplate(
      baseInput({ poolAreaM2: 0 }),
      ferEMacielTemplateItems()
    );
    const pool = estimate.items.find((item) => item.description === "MDO");
    expect(pool?.quantity).toBe(0);
    expect(pool?.total).toBe(0);
  });

  it("usa 424,56 m2 como area de referencia quando nada e informado, com needs_review", () => {
    const estimate = generateEstimateFromTemplate(
      baseInput({ builtAreaM2: null, poolAreaM2: null }),
      ferEMacielTemplateItems()
    );
    const areaFact = estimate.facts.find((fact) => fact.fact_key === "built_area_m2");
    expect(areaFact?.value_numeric).toBe(424.56);
    expect(areaFact?.needs_review).toBe(true);
    expect(areaFact?.source).toBe("template_referencia");
  });

  it("nunca produz quantidade negativa ou NaN", () => {
    const estimate = generateEstimateFromTemplate(
      baseInput({ builtAreaM2: 0, poolAreaM2: 0, floorsCount: null }),
      ferEMacielTemplateItems()
    );
    for (const item of estimate.items) {
      expect(Number.isFinite(item.quantity)).toBe(true);
      expect(item.quantity).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(item.total)).toBe(true);
    }
  });
});

describe("generateEstimateFromEtapas — precos so do historico, nunca inventados", () => {
  const etapas: PlanEtapa[] = [
    {
      numero: 8,
      nome: "MÃO DE OBRA CIVIL",
      itens: [
        { descricao: "Mao de obra civil", unidade: "M2", qtdeEstimada: 100, observacao: null },
        { descricao: "Mao de obra muros", unidade: "M2", qtdeEstimada: 50, observacao: null },
      ],
    },
    {
      numero: 41,
      nome: "ETAPA SEM HISTORICO",
      itens: [{ descricao: "Servico novo", unidade: "VB", qtdeEstimada: null, observacao: null }],
    },
  ];

  function priceIndex(): HistoricalPriceIndex {
    return {
      costPerM2ByEtapa: new Map([[normalizeEtapaName("MÃO DE OBRA CIVIL"), 1000]]),
      sampleCountByEtapa: new Map([[normalizeEtapaName("MÃO DE OBRA CIVIL"), 2]]),
      sources: ["teste"],
    };
  }

  it("distribui o orcamento historico da etapa (R$/m2 x area) entre os itens", () => {
    const estimate = generateEstimateFromEtapas(
      baseInput({ builtAreaM2: 200, poolAreaM2: 0 }),
      etapas,
      priceIndex()
    );
    // etapa 8: 1000 R$/m2 x 200 m2 = 200.000 dividido entre 2 itens = 100.000 cada
    const [first, second] = estimate.items;
    expect(first.total).toBe(100000);
    expect(second.total).toBe(100000);
    expect(first.unit_cost).toBe(1000); // 100.000 / qtde 100
    expect(second.unit_cost).toBe(2000); // 100.000 / qtde 50
  });

  it("itens de etapa sem historico ficam com custo 0 e flag definir_preco", () => {
    const estimate = generateEstimateFromEtapas(
      baseInput({ builtAreaM2: 200, poolAreaM2: 0 }),
      etapas,
      priceIndex()
    );
    const semHistorico = estimate.items.find((item) => item.description === "Servico novo");
    expect(semHistorico?.unit_cost).toBe(0);
    expect(semHistorico?.total).toBe(0);
    expect(semHistorico?.metadata.definir_preco).toBe(true);
    expect(estimate.sourceSummary.pending_price_items).toBe(1);
  });

  it("todo item vindo da planta exige revisao humana", () => {
    const estimate = generateEstimateFromEtapas(
      baseInput({ builtAreaM2: 200 }),
      etapas,
      priceIndex()
    );
    for (const item of estimate.items) {
      expect(item.needs_review).toBe(true);
      expect(item.source).toBe("planta_ia");
    }
  });

  it("subtotal e a soma exata dos itens", () => {
    const estimate = generateEstimateFromEtapas(
      baseInput({ builtAreaM2: 200 }),
      etapas,
      priceIndex()
    );
    const soma = estimate.items.reduce((sum, item) => sum + item.total, 0);
    expect(estimate.subtotal).toBe(Math.round((soma + Number.EPSILON) * 100) / 100);
    expect(estimate.total).toBe(estimate.subtotal);
  });
});
