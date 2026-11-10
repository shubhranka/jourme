// Shared by the OpenAI-compatible chat-completions providers (OpenRouter, Groq): messages with
// inline images, a strict JSON schema, and the usage block.

import {
  AiError,
  type AiProvider,
  type ContentPart,
  DEFAULT_MAX_OUTPUT_TOKENS,
  type GenerateJsonOptions,
  type GenerateJsonResult,
  type JsonSchema,
  parseJson,
  postJson,
} from "./core.ts";

export type StrictSchema = Omit<JsonSchema, "properties" | "items"> & {
  properties?: Record<string, StrictSchema>;
  items?: StrictSchema;
  additionalProperties?: false;
};

type ChatCompletionResponse = {
  model?: string;
  choices?: {
    message?: { content?: string | null };
    finish_reason?: string;
    error?: { code?: number; message?: string };
  }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; cost?: number };
};

// Strict mode requires additionalProperties: false on every object.
export function toStrictSchema(schema: JsonSchema): StrictSchema {
  const { properties, items, ...rest } = schema;
  return {
    ...rest,
    ...(properties && {
      properties: Object.fromEntries(Object.entries(properties).map(([k, v]) => [k, toStrictSchema(v)])),
      additionalProperties: false,
    }),
    ...(items && { items: toStrictSchema(items) }),
  };
}

function toChatPart(part: ContentPart) {
  return part.type === "text"
    ? { type: "text", text: part.text }
    : { type: "image_url", image_url: { url: `data:${part.mimeType};base64,${part.data}` } };
}

export type ChatRequestBody = {
  model: string;
  messages: { role: "system" | "user"; content: string | ReturnType<typeof toChatPart>[] }[];
  response_format: { type: "json_schema"; json_schema: { name: string; strict: true; schema: StrictSchema } } | { type: "json_object" };
  // OpenRouter takes max_tokens; Groq wants max_completion_tokens.
  max_tokens?: number;
  max_completion_tokens?: number;
};

export function chatRequestBody(opts: GenerateJsonOptions, maxTokensField: "max_tokens" | "max_completion_tokens"): ChatRequestBody {
  const body: ChatRequestBody = {
    model: opts.model,
    messages: [
      ...(opts.system ? [{ role: "system" as const, content: opts.system }] : []),
      { role: "user", content: opts.parts.map(toChatPart) },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: opts.schemaName, strict: true, schema: toStrictSchema(opts.schema) },
    },
  };
  body[maxTokensField] = opts.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;
  return body;
}

export async function chatCompletionJson<T>(
  provider: AiProvider,
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
  timeoutMs: number | undefined,
): Promise<GenerateJsonResult<T>> {
  const started = Date.now();
  const json = (await postJson(provider, url, headers, body, timeoutMs)) as ChatCompletionResponse;

  const choice = json.choices?.[0];
  if (choice?.error) {
    throw new AiError(provider, `Provider error: ${choice.error.message ?? "unknown"}`, choice.error.code);
  }
  return {
    data: parseJson<T>(provider, choice?.message?.content, choice?.finish_reason),
    usage: {
      inputTokens: json.usage?.prompt_tokens,
      outputTokens: json.usage?.completion_tokens,
      totalTokens: json.usage?.total_tokens,
      costUsd: json.usage?.cost,
    },
    model: json.model,
    latencyMs: Date.now() - started,
  };
}
