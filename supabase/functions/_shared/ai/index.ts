// Entry point for structured-JSON model calls. The caller names the provider (see config.ts:
// AI_PROVIDER picks it for the app).

import type { AiProvider, GenerateJsonOptions, GenerateJsonResult } from "./core.ts";
import { PROVIDER_SETTINGS } from "./config.ts";
import { generateJsonGemini } from "./gemini.ts";
import { generateJsonGroq } from "./groq.ts";
import { generateJsonOpenRouter } from "./openrouter.ts";

export * from "./config.ts";
export * from "./core.ts";

export const API_KEY_ENV: Record<AiProvider, string> = {
  openrouter: PROVIDER_SETTINGS.openrouter.keyEnv,
  groq: PROVIDER_SETTINGS.groq.keyEnv,
  gemini: PROVIDER_SETTINGS.gemini.keyEnv,
};

export function generateJson<T>(opts: GenerateJsonOptions): Promise<GenerateJsonResult<T>> {
  switch (opts.provider) {
    case "openrouter":
      return generateJsonOpenRouter<T>(opts);
    case "groq":
      return generateJsonGroq<T>(opts);
    case "gemini":
      return generateJsonGemini<T>(opts);
  }
}
