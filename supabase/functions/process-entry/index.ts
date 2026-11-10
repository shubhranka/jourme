// POST /functions/v1/process-entry { entry_id }
// Claims the caller's uploaded entry (status → processing), answers 202 at once, then reads the
// pages with the AI model in the background and saves the coaching (→ ready) or the failure
// (→ failed). The app polls the entry until it's ready or failed.

import { encodeBase64 } from "jsr:@std/encoding@1/base64";
import { withSupabase } from "npm:@supabase/server@1.9.2";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

import { AiError, API_KEY_ENV, type AiUsage, type ContentPart, generateJson, providerFor } from "../_shared/ai/index.ts";
import { type AlignedCorrection, alignCorrections } from "../_shared/coach/align.ts";
import { computeMetrics, CRUTCH_WORDS } from "../_shared/coach/metrics.ts";
import { coachPrompt, type LearnerContext, listenPrompt, userInstruction } from "../_shared/coach/prompt.ts";
import { COACH_SCHEMA, type CoachResult, LISTEN_SCHEMA, type ListenResult } from "../_shared/coach/schema.ts";
import { nativeScore, SCORE_VERSION } from "../_shared/coach/score.ts";
import { ERROR_TYPE_SLUGS, type ErrorType, MOODS } from "../_shared/coach/taxonomy.ts";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

// Free models only (see docs). Override with the AI_MODEL secret.
const MODEL = Deno.env.get("AI_MODEL") || "dots-studio/dots-3-note-preview:free";
// The function's wall clock is 150 s on the free plan; leave room to save the result.
const AI_TIMEOUT_MS = 110_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return Response.json({ error: "method_not_allowed" }, { status: 405 });

    const body = await req.json().catch(() => null);
    const entryId: unknown = body?.entry_id;
    if (typeof entryId !== "string" || !UUID.test(entryId)) {
      return Response.json({ error: "bad_request" }, { status: 400 });
    }
    const userId = ctx.userClaims!.id;
    const apiKey = Deno.env.get(API_KEY_ENV[providerFor(MODEL)]);
    if (!apiKey) {
      console.error(`process-entry: ${API_KEY_ENV[providerFor(MODEL)]} is not set`);
      return Response.json({ error: "not_configured" }, { status: 500 });
    }

    const admin = ctx.supabaseAdmin;
    const claim = await admin.rpc("coach_claim", { p_user_id: userId, p_entry_id: entryId, p_model: MODEL }).single();
    if (claim.error) {
      if (claim.error.message === "daily_limit") return Response.json({ error: "daily_limit" }, { status: 429 });
      if (claim.error.message === "not_ready" || claim.error.message === "no_profile") {
        return Response.json({ error: "not_ready" }, { status: 409 });
      }
      console.error("process-entry: claim failed", claim.error);
      return Response.json({ error: "server_error" }, { status: 500 });
    }
    const { run_id, just_listen } = claim.data as { run_id: number; just_listen: boolean };

    EdgeRuntime.waitUntil(coach(admin, { userId, entryId, runId: run_id, justListen: just_listen, apiKey }));
    return Response.json({ status: "processing" }, { status: 202 });
  }),
};

type Job = { userId: string; entryId: string; runId: number; justListen: boolean; apiKey: string };

async function coach(admin: SupabaseClient, job: Job) {
  try {
    const [context, pages] = await Promise.all([loadLearner(admin, job.userId), loadPages(admin, job.entryId)]);
    const request = {
      apiKey: job.apiKey,
      model: MODEL,
      parts: [{ type: "text" as const, text: userInstruction(pages.length) }, ...pages],
      maxOutputTokens: 8192,
      timeoutMs: AI_TIMEOUT_MS,
    };

    let result: Record<string, unknown>;
    let usage: AiUsage;
    let latencyMs: number;
    if (job.justListen) {
      const res = await generateJson<ListenResult>({ ...request, system: listenPrompt(context), schema: LISTEN_SCHEMA, schemaName: "just_listen" });
      result = listenResult(res.data, context, res.model);
      ({ usage, latencyMs } = res);
    } else {
      const res = await generateJson<CoachResult>({ ...request, system: coachPrompt(context), schema: COACH_SCHEMA, schemaName: "coach" });
      result = await coachResult(admin, job.userId, res.data, context, res.model);
      ({ usage, latencyMs } = res);
    }

    const saved = await admin.rpc("coach_save", {
      p_run_id: job.runId,
      p_entry_id: job.entryId,
      p_result: result,
      p_usage: { input_tokens: usage.inputTokens, output_tokens: usage.outputTokens, cost_usd: usage.costUsd, latency_ms: latencyMs },
    });
    if (saved.error) throw saved.error;
  } catch (err) {
    const reason = err instanceof AiError ? `${err.message} ${err.body ?? ""}` : err instanceof Error ? err.message : JSON.stringify(err);
    console.error("process-entry: coaching failed", job.entryId, reason);
    await admin.rpc("coach_fail", { p_run_id: job.runId, p_entry_id: job.entryId, p_error: reason.slice(0, 1000) });
  }
}

async function loadLearner(admin: SupabaseClient, userId: string): Promise<LearnerContext> {
  const { data, error } = await admin.rpc("coach_context", { p_user_id: userId });
  if (error) throw error;
  return {
    name: data.name,
    nativeLanguage: data.native_language,
    learningGoal: data.learning_goal,
    persona: data.persona,
    recurring: data.recurring,
    crutchWords: data.crutch_words,
  };
}

