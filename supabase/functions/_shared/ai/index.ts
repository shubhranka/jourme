// Entry point for structured-JSON model calls. The provider is picked from the model id:
// OpenRouter ids are "vendor/model" (e.g. "anthropic/claude-sonnet-5.5"), Gemini ids have no slash.

import type { AiProvider, GenerateJsonOptions, GenerateJsonResult } from "./core.ts";
import { generateJsonGemini } from "./gemini.ts";
import { generateJsonOpenRouter } from "./openrouter.ts";

export * from "./core.ts";

export const API_KEY_ENV: Record<AiProvider, string> = {
  gemini: "GEMINI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
};

export function providerFor(model: string): AiProvider {
  return model.includes("/") ? "openrouter" : "gemini";
}

export function generateJson<T>(opts: GenerateJsonOptions): Promise<GenerateJsonResult<T>> {
  return providerFor(opts.model) === "openrouter" ? generateJsonOpenRouter<T>(opts) : generateJsonGemini<T>(opts);
}
