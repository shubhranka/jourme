// Word error rate for comparing an OCR transcript against a hand-typed reference.
// Case, punctuation and line breaks are ignored; spelling and word choice are not.

export function normalizeWords(text: string): string[] {
  return text
    .normalize("NFKC")
    .replace(/[‘’ʼ]/g, "'")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}'\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export type WerResult = { wer: number; edits: number; refWords: number };

export function wordErrorRate(reference: string, hypothesis: string): WerResult {
  const ref = normalizeWords(reference);
  const hyp = normalizeWords(hypothesis);
  const edits = editDistance(ref, hyp);
  return { wer: ref.length ? edits / ref.length : hyp.length ? 1 : 0, edits, refWords: ref.length };
}

// True when every word of `phrase` appears consecutively in `text`, after normalisation.
export function containsPhrase(text: string, phrase: string): boolean {
  const needle = normalizeWords(phrase);
  if (!needle.length) return true;
  const hay = normalizeWords(text);
  outer: for (let i = 0; i + needle.length <= hay.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (hay[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

function editDistance(a: string[], b: string[]): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}
