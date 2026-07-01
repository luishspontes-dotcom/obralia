import {
  callClaudeWithDocuments,
  ClaudeTimeoutError,
  type ClaudeDocumentInput,
  extractJsonObject,
  isClaudeConfigured,
} from "@/lib/budget-ai/claude";
import { HISTORICAL_ETAPAS, findHistoricalEtapa } from "@/lib/budget-ai/historical-prices";
import {
  MAX_PLAN_PAGES,
  MAX_PLAN_TOTAL_BYTES,
  PLAN_LIMIT_MESSAGE,
} from "@/lib/budget-ai/limits";

export type StorageDownloadClient = {
  storage: {
    from(bucket: string): {
      download(path: string): Promise<{ data: Blob | null; error: { message: string } | null }>;
    };
  };
};

export type UploadedEstimateFileForAnalysis = {
  kind: "plan" | "proposal" | "spreadsheet" | "other";
  file_name: string;
  storage_bucket: string;
  storage_path: string;
  content_type: string | null;
  size_bytes: number;
};

export type PlanAnalysisFact = {
  key: string;
  label: string;
  value: string | number | boolean | null;
  unit: string | null;
  confidence: number;
  evidence: string | null;
};

export type PlanEtapaItem = {
  descricao: string;
  qtdeEstimada: number | null;
  unidade: string;
  observacao: string | null;
};

export type PlanEtapa = {
  numero: number;
  nome: string;
  itens: PlanEtapaItem[];
};

export type PlanAnalysis = {
  status: "analyzed" | "missing_key" | "no_plan_file" | "failed";
  model: string | null;
  summary: string;
  confidence: number;
  projectTitle: string | null;
  clientName: string | null;
  address: string | null;
  builtAreaM2: number | null;
  terrainAreaM2: number | null;
  poolAreaM2: number | null;
  floorsCount: number | null;
  hasBasement: boolean | null;
  qualityStandard: "alto_padrao" | "medio_alto" | "economico" | null;
  measurements: Record<string, number>;
  facts: PlanAnalysisFact[];
  memorialSections: Array<{ title: string; body: string; evidence: string | null }>;
  risks: string[];
  /** Campos novos do fluxo Claude (formato dos orcamentos historicos). */
  resumoObra: string | null;
  areaTotalM2: number | null;
  etapas: PlanEtapa[];
  memorialDescritivo: string | null;
};

/**
 * Erro específico de planta acima dos limites operacionais (~80 páginas / 20MB).
 * É lançado ANTES de qualquer chamada à IA e propagado até quem orquestra o
 * processamento, para virar mensagem amigável no estudo.
 */
export class PlanFilesTooLargeError extends Error {
  constructor(message: string = PLAN_LIMIT_MESSAGE) {
    super(message);
    this.name = "PlanFilesTooLargeError";
  }
}

export async function analyzePlanFilesFromStorage(
  supabase: StorageDownloadClient,
  files: UploadedEstimateFileForAnalysis[]
): Promise<PlanAnalysis> {
  const planFiles = files.filter((file) => file.kind === "plan");
  if (planFiles.length === 0) {
    return emptyAnalysis("no_plan_file", "Nenhuma planta foi anexada para leitura visual.");
  }

  const hasClaude = isClaudeConfigured();
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!hasClaude && !openaiKey) {
    return emptyAnalysis(
      "missing_key",
      "Leitura visual pendente: configure ANTHROPIC_API_KEY (preferencial) ou OPENAI_API_KEY no ambiente do servidor."
    );
  }

  let documents: ClaudeDocumentInput[];
  try {
    documents = await downloadPlanDocuments(supabase, planFiles);
  } catch (error) {
    if (error instanceof PlanFilesTooLargeError) throw error;
    return emptyAnalysis(
      "failed",
      `Leitura visual falhou: ${error instanceof Error ? error.message : "erro desconhecido"}.`
    );
  }
  if (documents.length === 0) {
    return emptyAnalysis("failed", "A planta excede o limite operacional de leitura visual.");
  }

  // OpenAI é o PRIMÁRIO: mais rápido e a saída cabe no limite de tokens sem
  // truncar. O Claude fica como RESERVA — a saída dele estoura o maxTokens
  // (8192) em plantas complexas e falha no parse, além de gastar ~112s; então
  // só é acionado se o OpenAI estiver indisponível.
  if (openaiKey) {
    try {
      return await analyzeWithOpenAi(documents, openaiKey);
    } catch (openaiError) {
      if (!hasClaude) {
        return emptyAnalysis(
          "failed",
          `Leitura visual falhou: ${openaiError instanceof Error ? openaiError.message : "erro desconhecido"}.`
        );
      }
      // OpenAI indisponível mas Claude configurado: segue para a reserva abaixo.
    }
  }

  try {
    return await analyzeWithClaude(documents);
  } catch (claudeError) {
    // Timeout na Claude vira erro propagado (evita estourar o runtime da função).
    if (claudeError instanceof ClaudeTimeoutError) throw claudeError;
    return emptyAnalysis(
      "failed",
      `Leitura visual falhou (OpenAI e Claude): ${claudeError instanceof Error ? claudeError.message : "erro desconhecido"}.`
    );
  }
}

