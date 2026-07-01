import type { BudgetTemplateItem } from "@/lib/budget-ai/estimate-engine";

/**
 * Fixture com os 104 itens REAIS do template default
 * "Meu Viver - alto padrao residencial" (id ...101), extraidos do banco
 * de producao em 2026-07-01. Derivado da PLANILHA ORCAMENTARIA FER E MACIEL
 * (residencia 424,56 m2 + piscina 24,31 m2, total R$ 1.566.669,68).
 *
 * Formato compacto por linha:
 * [code, group_name, description, unit, unit_cost, default_quantity,
 *  basis, factor (null = sem factor), fallback, confidence_baseline, needs_review_default]
 */
type Row = [
  string, string, string, string, number, number | null,
  string, number | null, number, number, boolean,
];

const ROWS: Row[] = [
  ["1.1", "Comissões de Venda", "CORRETAGEM GEO ARQUITETA", "VB", 53494.56, 1, "fixed", null, 1, 0.52, true],
  ["2.1", "INSS", "RECEITA FEDERAL/NOTA", "VB", 1949000, 0.036, "fixed", null, 0.036, 0.52, true],
  ["3.1", "Serviços PJ Engenharia", "ADM", "VB", 24000, 1, "fixed", null, 1, 0.52, true],
  ["3.2", "Serviços PJ Engenharia", "ISABELA TAIS", "VB", 3500, 1, "fixed", null, 1, 0.52, true],
  ["4.1", "Taxas", "CONTINGENTE", "VB", 1000, 1, "fixed", null, 1, 0.52, true],
  ["5.1", "Seguro de Vida", "SEGURO CONTINGENTE", "MESES", 100, 6, "fixed", null, 6, 0.62, true],
  ["6.1", "Projetos Estruturais/ Arquitetônicos", "PROJETO HIDRÁULICO - DINAMIC", "VB", 7000, 1, "fixed", null, 1, 0.52, true],
  ["6.2", "Projetos Estruturais/ Arquitetônicos", "PROJETO ESTRUTURAL - VINICIUS", "VB", 4500, 1, "fixed", null, 1, 0.52, true],
  ["7.1", "Taxas do CREA", "TAXA ART CREA PR  SETEMBRO", "UNID", 103.03, 1, "fixed", null, 1, 0.62, true],
  ["8.1", "MÃO DE OBRA CIVIL", "MÃO DE OBRA CIVIL - MAGNO", "M2", 880, 424.56, "built_area_m2", 1, 424.56, 0.78, false],
  ["8.2", "MÃO DE OBRA CIVIL", "MÃO DE OBRA CIVIL - MUROS CONTENÇÕES", "M2", 130, 80, "built_area_m2", 0.18843, 80, 0.78, false],
  ["8.3", "MÃO DE OBRA CIVIL", "MÃO DE OBRA ARMADOR", "KG", 2.5, 12000, "structure_kg_estimate", 1.000161, 12000, 0.56, true],
  ["8.4", "MÃO DE OBRA CIVIL", "MÃO DE OBRA CHURRASQUEIRA", "VB", 3000, 1, "fixed", null, 1, 0.52, true],
  ["9.1", "HIDRÁULICA - M. D.O", "MÃO DE OBRA HIDRÁULICA", "VB", 40000, 1, "fixed", null, 1, 0.52, true],
  ["10.1", "ELÉTRICA - M. D. O", "MÃO DE OBRA ELÉTRICA INFRA E ACABAMENTOS", "VB", 25000, 1, "fixed", null, 1, 0.52, true],
  ["10.2", "ELÉTRICA - M. D. O", "MÃO DE OBRA INFRA AUTOMAÇÃO", "VB", 1500, 1, "fixed", null, 1, 0.52, true],
  ["11.1", "REVESTIMENTO CERÂMICO - M. D. O", "MÃO DE OBRA REVESTIMENTOS PISO", "M2", 60, 407.95, "built_area_m2", 0.960877, 407.95, 0.78, false],
  ["11.2", "REVESTIMENTO CERÂMICO - M. D. O", "MÃO DE OBRA REVESTIMENTO PAREDES", "M2", 60, 140, "built_area_m2", 0.329753, 140, 0.78, false],
  ["11.3", "REVESTIMENTO CERÂMICO - M. D. O", "MÃO DE OBRA REVESTIMENTO CALÇADAS EXTERNAS", "M2", 60, 40, "built_area_m2", 0.094215, 40, 0.78, false],
  ["11.4", "REVESTIMENTO CERÂMICO - M. D. O", "MÃO DE OBRA REVESTIMENTO ESCADARIA", "VB", 4000, 3, "fixed", null, 3, 0.52, true],
  ["12.1", "PORTAS INTERNAS - M. D. O", "INSTALAÇÃO PORTAS INTERNAS - FORA MEMORIAL", "UNID", 200, null, "fixed", null, 0, 0.62, true],
  ["13.1", "PINTURA - M. D. O", "MÃO DE OBRA PINTURA", "M2", 180, 424.56, "built_area_m2", 1, 424.56, 0.78, false],
  ["14.1", "EPI's e Uniformes - Funcionários", "EQUIPAMENTOS", "VB", 1000, 1, "fixed", null, 1, 0.52, true],
  ["14.3", "EPI's e Uniformes - Funcionários", "AGILIZA DISTRIBUIDORA OUTUBRO", "VB", 420.69, 1, "fixed", null, 1, 0.52, true],
  ["15.1", "Eventos de Marketing/ Promoção de Imagem", "SIRLEI SETEMBRO", "VB", 35.36, 1, "fixed", null, 1, 0.52, true],
  ["15.1", "Eventos de Marketing/ Promoção de Imagem", "VALDERINO SETEMBRO", "VB", 850, 1, "fixed", null, 1, 0.52, true],
  ["16.1", "SERVIÇOS INICIAIS", "FLESSAK OUTUBRO", "VB", 1292.27, 1, "fixed", null, 1, 0.52, true],
  ["16.2", "SERVIÇOS INICIAIS", "IMPERADOR TELHAS SETEMBRO", "VB", 2749.85, 1, "fixed", null, 1, 0.52, true],
  ["16.3", "SERVIÇOS INICIAIS", "MATERCON OUTUBRO", "VB", 405, 1, "fixed", null, 1, 0.52, true],
  ["16.4", "SERVIÇOS INICIAIS", "TECNOMETAL OUTUBRO", "VB", 1510, 1, "fixed", null, 1, 0.52, true],
  ["17.1", "MANUTENÇÃO DE OBRA", "CONTINGENTE CAÇAMBA", "UNID", 400, 16, "fixed", null, 16, 0.62, true],
  ["17.2", "MANUTENÇÃO DE OBRA", "CONTINGENTE MATERIAIS CANTEIRO", "MESES", 300, 12, "fixed", null, 12, 0.62, true],
  ["17.3", "MANUTENÇÃO DE OBRA", "ALESSANDRO OUTUBRO", "VB", 120, 1, "fixed", null, 1, 0.52, true],
  ["17.4", "MANUTENÇÃO DE OBRA", "CONSTRUCAL OUTUBRO", "VB", 100.98, 1, "fixed", null, 1, 0.52, true],
  ["17.5", "MANUTENÇÃO DE OBRA", "HIDRAULICA UNIAO OUTUBRO", "VB", 73.5, 1, "fixed", null, 1, 0.52, true],
  ["17.6", "MANUTENÇÃO DE OBRA", "IMPERIO DAS TINTAS OUTUBRO", "VB", 194.53, 1, "fixed", null, 1, 0.52, true],
  ["17.7", "MANUTENÇÃO DE OBRA", "PAPELARIA OUTUBRO", "VB", 20.45, 1, "fixed", null, 1, 0.52, true],
  ["17.8", "MANUTENÇÃO DE OBRA", "TELHACO OUTUBRO", "VB", 1969.85, 1, "fixed", null, 1, 0.52, true],
  ["17.9", "MANUTENÇÃO DE OBRA", "TOTAL OUTUBRO", "VB", 45.72, 1, "fixed", null, 1, 0.52, true],
  ["17.10", "MANUTENÇÃO DE OBRA", "VINICOLOR OUTUBRO", "VB", 210.74, 1, "fixed", null, 1, 0.52, true],
  ["17.11", "MANUTENÇÃO DE OBRA", "VRCOM OUTUBRO", "VB", 83, 1, "fixed", null, 1, 0.52, true],
  ["18.1", "Locações de Máquinas e Equipamentos", "LOCAÇÃO DE ANDAIMES", "MESES", 2000, 6, "fixed", null, 6, 0.62, true],
  ["18.2", "Locações de Máquinas e Equipamentos", "LOCAÇÃO DE ESCORAS", "MESES", 1300, 6, "fixed", null, 6, 0.62, true],
  ["18.3", "Locações de Máquinas e Equipamentos", "MUNCK DESCARREGAR TIJOLOS", "VB", 1200, 2, "fixed", null, 2, 0.52, true],
  ["18.4", "Locações de Máquinas e Equipamentos", "MUNCK IÇAR FERRAGENS", "VB", 1200, 3, "fixed", null, 3, 0.52, true],
  ["18.5", "Locações de Máquinas e Equipamentos", "JAIR GULARTE OUTUBRO", "VB", 4000, 1, "fixed", null, 1, 0.52, true],
  ["18.5", "Locações de Máquinas e Equipamentos", "ROHDE MUNCK OUTUBRO", "VB", 110, 1, "fixed", null, 1, 0.52, true],
  ["19.2", "Despesa com Frete/ Despesa com Transporte", "FABIO FRETE OUTUBRO", "VB", 60, 1, "fixed", null, 1, 0.52, true],
  ["19.2", "Despesa com Frete/ Despesa com Transporte", "CONTINGENTE", "VB", 3000, 1, "fixed", null, 1, 0.52, true],
  ["20.1", "FUNDAÇÃO SERVIÇOS PERFURAÇÃO", "PERFURAÇÃO DE ESTACAS SUBSOLO", "VB", 6000, 1, "has_basement_fixed", null, 1, 0.56, true],
  ["20.1", "FUNDAÇÃO SERVIÇOS PERFURAÇÃO", "PERFURAÇÃO DE ESTACAS TÉRREO", "VB", 5000, 1, "fixed", null, 1, 0.52, true],
  ["21.1", "ESTRUTURA - MATERIAL", "AÇO CONTINGENTE", "VB", 15000, 1, "fixed", null, 1, 0.52, true],
  ["21.2", "ESTRUTURA - MATERIAL", "FORMAS", "VB", 20000, 1, "fixed", null, 1, 0.52, true],
  ["21.3", "ESTRUTURA - MATERIAL", "CONCRETAGEM ESTACAS", "M3", 600, 45, "concrete_m3_estimate", 0.999925, 45, 0.56, true],
  ["21.4", "ESTRUTURA - MATERIAL", "CONCRETAGEM BLOCOS E BALDRAMES", "M3", 600, 20, "concrete_m3_estimate", 0.444411, 20, 0.56, true],
  ["21.5", "ESTRUTURA - MATERIAL", "CONCRETAGEM PILARES SUBSOLO", "M3", 650, 8, "concrete_m3_estimate", 0.177765, 8, 0.56, true],
  ["21.6", "ESTRUTURA - MATERIAL", "CONCRETAGEM DE VIGAS E LAJE TÉRREO", "M3", 650, 20, "concrete_m3_estimate", 0.444411, 20, 0.56, true],
  ["21.7", "ESTRUTURA - MATERIAL", "CONCRETAGEM PILARES TÉRREO", "M3", 650, 8, "concrete_m3_estimate", 0.177765, 8, 0.56, true],
  ["21.8", "ESTRUTURA - MATERIAL", "CONCRETAGEM DE VIGAS E LAJE SUPERIOR", "M3", 650, 30, "concrete_m3_estimate", 0.666617, 30, 0.56, true],
  ["21.9", "ESTRUTURA - MATERIAL", "CONCRETAGEM PILARES SUPERIOR", "M3", 650, 8, "concrete_m3_estimate", 0.177765, 8, 0.56, true],
  ["21.10", "ESTRUTURA - MATERIAL", "CONCRETAGEM DE VIGAS E LAJE COBERTURA", "M3", 650, 30, "concrete_m3_estimate", 0.666617, 30, 0.56, true],
  ["21.11", "ESTRUTURA - MATERIAL", "CONCRETAGEM PLATIBANDA", "M2", 630, 5, "built_area_m2", 0.011777, 5, 0.78, false],
  ["21.12", "ESTRUTURA - MATERIAL", "CONSUMIVEIS ESTRUTURA", "VB", 1000, 1, "fixed", null, 1, 0.52, true],
  ["21.13", "ESTRUTURA - MATERIAL", "RAFAEL DE ALBUQUERQUE OUTUBRO", "VB", 76, 1, "fixed", null, 1, 0.52, true],
  ["21.18", "ESTRUTURA - MATERIAL", "STOCK MADEIRAS OUTUBRO", "VB", 9180, 1, "fixed", null, 1, 0.52, true],
  ["21.19", "ESTRUTURA - MATERIAL", "BONAMIGO AÇO OUTUBRO", "VB", 55141.72, 1, "fixed", null, 1, 0.52, true],
  ["22.1", "LAJE - MATERIAL", "LAJE PRE MOLDADA TÉRREO", "M2", 55, 120.4, "built_area_m2", 0.283588, 120.4, 0.78, false],
  ["22.1", "LAJE - MATERIAL", "LAJE PRE MOLDADA SUPERIOR", "M2", 55, 248.85, "built_area_m2", 0.586136, 248.85, 0.78, false],
  ["22.1", "LAJE - MATERIAL", "LAJE PRE MOLDADA COBERTURA", "M2", 55, 285, "built_area_m2", 0.671283, 285, 0.78, false],
  ["23.1", "ALVENARIA - MATERIAL", "TIJOLO 14X19X24", "UNID", 1.8, 14000, "fixed", null, 14000, 0.62, true],
  ["23.2", "ALVENARIA - MATERIAL", "ARGAMASSA AC3", "SC", 30, 80, "fixed", null, 80, 0.62, true],
  ["23.3", "ALVENARIA - MATERIAL", "ARGAMASSA ASSENTAMENTO", "M3", 650, 18, "concrete_m3_estimate", 0.39997, 18, 0.56, true],
  ["24.1", "REBOCO INTERNO/ EXTERNO MATERIAL", "MATERIAIS CONSUMIVEIS", "VB", 6000, 1, "fixed", null, 1, 0.52, true],
  ["24.2", "REBOCO INTERNO/ EXTERNO MATERIAL", "ARGAMASSA REBOCO", "M3", 650, 40, "concrete_m3_estimate", 0.888823, 40, 0.56, true],
  ["24.3", "REBOCO INTERNO/ EXTERNO MATERIAL", "CONSTRUCAL SETEMBRO", "VB", 181.64, 1, "fixed", null, 1, 0.52, true],
  ["25.1", "CONTRA PISO - MATERIAL", "CONCRETAGEM DE CONTRAPISO DO SUBSOLO", "M3", 590, 11, "concrete_m3_estimate", 0.244426, 11, 0.56, true],
  ["25.2", "CONTRA PISO - MATERIAL", "CARGA BRITA", "CARGA", 1400, 1, "fixed", null, 1, 0.62, true],
  ["25.3", "CONTRA PISO - MATERIAL", "LONA ROLO 4X50", "UNID", 300, 2, "fixed", null, 2, 0.62, true],
  ["26.1", "CALHAS E RUFOS", "CALHAS E RUFOS", "VB", 25000, 1, "fixed", null, 1, 0.52, true],
  ["27.1", "COBERTURA - MATERIAL", "MADEIRAS ESTRUTURA", "VB", 12000, 1, "fixed", null, 1, 0.52, true],
  ["27.2", "COBERTURA - MATERIAL", "TELHA SANDUICHE", "M2", 150, 209, "built_area_m2", 0.492274, 209, 0.78, false],
  ["30.1", "MÁRMORE - MATERIAL E M.D.O", "SOLEIRAS", "VB", 2000, 1, "fixed", null, 1, 0.52, true],
  ["30.2", "MÁRMORE - MATERIAL E M.D.O", "PEITORIS", "VB", 5000, 1, "fixed", null, 1, 0.52, true],
  ["31.1", "REVESTIMENTO CERÂMICO - MATERIAL", "ARGAMASSA", "SC", 30, 400, "fixed", null, 400, 0.62, true],
  ["31.2", "REVESTIMENTO CERÂMICO - MATERIAL", "SALVA PISO", "RL", 300, 15, "fixed", null, 15, 0.62, true],
  ["31.3", "REVESTIMENTO CERÂMICO - MATERIAL", "FITA PARA SALVA PISO", "CX", 200, 2, "fixed", null, 2, 0.62, true],
  ["31.4", "REVESTIMENTO CERÂMICO - MATERIAL", "MATERIAIS CONSUMIVEIS", "VB", 3000, 1, "fixed", null, 1, 0.52, true],
  ["32.1", "GESSO", "FORRO INTERNO E EXTERNO", "M2", 90, 510, "built_area_m2", 1.201244, 510, 0.78, false],
  ["33.1", "PINTURA - MATERIAL", "MATERIAIS", "M2", 100, 424.56, "built_area_m2", 1, 424.56, 0.78, false],
  ["34.1", "ELÉTRICA - MATERIAL", "ESTIMATIVA MATERIAIS", "M2", 68, 424.56, "built_area_m2", 1, 424.56, 0.78, false],
  ["34.2", "ELÉTRICA - MATERIAL", "FLESSAK OUTUBRO", "VB", 5436.2, 1, "fixed", null, 1, 0.52, true],
  ["34.2", "ELÉTRICA - MATERIAL", "MULTICABOS OUTUBRO", "VB", 171.56, 1, "fixed", null, 1, 0.52, true],
  ["35.1", "HIDRÁULICA - MATERIAL", "ESTIMATIVA MATERIAIS", "M2", 85, 424.56, "built_area_m2", 1, 424.56, 0.78, false],
  ["35.1", "HIDRÁULICA - MATERIAL", "HIDRAULICA UNIAO OUTUBRO", "VB", 25, 1, "fixed", null, 1, 0.52, true],
  ["36.1", "PISCINAS - MATERIAL E M.D.O", "MDO", "M2", 2600, 24.31, "pool_area_m2", 1, 24.31, 0.78, false],
  ["36.2", "PISCINAS - MATERIAL E M.D.O", "MATERIAIS HIDRAULICOS", "VB", 5000, 1, "fixed", null, 1, 0.52, true],
  ["36.4", "PISCINAS - MATERIAL E M.D.O", "ARGAMASSA REJUNTE PISICNA", "UNID", 65, 36, "fixed", null, 36, 0.62, true],
  ["38.1", "MAQUINAS E EQUIPAMENTOS", "TERRAPLANAGEM CORTE SUBSOLO", "VB", 26000, 1, "has_basement_fixed", null, 1, 0.56, true],
  ["38.2", "MAQUINAS E EQUIPAMENTOS", "TERRAPLANAGEM ACABAMENTO SUBSOLO", "VB", 6000, 1, "has_basement_fixed", null, 1, 0.56, true],
  ["38.3", "MAQUINAS E EQUIPAMENTOS", "TERRAPLANAGEM ACABAMENTOS LATERAIS", "VB", 3000, 1, "fixed", null, 1, 0.52, true],
  ["39.4", "MÃO DE OBRA EXTRA", "CONTINGENTE EQUIPE DEREK", "VB", 15000, 1, "fixed", null, 1, 0.52, true],
  ["40.1", "SERVIÇOS COMPLEMENTARES", "INFRA DE AR CONDICIONADO", "UNID", 1800, 9, "ac_points_estimate", 1, 9, 0.58, true],
  ["40.2", "SERVIÇOS COMPLEMENTARES", "IMPERMEABILIZAÇÕES", "VB", 12000, 1, "fixed", null, 1, 0.52, true],
  ["40.3", "SERVIÇOS COMPLEMENTARES", "LIMPEZA FINAL DE OBRA", "VB", 1000, 1, "fixed", null, 1, 0.52, true],
];

/** Total geral da PLANILHA ORCAMENTARIA FER E MACIEL (celula F152 = SUM(F5:F151)). */
export const FER_E_MACIEL_TOTAL = 1_566_669.68;
export const FER_E_MACIEL_BUILT_AREA = 424.56;
export const FER_E_MACIEL_POOL_AREA = 24.31;

export function ferEMacielTemplateItems(): BudgetTemplateItem[] {
  return ROWS.map((row, index) => {
    const [code, group, description, unit, unitCost, defaultQty, basis, factor, fallback, confidence, review] = row;
    const rule: Record<string, unknown> = { basis, fallback };
    if (factor !== null) rule.factor = factor;
    return {
      id: `fixture-${index + 1}`,
      code,
      group_name: group,
      description,
      unit,
      unit_cost: unitCost,
      default_quantity: defaultQty,
      quantity_rule: rule,
      confidence_baseline: confidence,
      needs_review_default: review,
      source_notes: null,
      sort_order: (index + 1) * 10,
    };
  });
}
