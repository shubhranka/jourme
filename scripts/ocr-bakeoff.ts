// Phase 0 OCR bake-off: run real notebook pages through several models and measure how
// faithfully each transcribes them. See scripts/fixtures/README.md for the fixture layout.
// Model ids with a slash go through OpenRouter, the rest straight to the Gemini API.
//
//   npm run bakeoff
//   npm run bakeoff -- --models gemini-3.8-flash,anthropic/claude-sonnet-5.5 --only day-01

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { parseArgs } from "node:util";

import { AiError, API_KEY_ENV, type AiUsage, type ContentPart, generateJson, providerFor } from "../supabase/functions/_shared/ai/index.ts";
import { TRANSCRIPTION_RULES, TRANSCRIPTION_SCHEMA, type TranscriptionResult } from "../supabase/functions/_shared/transcription.ts";
import { containsPhrase, wordErrorRate } from "./lib/wer.ts";

const PAGES_DIR = join(import.meta.dirname, "fixtures", "pages");
const OUT_DIR = join(import.meta.dirname, "out");
const GEMINI_MODELS = ["gemini-4-argon", "gemini-3.8-flash"];
const OPENROUTER_MODELS = ["anthropic/claude-sonnet-5.5", "openai/gpt-6.1-sol"];
const MAX_WER = 0.03;
const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
};

type Fixture = { name: string; images: string[]; reference: string; mistakes: string[] };

type Run = {
  model: string;
  fixture: string;
  wer?: number;
  missedMistakes?: string[];
  uncertain?: number;
  latencyMs?: number;
  usage?: AiUsage;
  error?: string;
};

const { values: args } = parseArgs({
  options: {
    models: { type: "string" },
    only: { type: "string" },
  },
});

const models = args.models ? args.models.split(",").map((m) => m.trim()).filter(Boolean) : defaultModels();
if (!models.length) {
  console.error("Set GEMINI_API_KEY and/or OPENROUTER_API_KEY. Copy .env.example to .env and add a key.");
  process.exit(1);
}
for (const model of models) {
  if (!apiKeyFor(model)) {
    console.error(`${model} needs ${API_KEY_ENV[providerFor(model)]}, which is not set.`);
    process.exit(1);
  }
}

const fixtures = (await loadFixtures()).filter((f) => !args.only || f.name === args.only);
if (!fixtures.length) {
  console.error(`No fixtures found in ${PAGES_DIR}. See scripts/fixtures/README.md.`);
  process.exit(1);
}

console.log(`${fixtures.length} entries × ${models.length} models\n`);
const runs: Run[] = [];
for (const fixture of fixtures) {
  for (const model of models) {
    const run = await transcribe(model, fixture);
    runs.push(run);
    console.log(formatRun(run));
  }
}
printSummary(runs);

function defaultModels(): string[] {
  const gemini = !!process.env.GEMINI_API_KEY;
  const openrouter = !!process.env.OPENROUTER_API_KEY;
  return [
    ...(gemini ? GEMINI_MODELS : []),
    // Without a Gemini key, compare the same Gemini models through OpenRouter.
    ...(openrouter ? [...(gemini ? [] : GEMINI_MODELS.map((m) => `google/${m}`)), ...OPENROUTER_MODELS] : []),
  ];
}

function apiKeyFor(model: string): string | undefined {
  return process.env[API_KEY_ENV[providerFor(model)]];
}

async function loadFixtures(): Promise<Fixture[]> {
  const files = await readdir(PAGES_DIR).catch(() => [] as string[]);
  const groups = new Map<string, string[]>();
  for (const file of files.sort()) {
    const ext = extname(file).toLowerCase();
    if (!MIME_TYPES[ext]) continue;
    // "day-01.2.jpg" is page 2 of entry "day-01".
    const name = file.slice(0, -ext.length).replace(/\.\d+$/, "");
    groups.set(name, [...(groups.get(name) ?? []), file]);
  }

  const out: Fixture[] = [];
  for (const [name, images] of groups) {
    const reference = await readFile(join(PAGES_DIR, `${name}.txt`), "utf8").catch(() => null);
    if (reference === null) {
      console.warn(`Skipping ${name}: no ${name}.txt reference transcript`);
      continue;
    }
    const mistakesFile = await readFile(join(PAGES_DIR, `${name}.mistakes.txt`), "utf8").catch(() => "");
    const mistakes = mistakesFile.split("\n").map((l) => l.trim()).filter(Boolean);
    out.push({ name, images, reference, mistakes });
  }
  return out;
}