/**
 * Máximo de páginas enviadas à IA por PDF de planta.
 * PDFs de planta têm carimbo/implantação/plantas baixas no início — as
 * primeiras pranchas concentram o que o orçamento precisa. Cortar acelera
 * MUITO a leitura (menos tokens de entrada) e evita estourar o maxDuration.
 */
const MAX_PAGES_SENT_TO_CLAUDE = 12;

async function downloadPlanDocuments(
  supabase: StorageDownloadClient,
  planFiles: UploadedEstimateFileForAnalysis[]
): Promise<ClaudeDocumentInput[]> {
  const documents: ClaudeDocumentInput[] = [];
  let totalBytes = 0;

  for (const file of planFiles) {
    if (totalBytes + file.size_bytes > MAX_PLAN_TOTAL_BYTES) {
      throw new PlanFilesTooLargeError();
    }
    const downloadStartedAt = Date.now();
    const { data, error } = await supabase.storage.from(file.storage_bucket).download(file.storage_path);
    if (error || !data) throw new Error(error?.message ?? `Nao foi possivel baixar ${file.file_name}.`);
    let bytes = Buffer.from(await data.arrayBuffer());
    console.log(
      `[budget-ai] download: "${file.file_name}" ${bytes.byteLength} bytes em ${Date.now() - downloadStartedAt}ms`
    );
    totalBytes += bytes.byteLength;
    if (totalBytes > MAX_PLAN_TOTAL_BYTES) {
      throw new PlanFilesTooLargeError();
    }

    const mediaType = file.content_type || "application/pdf";
    if (mediaType.includes("pdf")) {
      bytes = Buffer.from(await trimPdfToFirstPages(bytes, file.file_name)) as typeof bytes;
    }

    documents.push({
      filename: file.file_name,
      base64: bytes.toString("base64"),
      mediaType,
    });
  }

  return documents;
}

/**
 * Corta o PDF para as primeiras MAX_PAGES_SENT_TO_CLAUDE páginas usando
 * pdf-lib (puro JS, sem binário nativo). Fail-open: se o pdf-lib não
 * conseguir ler o arquivo (PDF corrompido/cifrado), mantém o original e
 * cai na checagem heurística de limite de páginas (~80) de antes.
 */
