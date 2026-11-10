// Provider-neutral types and HTTP plumbing shared by the AI adapters.
// Runtime-agnostic (fetch only) so the Edge Functions and the Node scripts share it.

export type AiProvider = "gemini" | "openrouter" | "groq";

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
  provider: AiProvider;
  apiKey: string;
  model: string;
  system?: string;
  parts: ContentPart[];
  schema: JsonSchema;
  schemaName: string;
  temperature?: number;
  // Hard cap on the reply, reasoning included. Without one, OpenRouter reserves credit for the
  // model's maximum (often 64k tokens) and refuses the call if the account can't cover that.
  maxOutputTokens?: number;
  timeoutMs?: number;
};

export const DEFAULT_MAX_OUTPUT_TOKENS = 8192;

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
// Honour a 429's retry-after up to this long; beyond it, fail fast rather than hang. Groq's free
// tier allows ~2 coaching calls a minute (7k input tokens) and asks for waits of up to ~60 s;
// process-entry has 150 s of wall clock, and a Groq call takes seconds.
const MAX_RETRY_AFTER_MS = 60_000;

// Seconds to wait from a retry-after header, or the default backoff.
export function retryDelayMs(retryAfter: string | null, attempt: number): number | null {
  const backoff = 1000 * 2 ** (attempt - 1);
  if (retryAfter === null) return backoff;
  const seconds = Number(retryAfter);
  if (!Number.isFinite(seconds) || seconds < 0) return backoff;
  const ms = Math.ceil(seconds * 1000);
  return ms > MAX_RETRY_AFTER_MS ? null : Math.max(ms, 250);
}

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
    const wait = res.status === 429 ? retryDelayMs(res.headers.get("retry-after"), attempt) : 1000 * 2 ** (attempt - 1);
    if (!RETRY_STATUSES.has(res.status) || attempt >= MAX_ATTEMPTS || wait === null) {
      throw new AiError(provider, `${provider} HTTP ${res.status}`, res.status, errBody);
    }
    await new Promise((r) => setTimeout(r, wait));
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
