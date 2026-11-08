import assert from "node:assert/strict";
import { test } from "node:test";

import { toGeminiSchema } from "./gemini.ts";
import { providerFor } from "./index.ts";
import { toStrictSchema } from "./openrouter.ts";
import type { JsonSchema } from "./core.ts";

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

test("providerFor routes vendor/model ids to OpenRouter", () => {
  assert.equal(providerFor("gemini-3.8-flash"), "gemini");
  assert.equal(providerFor("google/gemini-3.8-flash"), "openrouter");
  assert.equal(providerFor("anthropic/claude-sonnet-5.5"), "openrouter");
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