async function trimPdfToFirstPages(bytes: Buffer, fileName: string): Promise<Buffer> {
  const trimStartedAt = Date.now();
  try {
    const { PDFDocument } = await import("pdf-lib");
    const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const totalPages = source.getPageCount();

    if (totalPages <= MAX_PAGES_SENT_TO_CLAUDE) {
      console.log(
        `[budget-ai] corte: "${fileName}" tem ${totalPages} pagina(s), enviado integral (${Date.now() - trimStartedAt}ms)`
      );
      return bytes;
    }

    const trimmed = await PDFDocument.create();
    const pageIndexes = Array.from({ length: MAX_PAGES_SENT_TO_CLAUDE }, (_, index) => index);
    const pages = await trimmed.copyPages(source, pageIndexes);
    for (const page of pages) trimmed.addPage(page);
    const output = Buffer.from(await trimmed.save());

    console.log(
      `[budget-ai] corte: "${fileName}" ${totalPages} -> ${MAX_PAGES_SENT_TO_CLAUDE} paginas, ` +
        `${bytes.byteLength} -> ${output.byteLength} bytes em ${Date.now() - trimStartedAt}ms`
    );
    return output;
  } catch (error) {
    console.log(
      `[budget-ai] corte: falhou para "${fileName}" (${error instanceof Error ? error.message : "erro desconhecido"}); usando PDF original`
    );
    if (countPdfPagesHeuristic(bytes) > MAX_PLAN_PAGES) {
      throw new PlanFilesTooLargeError(
        `A planta "${fileName}" tem mais de ${MAX_PLAN_PAGES} páginas. ${PLAN_LIMIT_MESSAGE}`
      );
    }
    return bytes;
  }
}

/**
 * Conta páginas de um PDF por heurística (objetos "/Type /Page" no corpo).
 * PDFs com streams comprimidos podem subcontar — a checagem é fail-open:
 * serve para barrar plantas claramente acima do limite, sem falso-positivo.
 */
function countPdfPagesHeuristic(bytes: Buffer): number {
  const text = bytes.toString("latin1");
  const matches = text.match(/\/Type\s*\/Page(?![a-zA-Z])/g);
  return matches ? matches.length : 0;
}

// ---------------------------------------------------------------------------
// Caminho principal: Claude (Anthropic) com PDF nativo + taxonomia historica
// ---------------------------------------------------------------------------

async function analyzeWithClaude(documents: ClaudeDocumentInput[]): Promise<PlanAnalysis> {
  const { text, model } = await callClaudeWithDocuments({
    system: buildClaudeSystemPrompt(),
    prompt: buildClaudeUserPrompt(),
    documents,
    // 8192 é o teto: suficiente para o JSON do orçamento e bem mais rápido
    // de gerar que os 20k anteriores (que estouravam o runtime da Vercel).
    maxTokens: 8192,
    temperature: 0.2,
  });

  const json = extractJsonObject(text);
  if (!json) throw new Error("Resposta da Claude sem JSON estruturado.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("JSON invalido na resposta da Claude.");
  }

  return normalizeClaudeAnalysis(parsed, model);
}

function buildClaudeSystemPrompt(): string {
  return [
    "Voce e o engenheiro orcamentista senior da Meu Viver Construtora (obras residenciais de alto padrao).",
    "Sua funcao: ler plantas arquitetonicas em PDF e produzir a base de um orcamento no FORMATO EXATO das planilhas historicas da empresa, alem de um memorial descritivo em tom de proposta comercial.",
    "Regras inegociaveis:",
    "1. NUNCA invente medidas. O que a planta nao mostrar com clareza vira null e entra em risks.",
    "2. NUNCA invente precos. Voce NAO preenche custo unitario nem custo total - precos vem do historico da empresa, fora desta etapa.",
    "3. Responda APENAS com um objeto JSON valido, sem texto antes ou depois, sem cercas de codigo.",
  ].join("\n");
}

