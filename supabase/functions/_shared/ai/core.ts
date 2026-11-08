// Provider-neutral types and HTTP plumbing shared by the AI adapters.
// Runtime-agnostic (fetch only) so the Edge Functions and the Node scripts share it.

export type AiProvider = "gemini" | "openrouter";

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image"; mimeType: string; data: string }; // data is base64

// Standard JSON Schema subset. List every property in `required`: OpenRouter runs in strict
// mode, which rejects optional fields (model a missing value as an empty string or array).
export type JsonSchema = {
  type: "object" | "array" | "string" | "number" | "integer" | "boolean";
  description?: string;
  enum?: string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
};

export type GenerateJsonOptions = {
  apiKey: string;
  model: string;
  system?: string;
  parts: ContentPart[];
  schema: JsonSchema;
  schemaName: string;
  temperature?: number;
  timeoutMs?: number;
};

export type AiUsage = {
  inputTokens?: number;
  outputTokens?: number; // includes reasoning tokens
  totalTokens?: number;
  costUsd?: number; // reported by OpenRouter only
};

export type GenerateJsonResult<T> = {
  data: T;
  usage: AiUsage;
  model?: string; // the model version that actually served the request
  latencyMs: number;
};

export class AiError extends Error {
  provider: AiProvider;
  status: number | undefined;
  body: string | undefined;

  constructor(provider: AiProvider, message: string, status?: number, body?: string) {
    super(message);
    this.name = "AiError";
    this.provider = provider;
    this.status = status;
    this.body = body;
  }
}

const RETRY_STATUSES = new Set([408, 429, 500, 502, 503]);
const MAX_ATTEMPTS = 3;

export async function postJson(
  provider: AiProvider,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs = 120_000,
): Promise<unknown> {
  const payload = JSON.stringify(body);
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: payload,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.ok) return res.json();

    const errBody = await res.text();
    if (!RETRY_STATUSES.has(res.status) || attempt >= MAX_ATTEMPTS) {
      throw new AiError(provider, `${provider} HTTP ${res.status}`, res.status, errBody);
    }
    await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
  }
}

export function parseJson<T>(provider: AiProvider, text: string | null | undefined, finishReason: string | undefined): T {
  if (!text) {
    throw new AiError(provider, `Empty response (finish reason: ${finishReason ?? "none"})`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new AiError(provider, `Response was not valid JSON (finish reason: ${finishReason ?? "none"})`, undefined, text);
  }
}
