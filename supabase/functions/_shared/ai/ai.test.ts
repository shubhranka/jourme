import assert from "node:assert/strict";
import { test } from "node:test";

import type { GenerateJsonOptions, JsonSchema } from "./core.ts";
import { toGeminiSchema } from "./gemini.ts";
import { groqBody } from "./groq.ts";
import { generateJson, parseModelSpec, resolveAiConfig, retryDelayMs } from "./index.ts";
import { openRouterBody, toStrictSchema } from "./openrouter.ts";

const schema: JsonSchema = {
  type: "object",
  properties: {
    transcript: { type: "string", description: "verbatim" },
    notes: {
      type: "array",
      items: { type: "object", properties: { kind: { type: "string", enum: ["grammar", "vocab"] } }, required: ["kind"] },
    },
  },
  required: ["transcript", "notes"],
};

const request = (over: Partial<GenerateJsonOptions> = {}): GenerateJsonOptions => ({
  provider: "groq",
  apiKey: "test-key",
  model: "qwen/qwen3.8-27b",
  system: "rules",
  parts: [
    { type: "text", text: "Here is tonight's page." },
    { type: "image", mimeType: "image/jpeg", data: "AAAA" },
  ],
  schema,
  schemaName: "coach",
  ...over,
});

// Provider choice ------------------------------------------------------------------------------

test("config: OpenRouter's free model is the default", () => {
  const c = resolveAiConfig((n) => ({ OPENROUTER_API_KEY: "or-key" })[n]);
  assert.equal(c.provider, "openrouter");
  assert.equal(c.model, "dots-studio/dots-3-note-preview:free");
  assert.equal(c.apiKey, "or-key");
  assert.equal(c.warning, undefined);
});

test("config: AI_PROVIDER switches provider, model, key and limits together", () => {
  const env: Record<string, string> = { AI_PROVIDER: "Groq", GROQ_API_KEY: "gq-key", OPENROUTER_API_KEY: "or-key" };
  const c = resolveAiConfig((n) => env[n]);
  assert.deepEqual(c, { provider: "groq", model: "qwen/qwen3.8-27b", apiKey: "gq-key", maxImages: 3, maxOutputTokens: 3000 });
});

test("config: <PROVIDER>_MODEL overrides the default model", () => {
  const env: Record<string, string> = { AI_PROVIDER: "groq", GROQ_MODEL: "meta-models/muse-spark-open" };
  assert.equal(resolveAiConfig((n) => env[n]).model, "meta-models/muse-spark-open");
});

test("config: unresolved env(…) placeholders and blanks count as unset", () => {
  const env: Record<string, string> = { AI_PROVIDER: "env(AI_PROVIDER)", OPENROUTER_API_KEY: "  ", OPENROUTER_MODEL: "env(OPENROUTER_MODEL)" };
  const c = resolveAiConfig((n) => env[n]);
  assert.equal(c.provider, "openrouter");
  assert.equal(c.apiKey, undefined);
  assert.equal(c.model, "dots-studio/dots-3-note-preview:free");
  assert.equal(c.warning, undefined);
});

test("config: an unknown provider falls back to the default, with a warning", () => {
  const c = resolveAiConfig((n) => ({ AI_PROVIDER: "openai" })[n]);
  assert.equal(c.provider, "openrouter");
  assert.match(c.warning ?? "", /openai/);
});

test("parseModelSpec: provider prefix, or the old slash convention", () => {
  assert.deepEqual(parseModelSpec("groq:qwen/qwen3.8-27b"), { provider: "groq", model: "qwen/qwen3.8-27b" });
  assert.deepEqual(parseModelSpec("google/gemini-3.8-flash"), { provider: "openrouter", model: "google/gemini-3.8-flash" });
  assert.deepEqual(parseModelSpec("gemini-3.8-flash"), { provider: "gemini", model: "gemini-3.8-flash" });
});

// Request bodies ---------------------------------------------------------------------------------

test("groq with images: JSON mode, the schema in the system prompt, reasoning off for Qwen", () => {
  const body = groqBody(request({ maxOutputTokens: 3000 }));
  assert.equal(body.model, "qwen/qwen3.8-27b");
  assert.equal(body.max_completion_tokens, 3000);
  assert.equal(body.reasoning_effort, "none");
  assert.deepEqual(body.response_format, { type: "json_object" });
  const system = body.messages[0];
  assert.equal(system.role, "system");
  assert.ok(typeof system.content === "string" && system.content.startsWith("rules\n\nReply with only one JSON object"));
  assert.ok((system.content as string).includes("Never answer in plain text"));
  assert.ok((system.content as string).includes('"additionalProperties":false'), "the strict schema is spelled out");
  assert.deepEqual((body.messages[1].content as unknown[])[1], { type: "image_url", image_url: { url: "data:image/jpeg;base64,AAAA" } });
  assert.equal("provider" in body, false, "no OpenRouter routing options");
  assert.equal("reasoning_effort" in groqBody(request({ model: "openai/gpt-oss-20b" })), false, "only Qwen gets reasoning_effort: none");
});