function buildClaudeUserPrompt(): string {
  const taxonomy = HISTORICAL_ETAPAS.map((etapa) => `${etapa.numero}. ${etapa.nome}`).join("\n");
  return [
    "Analise a(s) planta(s) arquitetonica(s) em anexo e extraia:",
    "- Carimbo/selo da prancha: titulo do projeto, cliente/proprietario, endereco/lote/condominio, responsavel tecnico, escala, revisao.",
    "- Areas por pavimento e area total construida (quadro de areas, quando existir).",
    "- Ambientes de cada pavimento (nome e area quando escrita).",
    "- Esquadrias (portas e janelas: quantidades e dimensoes quando indicadas).",
    "- Acabamentos ESCRITOS na planta (pisos, revestimentos, forros, pintura, bancadas, cobertura).",
    "- Piscina, subsolo, terreno, numero de pavimentos.",
    "",
    "Com base no que foi extraido, monte as ETAPAS do orcamento usando EXATAMENTE a taxonomia historica abaixo (mesma grafia do nome; use o mesmo numero da lista; inclua somente etapas pertinentes a esta obra):",
    taxonomy,
    "",
    "Dentro de cada etapa, liste os SERVICOS/COMPOSICOES como nos orcamentos historicos (ex.: itens 8.1, 8.2 dentro da etapa 8). Estime quantidades apenas quando defensaveis a partir da planta (areas, perimetros, contagens de esquadrias/pontos); caso contrario use qtde_estimada null e explique na observacao.",
    "Unidades preferidas: M2, ML, UNID, VB, KG, SC, M3, PONTO, DIARIA.",
    "",
    "Tambem escreva o MEMORIAL DESCRITIVO em markdown, no tom da proposta comercial da Meu Viver Construtora: introducao com identificacao da obra (cliente, endereco, area), depois uma secao '## N. NOME DA ETAPA' para cada etapa pertinente descrevendo o escopo, materiais e premissas, e fechamento com condicoes gerais e itens nao inclusos. Linguagem profissional, direta, em portugues do Brasil.",
    "",
    "Responda SOMENTE com JSON neste formato:",
    JSON.stringify(
      {
        resumo_obra: "string - 2 a 4 frases resumindo a obra lida na planta",
        confidence: "number 0..1",
        area_total_m2: "number | null",
        projeto: {
          titulo: "string | null",
          cliente: "string | null",
          endereco: "string | null",
          area_terreno_m2: "number | null",
          area_piscina_m2: "number | null",
          pavimentos: "integer | null",
          subsolo: "boolean | null",
          padrao: "alto_padrao | medio_alto | economico | null",
          areas_por_pavimento: [{ pavimento: "string", area_m2: "number | null" }],
        },
        measurements: {
          built_area_m2: "number opcional",
          floor_area_m2: "number opcional",
          wet_wall_area_m2: "number opcional",
          roof_area_m2: "number opcional",
          ceiling_area_m2: "number opcional",
          structure_kg_estimate: "number opcional",
          concrete_m3_estimate: "number opcional",
          foundation_meter_estimate: "number opcional",
          block_unit_estimate: "number opcional",
          masonry_bag_estimate: "number opcional",
          render_m3_estimate: "number opcional",
          ac_points_estimate: "number opcional",
        },
        etapas: [
          {
            numero: "integer da taxonomia",
            nome: "string exatamente igual a taxonomia",
            itens: [
              {
                descricao: "string",
                qtde_estimada: "number | null",
                unidade: "string",
                observacao: "string | null",
              },
            ],
          },
        ],
        memorial_descritivo: "string markdown completo",
        facts: [
          {
            key: "string snake_case",
            label: "string",
            value: "string | number | boolean | null",
            unit: "string | null",
            confidence: "number 0..1",
            evidence: "string | null - prancha/quadro onde foi lido",
          },
        ],
        risks: ["string - pendencias e limites da leitura"],
      },
      null,
      2
    ),
  ].join("\n");
}

type ClaudeProjectPayload = {
  titulo?: unknown;
  cliente?: unknown;
  endereco?: unknown;
  area_terreno_m2?: unknown;
  area_piscina_m2?: unknown;
  pavimentos?: unknown;
  subsolo?: unknown;
  padrao?: unknown;
  areas_por_pavimento?: unknown;
};

type ClaudeAnalysisPayload = {
  resumo_obra?: unknown;
  confidence?: unknown;
  area_total_m2?: unknown;
  projeto?: unknown;
  measurements?: unknown;
  etapas?: unknown;
  memorial_descritivo?: unknown;
  facts?: unknown;
  risks?: unknown;
};

