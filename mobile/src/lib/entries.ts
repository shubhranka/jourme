import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { EntryStatus, EntrySummary, ProfileStats, Prompt, SavedEntry, Streak, WeekDayState } from '@/data/types';

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

type SummaryRow = {
  id: string;
  entry_number: number | null;
  local_date: string;
  status: EntryStatus;
  just_listen: boolean;
};

function toSummary(row: SummaryRow, pageCount: number): EntrySummary {
  return {
    id: row.id,
    number: row.entry_number ?? 0,
    localDate: row.local_date,
    status: row.status,
    justListen: row.just_listen,
    pageCount,
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
        .select('id, entry_number, local_date, status, just_listen, entry_pages(count)')
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

export function useSavedEntry(id: string) {
  return useQuery({
    queryKey: entryKeys.entry(id),
    staleTime: 30 * 60 * 1000,
    queryFn: async (): Promise<SavedEntry | null> => {
      const { data, error } = await supabase
        .from('entries')
        .select('id, entry_number, local_date, status, just_listen, entry_pages(page_index, storage_path)')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      const pages = [...data.entry_pages].sort((a, b) => a.page_index - b.page_index);
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
        ...toSummary(data, pages.length),
        pages: pages.map((p, i) => ({ index: p.page_index, url: urls[i] })),
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
