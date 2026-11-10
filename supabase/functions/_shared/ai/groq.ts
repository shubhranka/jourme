// Groq (OpenAI-compatible chat completions) adapter.
// Privacy: Groq keeps no inference data by default, apart from abuse-monitoring logs (up to
// 30 days); turn on Zero Data Retention at console.groq.com/settings/data-controls.

import { AiError, type GenerateJsonOptions, type GenerateJsonResult } from "./core.ts";
import { chatCompletionJson, chatRequestBody, toStrictSchema } from "./openai-compat.ts";

const URL = "https://api.groq.com/openai/v1/chat/completions";

export function groqBody(opts: GenerateJsonOptions) {
  const body = {
    ...chatRequestBody(opts, "max_completion_tokens"),
    ...(opts.temperature !== undefined && { temperature: opts.temperature }),
    // Qwen 3 reasons by default; transcribing and coaching don't need it, and on the free tier
    // (8k tokens a minute) the reasoning tokens would crowd out the answer.
    ...(opts.model.startsWith("qwen/") && { reasoning_effort: "none" }),
  };
  // With images attached, strict JSON-schema decoding on Groq returns garbage and a 400
  // (json_validate_failed; seen with qwen/qwen3.8-27b, reasoning on or off), while JSON mode
  // works. So with images: JSON mode, with the schema spelled out in the system prompt. The
  // shape isn't enforced then, so callers must check what comes back.
  if (opts.parts.some((p) => p.type === "image")) {
    const instruction =
      "Reply with only one JSON object that matches this JSON Schema exactly (every property is required). " +
      "Never answer in plain text, not even for a sad or difficult entry: anything you want to say goes inside the JSON.\n" +
      JSON.stringify(toStrictSchema(opts.schema));
    const [first, ...rest] = body.messages;
    body.messages =
      first?.role === "system"
        ? [{ role: "system", content: `${first.content}\n\n${instruction}` }, ...rest]
        : [{ role: "system", content: instruction }, ...body.messages];
    body.response_format = { type: "json_object" };
  }
  return body;
}

// Groq rejects a reply that isn't valid JSON (400 json_validate_failed). Qwen does that now and
// then, e.g. answering a sad entry in prose; a second try usually works.
export async function generateJsonGroq<T>(opts: GenerateJsonOptions): Promise<GenerateJsonResult<T>> {
  const call = () => chatCompletionJson<T>("groq", URL, { authorization: `Bearer ${opts.apiKey}` }, groqBody(opts), opts.timeoutMs);
  try {
    return await call();
  } catch (err) {
    if (err instanceof AiError && err.status === 400 && err.body?.includes("json_validate_failed")) return call();
    throw err;
  }
}