function normalizeClaudeAnalysis(value: unknown, model: string): PlanAnalysis {
  const payload = (value && typeof value === "object" ? value : {}) as ClaudeAnalysisPayload;
  const projeto = (payload.projeto && typeof payload.projeto === "object"
    ? payload.projeto
    : {}) as ClaudeProjectPayload;

  const confidence = clamp(asNumber(payload.confidence, 0.7), 0.1, 0.96);
  const measurements = normalizeMeasurements(payload.measurements);
  const etapas = normalizeEtapas(payload.etapas);
  const areaTotal = asNullableNumber(payload.area_total_m2) ?? asNullableNumber(measurements.built_area_m2);

  const facts: PlanAnalysisFact[] = Array.isArray(payload.facts)
    ? payload.facts.slice(0, 60).map((factRaw) => {
        const fact = (factRaw && typeof factRaw === "object" ? factRaw : {}) as Record<string, unknown>;
        return {
          key: cleanText(fact.key) || "fact",
          label: cleanText(fact.label) || "Fato extraido",
          value: normalizeFactValue(fact.value),
          unit: cleanText(fact.unit),
          confidence: clamp(asNumber(fact.confidence, confidence), 0.1, 0.98),
          evidence: cleanText(fact.evidence),
        };
      })
    : [];

  const floorAreas = Array.isArray(projeto.areas_por_pavimento) ? projeto.areas_por_pavimento : [];
  for (const [index, floorRaw] of floorAreas.slice(0, 8).entries()) {
    const floor = (floorRaw && typeof floorRaw === "object" ? floorRaw : {}) as Record<string, unknown>;
    const label = cleanText(floor.pavimento) ?? `Pavimento ${index + 1}`;
    const area = asNullableNumber(floor.area_m2);
    facts.push({
      key: `area_pavimento_${index + 1}`,
      label: `Area - ${label}`,
      value: area,
      unit: "m2",
      confidence,
      evidence: "Quadro de areas da planta",
    });
  }

  const memorial = cleanLongText(payload.memorial_descritivo);

  return {
    status: "analyzed",
    model,
    summary: cleanLongText(payload.resumo_obra) || "Planta lida pela IA (Claude).",
    confidence,
    projectTitle: cleanText(projeto.titulo),
    clientName: cleanText(projeto.cliente),
    address: cleanText(projeto.endereco),
    builtAreaM2: areaTotal,
    terrainAreaM2: asNullableNumber(projeto.area_terreno_m2),
    poolAreaM2: asNullableNumber(projeto.area_piscina_m2 ?? measurements.pool_area_m2),
    floorsCount: asNullableInteger(projeto.pavimentos),
    hasBasement: typeof projeto.subsolo === "boolean" ? projeto.subsolo : null,
    qualityStandard: normalizeStandard(projeto.padrao),
    measurements,
    facts,
    memorialSections: [],
    risks: normalizeRisks(payload.risks),
    resumoObra: cleanLongText(payload.resumo_obra),
    areaTotalM2: areaTotal,
    etapas,
    memorialDescritivo: memorial,
  };
}

function normalizeEtapas(value: unknown): PlanEtapa[] {
  if (!Array.isArray(value)) return [];
  const etapas: PlanEtapa[] = [];

  for (const etapaRaw of value.slice(0, 60)) {
    const etapa = (etapaRaw && typeof etapaRaw === "object" ? etapaRaw : {}) as Record<string, unknown>;
    const nomeRaw = cleanText(etapa.nome);
    if (!nomeRaw) continue;

    // Reancora na taxonomia historica quando possivel (grafia e numero oficiais).
    const historical = findHistoricalEtapa(nomeRaw);
    const numero = historical?.numero ?? asNullableInteger(etapa.numero) ?? etapas.length + 1;
    const nome = historical?.nome ?? nomeRaw;

    const itensRaw = Array.isArray(etapa.itens) ? etapa.itens : [];
    const itens: PlanEtapaItem[] = [];
    for (const itemRaw of itensRaw.slice(0, 40)) {
      const item = (itemRaw && typeof itemRaw === "object" ? itemRaw : {}) as Record<string, unknown>;
      const descricao = cleanText(item.descricao);
      if (!descricao) continue;
      itens.push({
        descricao,
        qtdeEstimada: asNullableNumber(item.qtde_estimada),
        unidade: (cleanText(item.unidade) || "VB").toUpperCase().slice(0, 12),
        observacao: cleanText(item.observacao),
      });
    }
    if (itens.length === 0) continue;

    etapas.push({ numero, nome, itens });
  }

  return etapas.sort((a, b) => a.numero - b.numero);
}

