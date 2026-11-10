// Turns the model's corrections ("original" text spans) into character offsets in the
// transcript. Anything that can't be placed exactly, overlaps another correction, changes
// nothing, or touches a word the model couldn't read is dropped: an OCR misread must never be
// blamed on the writer.

import type { ModelCorrection } from "./schema.ts";

export type AlignedCorrection = ModelCorrection & { start: number; end: number };

export const MAX_CORRECTIONS = 6;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wordsOf(s: string): string[] {
  return s.toLowerCase().match(/[\p{L}\p{N}’']+/gu) ?? [];
}

// All [start, end) matches of `needle`: exact first, then ignoring case and runs of whitespace.
function findAll(haystack: string, needle: string): [number, number][] {
  const out: [number, number][] = [];
  for (let i = haystack.indexOf(needle); i !== -1; i = haystack.indexOf(needle, i + 1)) out.push([i, i + needle.length]);
  if (out.length) return out;
  const pattern = new RegExp(needle.trim().split(/\s+/).map(escapeRegExp).join("\\s+"), "giu");
  for (const m of haystack.matchAll(pattern)) out.push([m.index!, m.index! + m[0].length]);
  return out;
}

export function alignCorrections(
  transcript: string,
  corrections: ModelCorrection[],
  uncertainWords: string[],
): { aligned: AlignedCorrection[]; dropped: { correction: ModelCorrection; reason: string }[] } {
  const uncertain = new Set(uncertainWords.flatMap(wordsOf));
  const taken: [number, number][] = [];
  const aligned: AlignedCorrection[] = [];
  const dropped: { correction: ModelCorrection; reason: string }[] = [];

  for (const c of corrections) {
    const original = c.original.trim();
    if (!original) {
      dropped.push({ correction: c, reason: "empty" });
      continue;
    }
    if (c.replacement.trim() === original) {
      dropped.push({ correction: c, reason: "no change" });
      continue;
    }
    if (wordsOf(original).some((w) => uncertain.has(w))) {
      dropped.push({ correction: c, reason: "uncertain word" });
      continue;
    }
    if (aligned.length >= MAX_CORRECTIONS) {
      dropped.push({ correction: c, reason: "too many" });
      continue;
    }
    // The first free occurrence, so repeated words are corrected left to right.
    const spot = findAll(transcript, original).find(([s, e]) => taken.every(([ts, te]) => e <= ts || s >= te));
    if (!spot) {
      dropped.push({ correction: c, reason: "not in transcript" });
      continue;
    }
    taken.push(spot);
    aligned.push({ ...c, original: transcript.slice(spot[0], spot[1]), start: spot[0], end: spot[1] });
  }

  aligned.sort((a, b) => a.start - b.start);
  return { aligned, dropped };
}
