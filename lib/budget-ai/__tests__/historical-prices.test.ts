import { describe, expect, it } from "vitest";
import {
  HISTORICAL_ETAPAS,
  etapaCostPerM2,
  etapaSampleCount,
  findHistoricalEtapa,
  normalizeEtapaName,
  type HistoricalPriceIndex,
} from "@/lib/budget-ai/historical-prices";

describe("normalizeEtapaName", () => {
  it("normaliza acentos, caixa e pontuacao para casar variantes", () => {
    expect(normalizeEtapaName("HIDRÁULICA - M. D.O")).toBe(normalizeEtapaName("Hidraulica MDO"));
    expect(normalizeEtapaName("Comissões de Venda")).toBe("COMISSOESDEVENDA");
    expect(normalizeEtapaName("  ELÉTRICA - M. D. O  ")).toBe(normalizeEtapaName("Elétrica MDO"));
  });

  it("nao colide etapas diferentes", () => {
    const normalized = HISTORICAL_ETAPAS.map((etapa) => normalizeEtapaName(etapa.nome));
    expect(new Set(normalized).size).toBe(HISTORICAL_ETAPAS.length);
  });
});

describe("findHistoricalEtapa", () => {
  it("encontra etapa por variante de escrita", () => {
    expect(findHistoricalEtapa("mão de obra civil")?.numero).toBe(8);
    expect(findHistoricalEtapa("SERVIÇOS COMPLEMENTARES")?.numero).toBe(40);
  });

  it("retorna null para etapa desconhecida", () => {
    expect(findHistoricalEtapa("ETAPA QUE NAO EXISTE")).toBeNull();
  });
});

describe("etapaCostPerM2 / etapaSampleCount", () => {
  const index: HistoricalPriceIndex = {
    costPerM2ByEtapa: new Map([
      [normalizeEtapaName("GESSO"), 108.13],
      [normalizeEtapaName("PINTURA - MATERIAL"), 0], // preco zero nao vale como referencia
    ]),
    sampleCountByEtapa: new Map([[normalizeEtapaName("GESSO"), 3]]),
    sources: ["teste"],
  };

  it("resolve preco por variante do nome da etapa", () => {
    expect(etapaCostPerM2(index, "gesso")).toBe(108.13);
    expect(etapaSampleCount(index, "Gesso")).toBe(3);
  });

  it("nunca inventa preco: etapa sem amostra (ou com zero) retorna null", () => {
    expect(etapaCostPerM2(index, "ETAPA INEXISTENTE")).toBeNull();
    expect(etapaCostPerM2(index, "PINTURA - MATERIAL")).toBeNull();
    expect(etapaSampleCount(index, "ETAPA INEXISTENTE")).toBe(0);
  });
});
