// The Native-like score (0–100): the model's fluency rating blended with deterministic
// accuracy, complexity and vocabulary sub-scores. score_version is stored with every score, so
// this formula can change without corrupting the trend.

import type { Metrics } from "./metrics.ts";

export const SCORE_VERSION = 1;

const clamp = (x: number) => Math.max(0, Math.min(100, x));

export type ScoreParts = { fluency: number; accuracy: number; complexity: number; vocabulary: number; total: number };

export function nativeScore(fluencyRating: number, grammarMistakes: number, m: Metrics): ScoreParts {
  const fluency = clamp(Math.round(fluencyRating));
  // Each grammar mistake per 100 words costs 8 points.
  const accuracy = m.wordCount ? clamp(100 - (grammarMistakes / m.wordCount) * 100 * 8) : 0;
  // Sentences of about 15 words read naturally; very long ones lose a little.
  const avg = m.avgSentenceLength;
  const complexity = clamp(avg <= 15 ? (avg / 15) * 100 : 100 - (avg - 22) * 3);
  // Guiraud ~3 is very repetitive, ~8 is rich; crutch words beyond the first few cost a little.
  const crutchUses = m.crutch.reduce((n, c) => n + c.count, 0);
  const vocabulary = clamp(((m.guiraud - 3) / 5) * 100 - Math.max(0, crutchUses - 3) * 3);
  const total = Math.round(0.4 * fluency + 0.3 * accuracy + 0.15 * complexity + 0.15 * vocabulary);
  return {
    fluency,
    accuracy: Math.round(accuracy),
    complexity: Math.round(complexity),
    vocabulary: Math.round(vocabulary),
    total: clamp(total),
  };
}
