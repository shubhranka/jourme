// Phase 1 fixture data, matching the copy in the design. Replaced by Supabase queries in Phases 2–5.

import type { Correction, Entry, LocalDate, Mood, ProfileStats, Progress, Streak } from './types';

export const MOCK_TODAY: LocalDate = '2026-10-27';

// The profile itself is real since Phase 2; these totals come from entries (Phase 3).
export const stats: ProfileStats = {
  entryCount: 142,
  wordCount: 9860,
  pageCount: 142,
};

export const streak: Streak = {
  days: 23,
  writtenToday: false,
  week: ['done', 'today', 'empty', 'empty', 'empty', 'empty', 'empty'],
};

export const prompts = [
  'What was the best thing you ate today?',
  'Who made you smile today, and why?',
  'What is one small thing you want to remember about this week?',
  'Describe a place you walked past today as if to a friend.',
  'What did you learn today that surprised you?',
];

// Offsets of the nth occurrence of `phrase` in `text`, so fixtures can't drift from their transcript.
function at(text: string, phrase: string, nth = 1): { start: number; end: number } {
  let start = -1;
  for (let i = 0; i < nth; i++) start = text.indexOf(phrase, start + 1);
  if (start < 0) throw new Error(`mock: "${phrase}" not found`);
  return { start, end: start + phrase.length };
}

const grammar = (text: string, phrase: string, replacement: string, nth?: number): Correction => ({
  kind: 'grammar',
  ...at(text, phrase, nth),
  replacement,
});
const vocab = (text: string, phrase: string, nth?: number): Correction => ({ kind: 'vocab', ...at(text, phrase, nth) });

const rajma =
  'Today I eat rajma chawal that I cooked by myself. It was very good. Then I called my mom and she was very happy. I miss the taste of my grandmother food.';

const navic =
  'I finally finished the NavIC documentary, it was so interesting how India build its own satellite system. I watch it with my brother and we talked about it for one hour after.';

const firstDay = 'First day at the new office. I was so nervous I forgot my lunch on the bus.';

export const entries: Record<string, Entry> = {
  '142': {
    id: '142',
    number: 142,
    localDate: '2026-10-27',
    mood: 'happy',
    justListen: false,
    transcript: rajma,
    persona: 'cheerleader',
    coachReply:
      "Rajma chawal you cooked yourself — that's a proper win! Making your grandmother's dish from memory is such a lovely way to keep her close.",
    corrections: [
      grammar(rajma, 'eat', 'ate'),
      vocab(rajma, 'very good'),
      vocab(rajma, 'Then'),
      grammar(rajma, 'grandmother', "grandmother's"),
    ],
    notes: [
      {
        title: 'Past tense: eat → ate',
        tag: { kind: 'grammar', label: 'Seen 3× this week' },
        body: 'You’re telling a story about today, so the verb moves to the past. Simple past of eat is ate.',
      },
      {
        title: 'Possessive: grandmother’s',
        tag: { kind: 'grammar', label: 'New' },
        body: 'Add ’s to show the food belongs to her: my grandmother’s food.',
      },
      {
        title: 'Crutch word: very ×2',
        tag: { kind: 'vocab', label: 'Vocab vault' },
        body: '“Very good” → delicious. “Very happy” → thrilled or delighted.',
      },
      {
        title: 'Crutch word: then',
        tag: { kind: 'vocab', label: 'Vocab vault' },
        body: 'Swap in afterwards or later on to vary how your sentences start.',
      },
    ],
    nativeVersion:
      'Tonight I made rajma chawal all by myself, and it turned out delicious. Afterwards I called Mum, who was thrilled to hear about it. I really miss my grandmother’s cooking.',
    nativeScore: 72,
    scoreDeltaVsLastWeek: 4,
    avgSentenceLength: 8,
  },
  '141': {
    id: '141',
    number: 141,
    localDate: '2026-10-26',
    mood: 'grateful',
    justListen: false,
    transcript: navic,
    persona: 'cheerleader',
    coachReply:
      'A whole country building its own sky-map is a brilliant thing to geek out over! Talking it through with your brother for an hour sounds like the best kind of evening.',
    corrections: [grammar(navic, 'build', 'built'), grammar(navic, 'watch', 'watched'), vocab(navic, 'so interesting')],
    notes: [
      {
        title: 'Past tense: build → built',
        tag: { kind: 'grammar', label: 'Seen 2× this week' },
        body: 'The system was already built, so use the past: India built its own system.',
      },
      {
        title: 'Past tense: watch → watched',
        tag: { kind: 'grammar', label: 'Seen 2× this week' },
        body: 'Regular verbs take -ed in the past: watched.',
      },
      {
        title: 'Upgrade: so interesting',
        tag: { kind: 'vocab', label: 'Vocab vault' },
        body: 'Try fascinating or eye-opening for something that really caught your attention.',
      },
    ],
    nativeVersion:
      'I finally finished the NavIC documentary — it was fascinating to see how India built its own satellite navigation system. I watched it with my brother, and we talked about it for an hour afterwards.',
    nativeScore: 68,
    scoreDeltaVsLastWeek: 2,
    avgSentenceLength: 15.5,
  },
  '17': {
    id: '17',
    number: 17,
    localDate: '2025-10-27',
    mood: 'stressed',
    justListen: false,
    transcript: firstDay,
    persona: 'cheerleader',
    coachReply:
      'A first day is nerve-racking enough without losing your lunch to the bus! I hope the new office was kinder to you by the afternoon.',
    corrections: [],
    notes: [],
    nativeVersion: firstDay,
    nativeScore: 58,
    scoreDeltaVsLastWeek: 0,
    avgSentenceLength: 8,
  },
};

export const latestEntryId = '141';
export const onThisDayEntryId = '17';
export const scanResultEntryId = '142';

// October 2026 moods, one letter per day from the 1st; '-' = no entry.
const OCTOBER = 'HC-GSSCHGHCSHGGCHSSCGHHCGGH';
const LETTER: Record<string, Mood> = { H: 'happy', G: 'grateful', C: 'calm', S: 'stressed' };

export const moodsByDate: Record<LocalDate, Mood> = {
  '2025-10-27': 'stressed',
  ...Object.fromEntries(
    [...OCTOBER]
      .map((ch, i) => [`2026-10-${String(i + 1).padStart(2, '0')}`, LETTER[ch]] as const)
      .filter(([, mood]) => mood),
  ),
};

export const progress: Progress = {
  score: 72,
  weeklyScores: [61, 62, 64, 63, 66, 68, 68, 72],
  tracker: [
    { name: 'Articles (a / the)', status: 'needs-work', count30d: 11, severity: 0.85 },
    { name: 'Past tense', status: 'improving', count30d: 3, severity: 0.4 },
    { name: 'Possessive ’s', status: 'new', count30d: 1, severity: 0.15 },
    { name: 'Prepositions (in / on)', status: 'mastered', count30d: 0, severity: 1 },
  ],
  crutchWords: [
    { word: 'very', count: 18, alternatives: ['really', 'thrilled', 'delicious'] },
    { word: 'good', count: 9, alternatives: ['lovely', 'solid', 'delightful'] },
    { word: 'then', count: 7, alternatives: ['afterwards', 'later on'] },
  ],
};
