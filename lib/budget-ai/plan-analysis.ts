type StorageDownloadClient = {
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
};

const MAX_TOTAL_FILE_BYTES = 18 * 1024 * 1024;

export async function analyzePlanFilesFromStorage(
  supabase: StorageDownloadClient,
  files: UploadedEstimateFileForAnalysis[]
): Promise<PlanAnalysis> {
  const planFiles = files.filter((file) => file.kind === "plan");
  if (planFiles.length === 0) {
    return emptyAnalysis("no_plan_file", "Nenhuma planta foi anexada para leitura visual.");
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return emptyAnalysis(
      "missing_key",
      "Leitura visual pendente: OPENAI_API_KEY nao esta configurada no ambiente do servidor."
    );
  }

  const model = process.env.OPENAI_MODEL || "gpt-5.5";

  try {
    const fileInputs = [];
    let totalBytes = 0;

    for (const file of planFiles) {
      if (totalBytes + file.size_bytes > MAX_TOTAL_FILE_BYTES) break;
      const { data, error } = await supabase.storage.from(file.storage_bucket).download(file.storage_path);
      if (error || !data) throw new Error(error?.message ?? `Nao foi possivel baixar ${file.file_name}.`);
      const bytes = Buffer.from(await data.arrayBuffer());
      totalBytes += bytes.byteLength;
      const mimeType = file.content_type || "application/pdf";
      fileInputs.push({
        type: "input_file",
        filename: file.file_name,
        file_data: `data:${mimeType};base64,${bytes.toString("base64")}`,
      });
    }

    if (fileInputs.length === 0) {
      return emptyAnalysis("failed", "A planta excede o limite operacional de leitura visual.");
    }

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
  } catch (error) {
    return emptyAnalysis(
      "failed",
      `Leitura visual falhou: ${error instanceof Error ? error.message : "erro desconhecido"}.`
    );
  }
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
    risks: Array.isArray(value.risks)
      ? value.risks
          .map((risk) => cleanText(risk))
          .filter((risk): risk is string => Boolean(risk))
          .slice(0, 20)
      : [],
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
