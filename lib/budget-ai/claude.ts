/**
 * Cliente Anthropic (Claude) via fetch direto, sem SDK.
 * Usado pelo Orcamento IA para ler plantas em PDF nativamente
 * (a API aceita documentos PDF base64 ate 32MB / 100 paginas).
 */

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export const CLAUDE_DEFAULT_MODEL = "claude-sonnet-4-6";

export type ClaudeDocumentInput = {
  filename: string;
  base64: string;
  mediaType: string;
};

type ClaudeRequestTextBlock = {
  type: "text";
  text: string;
};

type ClaudeRequestDocumentBlock = {
  type: "document";
  source: {
    type: "base64";
    media_type: string;
    data: string;
  };
  title?: string;
};

type ClaudeRequestImageBlock = {
  type: "image";
  source: {
    type: "base64";
    media_type: string;
    data: string;
  };
};

type ClaudeRequestContentBlock =
  | ClaudeRequestTextBlock
  | ClaudeRequestDocumentBlock
  | ClaudeRequestImageBlock;

export type ClaudeCallOptions = {
  prompt: string;
  system?: string;
  documents?: ClaudeDocumentInput[];
  maxTokens?: number;
  temperature?: number;
};

export type ClaudeCallResult = {
  text: string;
  model: string;
};

export function isClaudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function claudeModelName(): string {
  return process.env.ANTHROPIC_MODEL ?? CLAUDE_DEFAULT_MODEL;
}

export async function callClaudeWithDocuments(options: ClaudeCallOptions): Promise<ClaudeCallResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY nao esta configurada no ambiente do servidor.");
  }

  const model = claudeModelName();
  const content: ClaudeRequestContentBlock[] = [];

  for (const document of options.documents ?? []) {
    if (document.mediaType.startsWith("image/")) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: document.mediaType,
          data: document.base64,
        },
      });
    } else {
      content.push({
        type: "document",
        source: {
          type: "base64",
          media_type: document.mediaType || "application/pdf",
          data: document.base64,
        },
        title: document.filename.slice(0, 200),
      });
    }
  }

  content.push({ type: "text", text: options.prompt });

  const body: Record<string, unknown> = {
    model,
    max_tokens: options.maxTokens ?? 16000,
    temperature: options.temperature ?? 0.2,
    messages: [
      {
        role: "user",
        content,
      },
    ],
  };
  if (options.system) body.system = options.system;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic ${response.status}: ${errorText.slice(0, 500)}`);
  }

  const payload = (await response.json()) as unknown;
  const text = extractClaudeText(payload);
  if (!text) {
    throw new Error("Resposta da Anthropic sem blocos de texto.");
  }

  return { text, model };
}

function extractClaudeText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const contentRaw = (payload as { content?: unknown }).content;
  if (!Array.isArray(contentRaw)) return null;

  const parts: string[] = [];
  for (const block of contentRaw) {
    if (!block || typeof block !== "object") continue;
    const type = (block as { type?: unknown }).type;
    const text = (block as { text?: unknown }).text;
    if (type === "text" && typeof text === "string") parts.push(text);
  }
  const joined = parts.join("").trim();
  return joined || null;
}

/**
 * Extrai o primeiro objeto JSON valido de uma resposta de modelo
 * (tolerante a cercas de codigo ```json ... ``` e texto ao redor).
 */
export function extractJsonObject(text: string): string | null {
  const withoutFences = text
    .replace(/```json/gi, "```")
    .split("```")
    .map((chunk) => chunk.trim())
    .find((chunk) => chunk.startsWith("{"))
    ?? text;

  const start = withoutFences.indexOf("{");
  const end = withoutFences.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return withoutFences.slice(start, end + 1);
}
