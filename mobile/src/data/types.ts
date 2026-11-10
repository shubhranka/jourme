// Domain shapes the screens render. Phase 1 fills them from mock.ts; later phases from Supabase.

export type Mood = 'happy' | 'grateful' | 'calm' | 'stressed';

export type Persona = 'cheerleader' | 'professor' | 'friend';

export type LocalDate = string; // YYYY-MM-DD in the writer's timezone

// Character offsets into Entry.transcript. Grammar fixes carry a replacement; vocab
// upgrades only mark the phrase (the suggestion lives in the matching note).
export type Correction =
  | { kind: 'grammar'; start: number; end: number; replacement: string }
  | { kind: 'vocab'; start: number; end: number };

export type NoteTag = { kind: 'grammar' | 'vocab'; label: string };

export type CoachNote = { title: string; body: string; tag: NoteTag };

// A coached entry, as the feedback screen shows it.
export type Entry = {
  id: string;
  number: number;
  localDate: LocalDate;
  mood: Mood;
  justListen: boolean;
  transcript: string;
  persona: Persona;
  coachReply: string;
  corrections: Correction[];
  notes: CoachNote[];
  nativeVersion: string | null;
  nativeScore: number | null; // null for Just Listen
  scoreDeltaVsLastWeek: number | null; // null without scores the week before
  avgSentenceLength: number;
};

export type WeekDayState = 'done' | 'today' | 'empty';

export type Streak = {
  days: number;
  writtenToday: boolean;
  week: WeekDayState[]; // Monday first
  today: LocalDate; // the journal day (rolls over at 4 AM)
};

export type Prompt = { id: number; text: string };

// uploading → uploaded → processing → ready | failed (the coach, Phase 4)
export type EntryStatus = 'uploading' | 'uploaded' | 'processing' | 'ready' | 'failed';

// A saved entry as listed on Today.
export type EntrySummary = {
  id: string;
  number: number;
  localDate: LocalDate;
  status: EntryStatus;
  justListen: boolean;
  pageCount: number;
  mood: Mood | null; // set once coached
  transcript: string | null;
  noteCount: number;
};

export type EntryPage = { index: number; url: string | null };

export type SavedEntry = EntrySummary & {
  pages: EntryPage[];
  heavy: boolean;
  safetyFlag: boolean;
  savedAt: string | null;
  // Why the last coaching attempt failed, when it's something the writer can act on.
  failReason: 'no_handwriting' | null;
  feedback: Entry | null; // when status is ready
};

export type TrackerStatus = 'needs-work' | 'improving' | 'new' | 'mastered';

export type TrackerRow = {
  name: string;
  status: TrackerStatus;
  count30d: number;
  severity: number; // 0..1, bar width for unmastered rows
};

export type CrutchWord = { word: string; count: number; alternatives: string[] };

export type Progress = {
  score: number;
  weeklyScores: number[]; // oldest first, last = this week
  tracker: TrackerRow[];
  crutchWords: CrutchWord[];
};

// The learner's settings (the `profiles` row).
export type Profile = {
  name: string;
  persona: Persona;
  nudgeTime: string; // HH:mm, in `timezone`
  nativeLanguage: string;
  learningGoal: string;
  offerJustListen: boolean;
  timezone: string; // IANA, e.g. "Asia/Kolkata"
};

export type ProfileStats = {
  entryCount: number;
  wordCount: number;
  pageCount: number;
};
