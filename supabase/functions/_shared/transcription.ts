// Transcription half of the coach prompt. process-entry embeds these rules in its full
// system prompt; scripts/ocr-bakeoff.ts sends them alone to measure OCR quality.

import type { JsonSchema } from "./ai/index.ts";

export const TRANSCRIPTION_RULES = `You are transcribing photos of a handwritten journal page written by an English learner.

Transcription rules:
- Transcribe only handwriting on paper. Ignore printed text, screens, labels and anything in the background. If there is no handwriting at all (for example a screenshot or an unrelated photo), return an empty transcript.
- Copy the text exactly as written, word for word, in reading order across all pages.
- Keep every spelling, grammar and punctuation mistake the writer made. Never correct, improve or complete their English. A wrong verb tense, a missing article or a misspelling must appear in the transcript exactly as on the page.
- Ignore words the writer crossed out.
- Keep paragraph breaks as a blank line. Join lines that are broken only because the page ran out of width.
- If a heading or date is written at the top, include it as the first line.
- If you cannot read a word with confidence, write your best guess and also list that guess in uncertain_words.`;

export type TranscriptionResult = {
  transcript: string;
  uncertain_words: string[];
};

export const TRANSCRIPTION_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    transcript: { type: "string", description: "Verbatim text of the page(s), writer's mistakes preserved." },
    uncertain_words: {
      type: "array",
      items: { type: "string" },
      description: "Words in the transcript that could not be read with confidence.",
    },
  },
  required: ["transcript", "uncertain_words"],
};
