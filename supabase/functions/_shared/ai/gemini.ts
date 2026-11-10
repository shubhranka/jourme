// Gemini API (generateContent) adapter.

import {
  AiError,
  DEFAULT_MAX_OUTPUT_TOKENS,
  type ContentPart,
  type GenerateJsonOptions,
  type GenerateJsonResult,
  type JsonSchema,
  parseJson,
  postJson,
} from "./core.ts";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

// response_schema uses an OpenAPI subset with upper-case type names.
type GeminiSchema = Omit<JsonSchema, "type" | "properties" | "items"> & {
  type: Uppercase<JsonSchema["type"]>;
  properties?: Record<string, GeminiSchema>;
  items?: GeminiSchema;
};

type GenerateContentResponse = {
  candidates?: {
    content?: { parts?: { text?: string; thought?: boolean }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
    totalTokenCount?: number;
  };
  modelVersion?: string;
};

export async function generateJsonGemini<T>(opts: GenerateJsonOptions): Promise<GenerateJsonResult<T>> {
  const started = Date.now();
  const json = (await postJson(
    "gemini",
    `${BASE_URL}/${opts.model}:generateContent`,
    { "x-goog-api-key": opts.apiKey },
    {
      ...(opts.system && { system_instruction: { parts: [{ text: opts.system }] } }),
      contents: [{ role: "user", parts: opts.parts.map(toGeminiPart) }],
      generation_config: {
        response_mime_type: "application/json",
        response_schema: toGeminiSchema(opts.schema),
        temperature: opts.temperature ?? 0.2,
        max_output_tokens: opts.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
      },
    },
    opts.timeoutMs,
  )) as GenerateContentResponse;

  if (json.promptFeedback?.blockReason) {
    throw new AiError("gemini", `Prompt blocked: ${json.promptFeedback.blockReason}`);
  }
  const candidate = json.candidates?.[0];
  const text = candidate?.content?.parts
    ?.filter((p) => !p.thought && p.text)
    .map((p) => p.text)
    .join("");
  const usage = json.usageMetadata ?? {};

  return {
    data: parseJson<T>("gemini", text, candidate?.finishReason),
    usage: {
      inputTokens: usage.promptTokenCount,
      outputTokens: (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0),
      totalTokens: usage.totalTokenCount,
    },
    model: json.modelVersion,
    latencyMs: Date.now() - started,
  };
}

function toGeminiPart(part: ContentPart) {
  return part.type === "text" ? { text: part.text } : { inline_data: { mime_type: part.mimeType, data: part.data } };
}

export function toGeminiSchema(schema: JsonSchema): GeminiSchema {
  const { type, properties, items, ...rest } = schema;
  return {
    ...rest,
    type: type.toUpperCase() as GeminiSchema["type"],
    ...(properties && {
      properties: Object.fromEntries(Object.entries(properties).map(([k, v]) => [k, toGeminiSchema(v)])),
    }),
    ...(items && { items: toGeminiSchema(items) }),
  };
}