function normalizeRisks(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((risk) => cleanText(risk))
    .filter((risk): risk is string => Boolean(risk))
    .slice(0, 20);
}

// ---------------------------------------------------------------------------
// Fallback: OpenAI (mantido para ambientes sem ANTHROPIC_API_KEY)
// ---------------------------------------------------------------------------

async function analyzeWithOpenAi(
  documents: ClaudeDocumentInput[],
  apiKey: string
): Promise<PlanAnalysis> {
  const model = process.env.OPENAI_MODEL || "gpt-5.5";

  const fileInputs = documents.map((document) => ({
    type: "input_file",
    filename: document.filename,
    file_data: `data:${document.mediaType};base64,${document.base64}`,
  }));

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "user",
          content: [
            ...fileInputs,
            {
              type: "input_text",
              text: buildPlanPrompt(),
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "obralia_plan_analysis",
          strict: false,
          schema: planAnalysisSchema,
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI ${response.status}: ${errorText.slice(0, 500)}`);
  }

  const payload = await response.json();
  const outputText = extractOutputText(payload);
  if (!outputText) throw new Error("Resposta sem JSON estruturado.");

  const parsed = JSON.parse(outputText) as Partial<PlanAnalysis>;
  return normalizePlanAnalysis(parsed, model);
}

function buildPlanPrompt(): string {
  return [
    "Voce e um engenheiro orcamentista senior da Meu Viver Construtora.",
    "Analise a planta arquitetonica enviada e extraia somente informacoes tecnicamente defensaveis.",
    "Nao invente medidas. Quando a planta nao mostrar algo com clareza, use null e registre em risks.",
    "Objetivo: gerar dados para um primeiro orçamento e memorial descritivo a partir somente da planta.",
    "Priorize: area construida, area do terreno, area de piscina, pavimentos, subsolo, ambientes, cobertura, escadas, esquadrias, areas molhadas, evidencias por prancha/quadro.",
    "Preencha measurements com chaves quando puder estimar: built_area_m2, floor_area_m2, wet_wall_area_m2, roof_area_m2, ceiling_area_m2, structure_kg_estimate, concrete_m3_estimate, foundation_meter_estimate, block_unit_estimate, masonry_bag_estimate, render_m3_estimate, ac_points_estimate.",
    "Retorne apenas JSON valido no schema solicitado.",
  ].join("\\n");
}

function normalizePlanAnalysis(value: Partial<PlanAnalysis>, model: string): PlanAnalysis {
  const confidence = clamp(asNumber(value.confidence, 0.65), 0.1, 0.96);
  const measurements = normalizeMeasurements(value.measurements);

  return {
    status: "analyzed",
    model,
    summary: cleanText(value.summary) || "Planta lida por IA visual.",
    confidence,
    projectTitle: cleanText(value.projectTitle),
    clientName: cleanText(value.clientName),
    address: cleanText(value.address),
    builtAreaM2: asNullableNumber(value.builtAreaM2 ?? measurements.built_area_m2),
    terrainAreaM2: asNullableNumber(value.terrainAreaM2),
    poolAreaM2: asNullableNumber(value.poolAreaM2 ?? measurements.pool_area_m2),
    floorsCount: asNullableInteger(value.floorsCount),
    hasBasement: typeof value.hasBasement === "boolean" ? value.hasBasement : null,
    qualityStandard: normalizeStandard(value.qualityStandard),
    measurements,
    facts: Array.isArray(value.facts)
      ? value.facts.slice(0, 40).map((fact) => ({
          key: cleanText(fact.key) || "fact",
          label: cleanText(fact.label) || "Fato extraido",
          value: normalizeFactValue(fact.value),
          unit: cleanText(fact.unit),
          confidence: clamp(asNumber(fact.confidence, confidence), 0.1, 0.98),
          evidence: cleanText(fact.evidence),
        }))
      : [],
    memorialSections: Array.isArray(value.memorialSections)
      ? value.memorialSections.slice(0, 12).map((section) => ({
          title: cleanText(section.title) || "Escopo",
          body: cleanText(section.body) || "",
          evidence: cleanText(section.evidence),
        }))
      : [],
    risks: normalizeRisks(value.risks),
    resumoObra: cleanText(value.summary),
    areaTotalM2: asNullableNumber(value.builtAreaM2 ?? measurements.built_area_m2),
    etapas: [],
    memorialDescritivo: null,
  };
}

function emptyAnalysis(status: PlanAnalysis["status"], summary: string): PlanAnalysis {
  return {
    status,
    model: null,
    summary,
    confidence: status === "missing_key" ? 0.2 : 0.35,
    projectTitle: null,
    clientName: null,
    address: null,
    builtAreaM2: null,
    terrainAreaM2: null,
    poolAreaM2: null,
    floorsCount: null,
    hasBasement: null,
    qualityStandard: null,
    measurements: {},
    facts: [],
    memorialSections: [],
    risks: [summary],
    resumoObra: null,
    areaTotalM2: null,
    etapas: [],
    memorialDescritivo: null,
  };
}

function extractOutputText(payload: unknown): string | null {
  const direct = (payload as { output_text?: unknown }).output_text;
  if (typeof direct === "string") return direct;

  const output = (payload as { output?: unknown }).output;
  if (!Array.isArray(output)) return null;
  const parts: string[] = [];

  for (const item of output) {
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      const text = (block as { text?: unknown }).text;
      if (typeof text === "string") parts.push(text);
    }
  }

  return parts.join("").trim() || null;
}

function normalizeMeasurements(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value)) {
    const parsed = asNullableNumber(raw);
    if (parsed !== null && parsed >= 0) out[key] = parsed;
  }
  return out;
}

function cleanText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 3000) : null;
}

function cleanLongText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 60000) : null;
}

function asNullableNumber(value: unknown): number | null {
  const parsed = asNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

function asNullableInteger(value: unknown): number | null {
  const parsed = asNullableNumber(value);
  return parsed === null ? null : Math.round(parsed);
}

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function normalizeFactValue(value: unknown): string | number | boolean | null {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return null;
}

function normalizeStandard(value: unknown): PlanAnalysis["qualityStandard"] {
  if (value === "alto_padrao" || value === "medio_alto" || value === "economico") return value;
  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value * 100) / 100));
}

const planAnalysisSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    confidence: { type: "number" },
    projectTitle: { type: ["string", "null"] },
    clientName: { type: ["string", "null"] },
    address: { type: ["string", "null"] },
    builtAreaM2: { type: ["number", "null"] },
    terrainAreaM2: { type: ["number", "null"] },
    poolAreaM2: { type: ["number", "null"] },
    floorsCount: { type: ["integer", "null"] },
    hasBasement: { type: ["boolean", "null"] },
    qualityStandard: { type: ["string", "null"], enum: ["alto_padrao", "medio_alto", "economico", null] },
    measurements: {
      type: "object",
      additionalProperties: { type: "number" },
    },
    facts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          key: { type: "string" },
          label: { type: "string" },
          value: { type: ["string", "number", "boolean", "null"] },
          unit: { type: ["string", "null"] },
          confidence: { type: "number" },
          evidence: { type: ["string", "null"] },
        },
        required: ["key", "label", "value", "unit", "confidence", "evidence"],
      },
    },
    memorialSections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          body: { type: "string" },
          evidence: { type: ["string", "null"] },
        },
        required: ["title", "body", "evidence"],
      },
    },
    risks: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: [
    "summary",
    "confidence",
    "projectTitle",
    "clientName",
    "address",
    "builtAreaM2",
    "terrainAreaM2",
    "poolAreaM2",
    "floorsCount",
    "hasBasement",
    "qualityStandard",
    "measurements",
    "facts",
    "memorialSections",
    "risks",
  ],
};
