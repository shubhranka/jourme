// Which AI provider and model the coach uses, from the environment:
//   AI_PROVIDER = openrouter (default) | groq | gemini
//   <PROVIDER>_API_KEY, and optionally <PROVIDER>_MODEL to override the default model.
// The project uses free models only; the defaults below are free (Gemini's needs billing for
// privacy, so it isn't the default).

import type { AiProvider } from "./core.ts";

export const PROVIDERS: readonly AiProvider[] = ["openrouter", "groq", "gemini"];
export const DEFAULT_PROVIDER: AiProvider = "openrouter";

type ProviderSettings = {
  keyEnv: string;
  modelEnv: string;
  defaultModel: string;
  // Images one request may carry: an entry with more pages can't be read by this provider.
  maxImages: number;
  // Reply cap, reasoning included. Groq's free tier allows 8k tokens a minute, prompt included.
  maxOutputTokens: number;
};

export const PROVIDER_SETTINGS: Record<AiProvider, ProviderSettings> = {
  openrouter: {
    keyEnv: "OPENROUTER_API_KEY",
    modelEnv: "OPENROUTER_MODEL",
    defaultModel: "dots-studio/dots-3-note-preview:free",
    maxImages: 10,
    maxOutputTokens: 8192,
  },
  groq: {
    keyEnv: "GROQ_API_KEY",
    modelEnv: "GROQ_MODEL",
    defaultModel: "qwen/qwen3.8-27b",
    maxImages: 3,
    // Prompt + schema + one image is ~4–5k tokens, and the free tier allows 8k a minute in all.
    maxOutputTokens: 3000,
  },
  gemini: {
    keyEnv: "GEMINI_API_KEY",
    modelEnv: "GEMINI_MODEL",
    defaultModel: "gemini-3.8-flash",
    maxImages: 10,
    maxOutputTokens: 8192,
  },
};

export type AiConfig = {
  provider: AiProvider;
  model: string;
  apiKey: string | undefined;
  maxImages: number;
  maxOutputTokens: number;
  warning?: string;
};

// Empty values and the Supabase CLI's unresolved "env(NAME)" placeholders count as unset.
function clean(value: string | undefined): string | undefined {
  const v = value?.trim();
  return !v || /^env\(.*\)$/.test(v) ? undefined : v;
}

export function resolveAiConfig(getEnv: (name: string) => string | undefined): AiConfig {
  const requested = clean(getEnv("AI_PROVIDER"))?.toLowerCase();
  const known = PROVIDERS.find((p) => p === requested);
  const provider = known ?? DEFAULT_PROVIDER;
  const settings = PROVIDER_SETTINGS[provider];
  return {
    provider,
    model: clean(getEnv(settings.modelEnv)) ?? settings.defaultModel,
    apiKey: clean(getEnv(settings.keyEnv)),
    maxImages: settings.maxImages,
    maxOutputTokens: settings.maxOutputTokens,
    ...(requested && !known && {
      warning: `AI_PROVIDER="${requested}" isn't one of ${PROVIDERS.join(", ")}; using ${DEFAULT_PROVIDER}.`,
    }),
  };
}

// For tools that compare models across providers: "groq:qwen/qwen3.8-27b". Without a prefix,
// ids with a slash are OpenRouter's and the rest Gemini's (the old convention).
export function parseModelSpec(spec: string): { provider: AiProvider; model: string } {
  const match = /^(openrouter|groq|gemini):(.+)$/.exec(spec.trim());
  if (match) return { provider: match[1] as AiProvider, model: match[2] };
  return { provider: spec.includes("/") ? "openrouter" : "gemini", model: spec.trim() };
}