async function transcribe(model: string, fixture: Fixture): Promise<Run> {
  const images: ContentPart[] = await Promise.all(
    fixture.images.map(async (file) => ({
      type: "image" as const,
      mimeType: MIME_TYPES[extname(file).toLowerCase()],
      data: (await readFile(join(PAGES_DIR, file))).toString("base64"),
    })),
  );
  const pages = images.length === 1 ? "one page" : `${images.length} pages, in order`;

  try {
    const res = await generateJson<TranscriptionResult>({
      apiKey: apiKeyFor(model)!,
      model,
      system: TRANSCRIPTION_RULES,
      parts: [{ type: "text", text: `Transcribe this journal entry (${pages}).` }, ...images],
      schema: TRANSCRIPTION_SCHEMA,
      schemaName: "transcription",
      temperature: 0,
    });
    const { transcript, uncertain_words } = res.data;

    // "anthropic/claude-sonnet-5.5" is stored as out/anthropic/claude-sonnet-5.5/.
    await mkdir(join(OUT_DIR, model), { recursive: true });
    await writeFile(join(OUT_DIR, model, `${fixture.name}.json`), JSON.stringify(res, null, 2));

    return {
      model,
      fixture: fixture.name,
      wer: wordErrorRate(fixture.reference, transcript).wer,
      missedMistakes: fixture.mistakes.filter((m) => !containsPhrase(transcript, m)),
      uncertain: uncertain_words.length,
      latencyMs: res.latencyMs,
      usage: res.usage,
    };
  } catch (err) {
    const msg = err instanceof AiError ? `${err.message} ${err.body ?? ""}` : String(err);
    return { model, fixture: fixture.name, error: msg.replace(/\s+/g, " ").trim().slice(0, 240) };
  }
}

function formatRun(r: Run): string {
  const head = `${r.fixture.padEnd(16)} ${r.model.padEnd(30)}`;
  if (r.error) return `${head} ERROR ${r.error}`;
  const missed = r.missedMistakes!.length ? `  corrected: ${r.missedMistakes!.map((m) => `"${m}"`).join(", ")}` : "";
  return `${head} WER ${pct(r.wer!).padStart(6)}  ${(r.latencyMs! / 1000).toFixed(1)}s  uncertain ${r.uncertain}${missed}`;
}

function printSummary(all: Run[]) {
  console.log(`\n${"Model".padEnd(30)} WER mean  WER max  Silent fixes  Errors  Latency  Tokens/entry  Cost/entry  Verdict`);
  for (const model of models) {
    const rs = all.filter((r) => r.model === model);
    const ok = rs.filter((r) => !r.error);
    const errors = rs.length - ok.length;
    const wers = ok.map((r) => r.wer!);
    const meanWer = wers.length ? wers.reduce((a, b) => a + b, 0) / wers.length : NaN;
    const silent = ok.filter((r) => r.missedMistakes!.length).length;
    const latency = mean(ok.map((r) => r.latencyMs!)) / 1000;
    const tokens = mean(ok.map((r) => r.usage?.totalTokens ?? 0));
    const costs = ok.map((r) => r.usage?.costUsd).filter((c) => c !== undefined);
    const pass = ok.length > 0 && errors === 0 && meanWer <= MAX_WER && silent === 0;
    console.log(
      [
        model.padEnd(30),
        pct(meanWer).padStart(8),
        pct(Math.max(...wers)).padStart(8),
        String(silent).padStart(13),
        String(errors).padStart(7),
        (Number.isFinite(latency) ? `${latency.toFixed(1)}s` : "–").padStart(8),
        (Number.isFinite(tokens) ? String(Math.round(tokens)) : "–").padStart(13),
        (costs.length ? `$${mean(costs).toFixed(4)}` : "–").padStart(11),
        pass ? "  PASS" : "  FAIL",
      ].join(" "),
    );
  }
  console.log(`\nPASS = no errors, mean WER ≤ ${pct(MAX_WER)}, and no writer's mistake silently corrected. Raw outputs: scripts/out/`);
  console.log("Cost is reported by OpenRouter only; for direct Gemini calls, price the tokens from Google's pricing page.");
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
}

function pct(x: number): string {
  return Number.isFinite(x) ? `${(x * 100).toFixed(1)}%` : "–";
}
