// Deterministic text measures: computed here, never asked of the model.

export type Metrics = {
  wordCount: number;
  sentenceCount: number;
  avgSentenceLength: number;
  uniqueWords: number;
  // Lexical variety that doesn't punish longer entries: unique words / √(words).
  guiraud: number;
  crutch: { word: string; count: number }[];
};

// Plain words learners lean on, with friendlier alternatives for the vocabulary vault.
export const CRUTCH_WORDS: Record<string, string[]> = {
  very: ["really", "so", "extremely"],
  really: ["truly", "genuinely"],
  good: ["great", "lovely", "solid"],
  nice: ["lovely", "pleasant", "kind"],
  bad: ["awful", "rough", "disappointing"],
  big: ["huge", "large", "major"],
  happy: ["glad", "delighted", "thrilled"],
  sad: ["upset", "down", "heartbroken"],
  then: ["afterwards", "later on", "after that"],
  thing: ["item", "detail", "matter"],
  things: ["items", "details", "stuff"],
  "a lot": ["plenty", "loads", "many"],
  got: ["received", "became", "bought"],
  just: ["only", "simply"],
  so: ["really", "therefore"],
};

const WORD = /[\p{L}\p{N}]+(?:[’'][\p{L}]+)*/gu;

export function words(text: string): string[] {
  return text.match(WORD) ?? [];
}

// Sentences end at . ! ? (or a line break between paragraphs); fragments without words don't count.
export function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+|\n\s*\n/)
    .map((s) => s.trim())
    .filter((s) => words(s).length > 0);
}

export function computeMetrics(text: string): Metrics {
  const ws = words(text).map((w) => w.toLowerCase().replace(/’/g, "'"));
  const sentenceCount = Math.max(1, sentences(text).length);
  const joined = ws.join(" ");
  const crutch = Object.keys(CRUTCH_WORDS)
    .map((word) => ({ word, count: joined.match(new RegExp(`(?:^| )${word}(?= |$)`, "g"))?.length ?? 0 }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
  const uniqueWords = new Set(ws).size;
  return {
    wordCount: ws.length,
    sentenceCount: ws.length ? sentenceCount : 0,
    avgSentenceLength: ws.length ? Math.round((ws.length / sentenceCount) * 10) / 10 : 0,
    uniqueWords,
    guiraud: ws.length ? Math.round((uniqueWords / Math.sqrt(ws.length)) * 100) / 100 : 0,
    crutch,
  };
}