async function loadPages(admin: SupabaseClient, entryId: string): Promise<ContentPart[]> {
  const { data, error } = await admin.from("entry_pages").select("storage_path").eq("entry_id", entryId).order("page_index");
  if (error) throw error;
  if (!data.length) throw new Error("The entry has no pages");
  return Promise.all(
    data.map(async (p: { storage_path: string }) => {
      const file = await admin.storage.from("pages").download(p.storage_path);
      if (file.error) throw file.error;
      return { type: "image" as const, mimeType: "image/jpeg", data: encodeBase64(new Uint8Array(await file.data.arrayBuffer())) };
    }),
  );
}

// The model is asked for strict JSON, but free models can still drift: keep only what fits.
// coach_error starts with this when the photos had no handwriting; the app explains it.
const NO_HANDWRITING = "no_handwriting";

function readingFields(data: ListenResult) {
  if (typeof data?.transcript !== "string" || !data.transcript.trim()) throw new Error(`${NO_HANDWRITING}: the model found no handwriting`);
  return {
    transcript: data.transcript.trim(),
    uncertain_words: Array.isArray(data.uncertain_words) ? data.uncertain_words.filter((w) => typeof w === "string") : [],
    mood: MOODS.includes(data.mood) ? data.mood : "calm",
    heavy: data.heavy === true,
    safety_flag: data.safety_flag === true,
    coach_reply: typeof data.coach_reply === "string" ? data.coach_reply.trim() : "",
  };
}

function listenResult(data: ListenResult, learner: LearnerContext, model: string | undefined) {
  const reading = readingFields(data);
  return {
    ...reading,
    coach_persona: learner.persona,
    word_count: computeMetrics(reading.transcript).wordCount,
    coach_model: model ?? MODEL,
  };
}

async function coachResult(admin: SupabaseClient, userId: string, data: CoachResult, learner: LearnerContext, model: string | undefined) {
  const reading = readingFields(data);
  const metrics = computeMetrics(reading.transcript);
  const corrections = (Array.isArray(data.corrections) ? data.corrections : []).filter(
    (c) => c && (c.kind === "grammar" || c.kind === "vocab") && typeof c.original === "string" && typeof c.replacement === "string",
  );
  const { aligned } = alignCorrections(reading.transcript, corrections, reading.uncertain_words);
  const grammar = aligned.filter((c) => c.kind === "grammar");
  const tags = await noteTags(admin, userId, aligned);

  const vocabFor = (word: string) =>
    aligned.filter((c) => c.kind === "vocab" && c.original.toLowerCase().includes(word)).map((c) => c.replacement.trim());

  return {
    ...reading,
    coach_persona: learner.persona,
    native_version: typeof data.native_version === "string" ? data.native_version.trim() : null,
    corrections: aligned.map((c, i) => ({
      kind: c.kind,
      start: c.start,
      end: c.end,
      original: c.original,
      replacement: c.replacement.trim(),
      error_type: knownType(c.error_type),
      note_title: c.note_title.trim(),
      note_body: c.note_body.trim(),
      tag: tags[i],
    })),
    native_score: nativeScore(Number(data.fluency) || 0, grammar.length, metrics).total,
    score_version: SCORE_VERSION,
    avg_sentence_len: metrics.avgSentenceLength,
    word_count: metrics.wordCount,
    correct_patterns: (Array.isArray(data.correct_patterns) ? data.correct_patterns : []).filter((t) => ERROR_TYPE_SLUGS.includes(t)),
    coach_model: model ?? MODEL,
    mistakes: grammar.map((c) => ({ error_type: knownType(c.error_type), original: c.original, corrected: c.replacement.trim() })),
    crutch: metrics.crutch.map(({ word, count }) => ({
      word,
      count,
      alternatives: [...new Set([...vocabFor(word), ...CRUTCH_WORDS[word]])].slice(0, 3),
    })),
  };
}

function knownType(t: string): ErrorType {
  return (ERROR_TYPE_SLUGS as string[]).includes(t) ? (t as ErrorType) : "other";
}

// "New" for a first-ever mistake type, "Seen N× this week" when it keeps coming back, "Seen
// before" otherwise; vocabulary notes go to the vault. Counts come from the database, not the model.
async function noteTags(admin: SupabaseClient, userId: string, corrections: AlignedCorrection[]): Promise<string[]> {
  const slugs = [...new Set(corrections.filter((c) => c.kind === "grammar").map((c) => knownType(c.error_type)))];
  const history = new Map<string, { total: number; this_week: number }>();
  if (slugs.length) {
    const { data, error } = await admin.rpc("coach_error_history", { p_user_id: userId, p_slugs: slugs });
    if (error) throw error;
    for (const row of data) history.set(row.slug, row);
  }
  const inEntry = (slug: string) => corrections.filter((c) => c.kind === "grammar" && knownType(c.error_type) === slug).length;
  return corrections.map((c) => {
    if (c.kind === "vocab") return "Vocab vault";
    const slug = knownType(c.error_type);
    const h = history.get(slug) ?? { total: 0, this_week: 0 };
    if (h.total === 0) return "New";
    const week = h.this_week + inEntry(slug);
    return week >= 2 ? `Seen ${week}× this week` : "Seen before";
  });
}
