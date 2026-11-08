import assert from "node:assert/strict";
import { test } from "node:test";

import { containsPhrase, normalizeWords, wordErrorRate } from "./wer.ts";

test("normalizeWords ignores case, punctuation and line breaks but keeps apostrophes", () => {
  assert.deepEqual(normalizeWords("Today I eat\nrajma — it was VERY good!"), ["today", "i", "eat", "rajma", "it", "was", "very", "good"]);
  assert.deepEqual(normalizeWords("my grandmother’s food"), ["my", "grandmother's", "food"]);
});

test("identical text scores zero", () => {
  assert.equal(wordErrorRate("Today I eat rajma.", "today i eat rajma").wer, 0);
});

test("a silently corrected verb counts as a substitution", () => {
  const r = wordErrorRate("Today I eat rajma chawal", "Today I ate rajma chawal");
  assert.equal(r.edits, 1);
  assert.equal(r.wer, 1 / 5);
});

test("insertions and deletions are counted", () => {
  assert.equal(wordErrorRate("I miss my grandmother food", "I miss my grandmother's food").edits, 1);
  assert.equal(wordErrorRate("she was very happy", "she was happy").edits, 1);
  assert.equal(wordErrorRate("she was happy", "she was very very happy").edits, 2);
});

test("empty reference", () => {
  assert.equal(wordErrorRate("", "").wer, 0);
  assert.equal(wordErrorRate("", "extra").wer, 1);
});

test("containsPhrase matches whole consecutive words only", () => {
  assert.equal(containsPhrase("Today I eat rajma chawal.", "I eat"), true);
  assert.equal(containsPhrase("Today I ate rajma chawal.", "I eat"), false);
  assert.equal(containsPhrase("my grandmother's food", "grandmother food"), false);
  assert.equal(containsPhrase("my grandmother food", "Grandmother food"), true);
});
