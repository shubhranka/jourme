import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCalendars } from 'expo-localization';
import { useEffect, useRef } from 'react';

import type { Profile } from '@/data/types';

import { useAuth } from './auth';
import type { Database } from './database.types';
import { supabase } from './supabase';

type Row = Database['public']['Tables']['profiles']['Row'];
type RowInsert = Database['public']['Tables']['profiles']['Insert'];
type RowUpdate = Database['public']['Tables']['profiles']['Update'];

const profileKey = (userId: string | undefined) => ['profile', userId] as const;
const updateKey = ['profile', 'update'] as const;

function fromRow(row: Row): Profile {
  return {
    name: row.display_name,
    persona: row.persona,
    nudgeTime: row.nudge_time.slice(0, 5), // "21:30:00"
    nativeLanguage: row.native_language,
    learningGoal: row.learning_goal,
    offerJustListen: row.offer_just_listen,
    timezone: row.timezone,
  };
}

function toInsert(userId: string, p: Profile): RowInsert {
  return {
    id: userId,
    display_name: p.name.trim(),
    persona: p.persona,
    nudge_time: p.nudgeTime,
    native_language: p.nativeLanguage.trim(),
    learning_goal: p.learningGoal.trim(),
    offer_just_listen: p.offerJustListen,
    timezone: p.timezone,
  };
}

function toUpdate(p: Partial<Profile>): RowUpdate {
  const row: RowUpdate = {};
  if (p.name !== undefined) row.display_name = p.name.trim();
  if (p.persona !== undefined) row.persona = p.persona;
  if (p.nudgeTime !== undefined) row.nudge_time = p.nudgeTime;
  if (p.nativeLanguage !== undefined) row.native_language = p.nativeLanguage.trim();
  if (p.learningGoal !== undefined) row.learning_goal = p.learningGoal.trim();
  if (p.offerJustListen !== undefined) row.offer_just_listen = p.offerJustListen;
  if (p.timezone !== undefined) row.timezone = p.timezone;
  return row;
}

// data: undefined while loading, null until the user finishes onboarding.
export function useProfileQuery(userId: string | undefined) {
  return useQuery({
    queryKey: profileKey(userId),
    enabled: userId !== undefined,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId!).maybeSingle();
      if (error) throw error;
      return data ? fromRow(data) : null;
    },
  });
}

// Behind the onboarding gate this is always loaded. It can be briefly undefined while signing
// out, before the signed-in screens unmount, so callers render nothing in that case.
export function useProfile(): Profile | undefined {
  const { session } = useAuth();
  return useProfileQuery(session?.user.id).data ?? undefined;
}

export function useCreateProfile() {
  const queryClient = useQueryClient();
  const userId = useAuth().session?.user.id;
  return useMutation({
    mutationFn: async (profile: Profile) => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await supabase.from('profiles').insert(toInsert(userId, profile));
      // 23505: a retry after a lost response finds the row already created.
      if (error && error.code !== '23505') throw error;
    },
    // Awaited, so the caller stays busy until the profile is loaded and the app opens.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileKey(userId) }),
  });
}

// Optimistic: the change shows at once and is rolled back if the save fails.
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const userId = useAuth().session?.user.id;
  const key = profileKey(userId);
  return useMutation({
    mutationKey: updateKey,
    mutationFn: async (patch: Partial<Profile>) => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await supabase.from('profiles').update(toUpdate(patch)).eq('id', userId).select('id').single();
      if (error) throw error;
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Profile | null>(key);
      if (previous) queryClient.setQueryData<Profile>(key, { ...previous, ...patch });
      return { previous };
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    // Refetch once the last of several quick changes lands, so the earlier ones can't flicker back.
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: updateKey }) === 1) return queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

// expo-localization can give null (web) or an offset like "GMT+1" that Postgres rejects, so fall
// back to the JS engine's zone, then UTC.
export function deviceTimeZone(calendarZone: string | null | undefined): string {
  const candidates = [calendarZone, Intl.DateTimeFormat().resolvedOptions().timeZone];
  return candidates.find((tz): tz is string => !!tz && (tz === 'UTC' || /^[A-Za-z]+(\/[A-Za-z0-9_+-]+)+$/.test(tz))) ?? 'UTC';
}

export function useDeviceTimeZone(): string {
  return deviceTimeZone(useCalendars()[0]?.timeZone);
}

// Keeps profiles.timezone in step with the device, so entry dates and the nudge follow a user who
// travels. Tries each new zone once per launch, so a failing save can't loop.
export function useTimezoneSync(profile: Profile | null | undefined) {
  const deviceZone = useDeviceTimeZone();
  const { mutate } = useUpdateProfile();
  const attempted = useRef<string | null>(null);

  useEffect(() => {
    if (!profile || profile.timezone === deviceZone || attempted.current === deviceZone) return;
    attempted.current = deviceZone;
    mutate({ timezone: deviceZone });
  }, [profile, deviceZone, mutate]);
}

// Error copy for profile saves.
export function saveErrorMessage(error: unknown): string {
  const message = (error as { message?: string } | null)?.message ?? '';
  if (/fetch|network/i.test(message)) return 'Couldn’t save. Check your connection and try again.';
  return 'Couldn’t save that. Please try again.';
}
