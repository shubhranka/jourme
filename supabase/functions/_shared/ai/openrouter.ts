// OpenRouter (OpenAI-compatible chat completions) adapter.

import {
  AiError,
  type ContentPart,
  type GenerateJsonOptions,
  type GenerateJsonResult,
  type JsonSchema,
  parseJson,
  postJson,
} from "./core.ts";

const URL = "https://openrouter.ai/api/v1/chat/completions";

type StrictSchema = Omit<JsonSchema, "properties" | "items"> & {
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

export async function generateJsonOpenRouter<T>(opts: GenerateJsonOptions): Promise<GenerateJsonResult<T>> {
  const started = Date.now();
  const json = (await postJson(
    "openrouter",
    URL,
    { authorization: `Bearer ${opts.apiKey}`, "x-openrouter-title": "Jourme" },
    {
      model: opts.model,
      messages: [
        ...(opts.system ? [{ role: "system", content: opts.system }] : []),
        { role: "user", content: opts.parts.map(toOpenRouterPart) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: opts.schemaName, strict: true, schema: toStrictSchema(opts.schema) },
      },
      provider: {
        // Route only to endpoints that honour the JSON schema...
        require_parameters: true,
        // ...and that don't keep or train on prompts: these are private diary pages.
        data_collection: "deny",
      },
      // temperature is deliberately not sent: most current models on OpenRouter don't accept it,
      // and with require_parameters such a request would find no endpoint at all.
    },
    opts.timeoutMs,
  )) as ChatCompletionResponse;

  const choice = json.choices?.[0];
  if (choice?.error) {
    throw new AiError("openrouter", `Provider error: ${choice.error.message ?? "unknown"}`, choice.error.code);
  }

  return {
    data: parseJson<T>("openrouter", choice?.message?.content, choice?.finish_reason),
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

function toOpenRouterPart(part: ContentPart) {
  return part.type === "text"
    ? { type: "text", text: part.text }
    : { type: "image_url", image_url: { url: `data:${part.mimeType};base64,${part.data}` } };
}

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
