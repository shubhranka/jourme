import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CoachNote, Correction, Entry, EntryStatus, EntrySummary, Mood, Persona, ProfileStats, Prompt, SavedEntry, Streak, WeekDayState } from '@/data/types';

import { useUserId } from './auth';
import { supabase } from './supabase';

// Query keys carry the user id, so one user's data never shows for another.
export const entryKeys = {
  streak: (uid: string | undefined) => ['streak', uid] as const,
  prompt: (uid: string | undefined) => ['today-prompt', uid] as const,
  latest: (uid: string | undefined) => ['latest-entry', uid] as const,
  stats: (uid: string | undefined) => ['stats', uid] as const,
  entry: (id: string) => ['entry', id] as const,
};

export function useStreak() {
  const uid = useUserId();
  return useQuery({
    queryKey: entryKeys.streak(uid),
    enabled: !!uid,
    queryFn: async (): Promise<Streak> => {
      const { data, error } = await supabase.rpc('get_streak').single();
      if (error) throw error;
      return { days: data.days, writtenToday: data.written_today, week: data.week as WeekDayState[], today: data.today };
    },
  });
}

// Tonight's prompt: the server assigns one per journal day and keeps it until shuffled.
export function useTodayPrompt() {
  const uid = useUserId();
  return useQuery({
    queryKey: entryKeys.prompt(uid),
    enabled: !!uid,
    queryFn: async (): Promise<Prompt> => {
      const { data, error } = await supabase.rpc('get_today_prompt').single();
      if (error) throw error;
      return data;
    },
  });
}

export function useShufflePrompt() {
  const uid = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<Prompt> => {
      const { data, error } = await supabase.rpc('shuffle_today_prompt').single();
      if (error) throw error;
      return data;
    },
    onSuccess: (prompt) => queryClient.setQueryData(entryKeys.prompt(uid), prompt),
  });
}

export function useProfileStats() {
  const uid = useUserId();
  return useQuery({
    queryKey: entryKeys.stats(uid),
    enabled: !!uid,
    queryFn: async (): Promise<ProfileStats> => {
      const { data, error } = await supabase.rpc('get_profile_stats').single();
      if (error) throw error;
      return { entryCount: data.entry_count, wordCount: data.word_count, pageCount: data.page_count };
    },
  });
}

// How the coach stores each correction (entries.corrections); offsets index the transcript.
type CorrectionRow = {
  kind: 'grammar' | 'vocab';
  start: number;
  end: number;
  original: string;
  replacement: string;
  error_type: string;
  note_title: string;
  note_body: string;
  tag: string;
};

type SummaryRow = {
  id: string;
  entry_number: number | null;
  local_date: string;
  status: EntryStatus;
  just_listen: boolean;
  mood: Mood | null;
  transcript: string | null;
  corrections: unknown;
};

const corrections = (json: unknown): CorrectionRow[] => (Array.isArray(json) ? (json as CorrectionRow[]) : []);

// One note per distinct title: the coach may mark the same word twice.
function notesOf(rows: CorrectionRow[]): CoachNote[] {
  const seen = new Set<string>();
  return rows.flatMap((c) => {
    if (!c.note_title || seen.has(c.note_title)) return [];
    seen.add(c.note_title);
    return [{ title: c.note_title, body: c.note_body, tag: { kind: c.kind, label: c.tag } }];
  });
}

function toSummary(row: SummaryRow, pageCount: number): EntrySummary {
  return {
    id: row.id,
    number: row.entry_number ?? 0,
    localDate: row.local_date,
    status: row.status,
    justListen: row.just_listen,
    pageCount,
    mood: row.mood,
    transcript: row.transcript,
    noteCount: notesOf(corrections(row.corrections)).length,
  };
}

type FeedbackRow = SummaryRow & {
  coach_persona: Persona | null;
  coach_reply: string | null;
  native_version: string | null;
  native_score: number | null;
  score_delta: number | null;
  avg_sentence_len: number | null;
};

