// OpenRouter (OpenAI-compatible chat completions) adapter.

import type { GenerateJsonOptions, GenerateJsonResult } from "./core.ts";
import { chatCompletionJson, chatRequestBody } from "./openai-compat.ts";

export { toStrictSchema } from "./openai-compat.ts";

const URL = "https://openrouter.ai/api/v1/chat/completions";

export function openRouterBody(opts: GenerateJsonOptions) {
  return {
    ...chatRequestBody(opts, "max_tokens"),
    provider: {
      // Route only to endpoints that honour the JSON schema...
      require_parameters: true,
      // ...and that don't keep or train on prompts: these are private diary pages.
      data_collection: "deny",
    },
    // temperature is deliberately not sent: most current models on OpenRouter don't accept it,
    // and with require_parameters such a request would find no endpoint at all.
  };
}

export function generateJsonOpenRouter<T>(opts: GenerateJsonOptions): Promise<GenerateJsonResult<T>> {
  return chatCompletionJson<T>(
    "openrouter",
    URL,
    { authorization: `Bearer ${opts.apiKey}`, "x-openrouter-title": "Jourme" },
    openRouterBody(opts),
    opts.timeoutMs,
  );
}
