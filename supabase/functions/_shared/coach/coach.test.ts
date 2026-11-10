import assert from "node:assert/strict";
import { test } from "node:test";

import { alignCorrections } from "./align.ts";
import { computeMetrics, sentences } from "./metrics.ts";
import type { ModelCorrection } from "./schema.ts";
import { nativeScore } from "./score.ts";

const rajma =
  "Today I eat rajma chawal that I cooked by myself. It was very good. Then I called my mom and she was very happy. I miss the taste of my grandmother food.";

const fix = (original: string, replacement: string, kind: "grammar" | "vocab" = "grammar"): ModelCorrection => ({
  kind,
  original,
  replacement,
  error_type: kind === "grammar" ? "past_tense" : "crutch_word",
  note_title: "t",
  note_body: "b",
});

// align ------------------------------------------------------------------------------------

test("align: places each correction at its exact offsets, in reading order", () => {
  const { aligned, dropped } = alignCorrections(rajma, [fix("grandmother food", "grandmother's food"), fix("I eat", "I ate")], []);
  assert.deepEqual(dropped, []);
  assert.deepEqual(
    aligned.map((c) => [c.original, rajma.slice(c.start, c.end)]),
    [
      ["I eat", "I eat"],
      ["grandmother food", "grandmother food"],
    ],
  );
});

test("align: repeated phrases are corrected left to right without overlapping", () => {
  const { aligned } = alignCorrections(rajma, [fix("very", "really", "vocab"), fix("very", "so", "vocab")], []);
  assert.equal(aligned.length, 2);
  assert.ok(aligned[0].start < aligned[1].start);
  assert.equal(rajma.slice(aligned[1].start, aligned[1].end), "very");
  assert.ok(rajma.slice(0, aligned[1].start).includes("very good"));
});

test("align: tolerates case and whitespace differences but keeps the transcript's text", () => {
  const { aligned } = alignCorrections("I  went to Home yesterday.", [fix("went to home", "went home")], []);
  assert.equal(aligned.length, 1);
  assert.equal(aligned[0].original, "went to Home");
});

test("align: drops corrections it can't trust", () => {
  const { aligned, dropped } = alignCorrections(
    rajma,
    [
      fix("I eated", "I ate"), // not in the transcript
      fix("rajma chawal", "rajma chawal"), // changes nothing
      fix("my mom", "my mum"), // touches an uncertain word
      fix("", "x"),
    ],
    ["Mom"],
  );
  assert.equal(aligned.length, 0);
  assert.deepEqual(
    dropped.map((d) => d.reason),
    ["not in transcript", "no change", "uncertain word", "empty"],
  );
});

test("align: keeps at most 6 corrections", () => {
  const text = "a b c d e f g h";
  const many = "abcdefgh".split("").map((ch) => fix(ch, ch.toUpperCase()));
  const { aligned, dropped } = alignCorrections(text, many, []);
  assert.equal(aligned.length, 6);
  assert.equal(dropped.filter((d) => d.reason === "too many").length, 2);
});

// metrics ----------------------------------------------------------------------------------

test("metrics: words, sentences and average length", () => {
  const m = computeMetrics(rajma);
  assert.equal(m.wordCount, 32);
  assert.equal(m.sentenceCount, 4);
  assert.equal(m.avgSentenceLength, 8);
});

test("metrics: counts crutch words, including back-to-back repeats and phrases", () => {
  const m = computeMetrics("It was very very good. Then we ate a lot. Then we slept, very tired.");
  const byWord = Object.fromEntries(m.crutch.map((c) => [c.word, c.count]));
  assert.equal(byWord.very, 3);
  assert.equal(byWord.then, 2);
  assert.equal(byWord["a lot"], 1);
  assert.equal(byWord.good, 1);
  assert.equal(m.crutch[0].word, "very", "most used first");
});

test("metrics: paragraphs without a full stop still split; empty text is all zeros", () => {
  assert.deepEqual(sentences("27 Oct — best thing I ate\n\nToday I eat rice."), ["27 Oct — best thing I ate", "Today I eat rice."]);
  const empty = computeMetrics("   ");
  assert.equal(empty.wordCount, 0);
  assert.equal(empty.sentenceCount, 0);
  assert.equal(empty.avgSentenceLength, 0);
});

// score ------------------------------------------------------------------------------------

test("score: blends fluency with accuracy, complexity and vocabulary, within 0–100", () => {
  const m = computeMetrics(rajma);
  const s = nativeScore(70, 2, m);
  assert.equal(s.fluency, 70);
  assert.equal(s.accuracy, 50); // 2 mistakes in 32 words = 6.25 per 100 words → −50
  assert.equal(s.complexity, 53); // 8 words per sentence vs. the 15-word sweet spot
  assert.ok(s.total > 0 && s.total < 100);
  assert.equal(s.total, Math.round(0.4 * 70 + 0.3 * 50 + 0.15 * (8 / 15) * 100 + 0.15 * s.vocabulary));
});

test("score: fewer mistakes never lowers the score, and it stays in range", () => {
  const m = computeMetrics(rajma);
  assert.ok(nativeScore(70, 0, m).total >= nativeScore(70, 3, m).total);
  assert.equal(nativeScore(150, 0, m).fluency, 100);
  assert.equal(nativeScore(-5, 40, m).accuracy, 0);
  assert.ok(nativeScore(100, 0, computeMetrics("word ".repeat(200).trim() + ".")).complexity < 100, "one 200-word sentence is too long");
});