test("groq without images: strict JSON schema, prompt untouched", () => {
  const body = groqBody(request({ parts: [{ type: "text", text: "Today I eat rice." }] }));
  assert.equal(body.response_format.type, "json_schema");
  assert.ok(body.response_format.type === "json_schema" && body.response_format.json_schema.strict);
  assert.deepEqual(body.messages[0], { role: "system", content: "rules" });
});

test("openrouter: max_tokens and the privacy routing options, no temperature", () => {
  const body = openRouterBody(request({ provider: "openrouter", model: "dots-studio/dots-3-note-preview:free", temperature: 0 }));
  assert.equal(body.max_tokens, 8192);
  assert.deepEqual(body.provider, { require_parameters: true, data_collection: "deny" });
  assert.equal("temperature" in body, false);
  assert.equal("max_completion_tokens" in body, false);
});

test("toGeminiSchema upper-cases types at every depth and keeps the rest", () => {
  assert.deepEqual(toGeminiSchema(schema), {
    type: "OBJECT",
    properties: {
      transcript: { type: "STRING", description: "verbatim" },
      notes: {
        type: "ARRAY",
        items: { type: "OBJECT", properties: { kind: { type: "STRING", enum: ["grammar", "vocab"] } }, required: ["kind"] },
      },
    },
    required: ["transcript", "notes"],
  });
});

test("toStrictSchema closes every object, including nested ones", () => {
  const strict = toStrictSchema(schema);
  assert.equal(strict.additionalProperties, false);
  assert.equal(strict.properties!.notes.items!.additionalProperties, false);
  assert.equal(strict.properties!.transcript.additionalProperties, undefined);
  assert.equal(strict.type, "object");
});

// Retries and a round trip ---------------------------------------------------------------------

test("retry-after: honoured when short, fail fast when long, backoff otherwise", () => {
  assert.equal(retryDelayMs("2", 1), 2000);
  assert.equal(retryDelayMs("0", 1), 250);
  assert.equal(retryDelayMs("45", 1), 45000);
  assert.equal(retryDelayMs("90", 1), null);
  assert.equal(retryDelayMs(null, 2), 2000);
  assert.equal(retryDelayMs("soon", 1), 1000);
});

test("groq round trip: sends to Groq with the key, retries a 429, parses JSON and usage", async () => {
  const realFetch = globalThis.fetch;
  const calls: { url: string; auth: string | null; body: Record<string, unknown> }[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, auth: new Headers(init.headers).get("authorization"), body: JSON.parse(init.body as string) });
    if (calls.length === 1) return new Response("slow down", { status: 429, headers: { "retry-after": "0" } });
    return Response.json({
      model: "qwen/qwen3.8-27b",
      choices: [{ message: { content: JSON.stringify({ transcript: "Today I eat rice.", notes: [] }) }, finish_reason: "stop" }],
      usage: { prompt_tokens: 2300, completion_tokens: 600, total_tokens: 2900 },
    });
  }) as typeof fetch;
  try {
    const res = await generateJson<{ transcript: string }>(request());
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, "https://api.groq.com/openai/v1/chat/completions");
    assert.equal(calls[0].auth, "Bearer test-key");
    assert.equal(res.data.transcript, "Today I eat rice.");
    assert.deepEqual(res.usage, { inputTokens: 2300, outputTokens: 600, totalTokens: 2900, costUsd: undefined });
    assert.equal(res.model, "qwen/qwen3.8-27b");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("groq: a reply that isn't valid JSON (json_validate_failed) gets one more try", async () => {
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    if (calls === 1) {
      return Response.json({ error: { code: "json_validate_failed", failed_generation: "I am so sorry." } }, { status: 400 });
    }
    return Response.json({ choices: [{ message: { content: '{"transcript": "ok", "notes": []}' } }] });
  }) as typeof fetch;
  try {
    const res = await generateJson<{ transcript: string }>(request());
    assert.equal(calls, 2);
    assert.equal(res.data.transcript, "ok");
  } finally {
    globalThis.fetch = realFetch;
  }
});
