// What the model returns. Strict mode (OpenRouter) needs every property listed in `required`.

import type { JsonSchema } from "../ai/index.ts";
import { TRANSCRIPTION_SCHEMA } from "../transcription.ts";
import { ERROR_TYPE_SLUGS, type ErrorType, type Mood, MOODS } from "./taxonomy.ts";

export type ModelCorrection = {
  kind: "grammar" | "vocab";
  original: string;
  replacement: string;
  error_type: ErrorType;
  note_title: string;
  note_body: string;
};

export type CoachResult = {
  transcript: string;
  uncertain_words: string[];
  mood: Mood;
  heavy: boolean;
  safety_flag: boolean;
  coach_reply: string;
  corrections: ModelCorrection[];
  native_version: string;
  correct_patterns: ErrorType[];
  fluency: number;
};

// Just Listen: the same reading, a longer reply, and no English feedback at all.
export type ListenResult = Pick<CoachResult, "transcript" | "uncertain_words" | "mood" | "heavy" | "safety_flag" | "coach_reply">;

const transcription = TRANSCRIPTION_SCHEMA.properties!;

const listenProperties: Record<string, JsonSchema> = {
  transcript: transcription.transcript,
  uncertain_words: transcription.uncertain_words,
  mood: { type: "string", enum: [...MOODS], description: "The main feeling. Use stressed for sad, angry or anxious too." },
  heavy: { type: "boolean", description: "True if the entry is about something painful (grief, illness, loneliness, distress)." },
  safety_flag: {
    type: "boolean",
    description: "True only if the writer mentions wanting to hurt themselves or someone else, or being in danger.",
  },
  coach_reply: { type: "string", description: "Your reply to what they wrote." },
};

export const LISTEN_SCHEMA: JsonSchema = {
  type: "object",
  properties: listenProperties,
  required: Object.keys(listenProperties),
};

const coachProperties: Record<string, JsonSchema> = {
  ...listenProperties,
  corrections: {
    type: "array",
    items: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["grammar", "vocab"] },
        original: { type: "string", description: "The exact words from your transcript, copied character for character." },
        replacement: { type: "string", description: "Grammar: the corrected words. Vocab: the better word or phrase." },
        error_type: { type: "string", enum: ERROR_TYPE_SLUGS },
        note_title: { type: "string", description: "Short, e.g. \"Past tense: eat → ate\"." },
        note_body: { type: "string", description: "One or two short sentences explaining why, in simple English." },
      },
      required: ["kind", "original", "replacement", "error_type", "note_title", "note_body"],
    },
  },
  native_version: { type: "string", description: "The whole entry as a fluent native speaker would write it." },
  correct_patterns: {
    type: "array",
    items: { type: "string", enum: ERROR_TYPE_SLUGS },
    description: "Error types the writer got right in this entry.",
  },
  fluency: { type: "integer", description: "0–100: how natural the writing sounds overall." },
};

export const COACH_SCHEMA: JsonSchema = {
  type: "object",
  properties: coachProperties,
  required: Object.keys(coachProperties),
};