function toFeedback(row: FeedbackRow): Entry {
  const rows = corrections(row.corrections);
  return {
    id: row.id,
    number: row.entry_number ?? 0,
    localDate: row.local_date,
    mood: row.mood ?? 'calm',
    justListen: row.just_listen,
    transcript: row.transcript ?? '',
    persona: row.coach_persona ?? 'cheerleader',
    coachReply: row.coach_reply ?? '',
    corrections: rows.map(
      (c): Correction => (c.kind === 'grammar' ? { kind: 'grammar', start: c.start, end: c.end, replacement: c.replacement } : { kind: 'vocab', start: c.start, end: c.end }),
    ),
    notes: notesOf(rows),
    nativeVersion: row.native_version,
    nativeScore: row.native_score,
    scoreDeltaVsLastWeek: row.score_delta,
    avgSentenceLength: row.avg_sentence_len ?? 0,
  };
}

// The most recent saved entry (unfinished uploads aren't shown), or null.
export function useLatestEntry() {
  const uid = useUserId();
  return useQuery({
    queryKey: entryKeys.latest(uid),
    enabled: !!uid,
    queryFn: async (): Promise<EntrySummary | null> => {
      const { data, error } = await supabase
        .from('entries')
        .select('id, entry_number, local_date, status, just_listen, mood, transcript, corrections, entry_pages(count)')
        .neq('status', 'uploading')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ? toSummary(data, data.entry_pages[0]?.count ?? 0) : null;
    },
  });
}

// Signed photo links last an hour; refetch well before that.
const PAGE_URL_SECONDS = 60 * 60;

const ENTRY_COLUMNS =
  'id, entry_number, local_date, status, just_listen, mood, transcript, corrections, heavy, safety_flag, saved_at, coach_error, ' +
  'coach_persona, coach_reply, native_version, native_score, score_delta, avg_sentence_len, entry_pages(page_index, storage_path)';

// process-entry starts coach_error with a code when the writer can do something about it.
function failReason(error: string | null): SavedEntry['failReason'] {
  if (error?.startsWith('no_handwriting')) return { kind: 'no_handwriting' };
  const pages = error?.match(/^too_many_pages: .*?(\d+) pages/);
  if (pages) return { kind: 'too_many_pages', max: Number(pages[1]) };
  return null;
}

// Polls every 3 s while the coach is reading.
export function useSavedEntry(id: string) {
  return useQuery({
    queryKey: entryKeys.entry(id),
    staleTime: 30 * 60 * 1000,
    refetchInterval: (query) => (query.state.data?.status === 'processing' ? 3000 : false),
    queryFn: async (): Promise<SavedEntry | null> => {
      const { data, error } = await supabase.from('entries').select(ENTRY_COLUMNS).eq('id', id).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const row = data as unknown as FeedbackRow & {
        heavy: boolean;
        safety_flag: boolean;
        saved_at: string | null;
        coach_error: string | null;
        entry_pages: { page_index: number; storage_path: string }[];
      };

      const pages = [...row.entry_pages].sort((a, b) => a.page_index - b.page_index);
      let urls: (string | null)[] = pages.map(() => null);
      if (pages.length > 0) {
        const signed = await supabase.storage.from('pages').createSignedUrls(
          pages.map((p) => p.storage_path),
          PAGE_URL_SECONDS,
        );
        if (signed.error) throw signed.error;
        urls = signed.data.map((s) => s.signedUrl ?? null);
      }
      return {
        ...toSummary(row, pages.length),
        pages: pages.map((p, i) => ({ index: p.page_index, url: urls[i] })),
        heavy: row.heavy,
        safetyFlag: row.safety_flag,
        savedAt: row.saved_at,
        failReason: row.status === 'failed' ? failReason(row.coach_error) : null,
        feedback: row.status === 'ready' ? toFeedback(row) : null,
      };
    },
  });
}

// After a new entry is saved: the streak, Today's latest entry and the totals all change.
export function useEntrySaved() {
  const uid = useUserId();
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: entryKeys.streak(uid) }),
      queryClient.invalidateQueries({ queryKey: entryKeys.latest(uid) }),
      queryClient.invalidateQueries({ queryKey: entryKeys.stats(uid) }),
    ]);
}
