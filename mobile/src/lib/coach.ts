import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { entryKeys, useEntrySaved } from './entries';
import { supabase } from './supabase';

export class CoachError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

// Asks the process-entry function to read an uploaded (or failed) entry. It answers at once;
// the entry then shows "processing" until the coach is done.
export async function startCoaching(entryId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('process-entry', { body: { entry_id: entryId } });
  if (!error) return;
  if (error instanceof FunctionsHttpError) {
    const body = await (error.context as Response).json().catch(() => ({}));
    throw new CoachError(typeof body?.error === 'string' ? body.error : 'server_error');
  }
  if (error instanceof FunctionsFetchError) throw new CoachError('network');
  throw error;
}

export function coachErrorMessage(error: unknown): string {
  switch (error instanceof CoachError ? error.code : '') {
    case 'daily_limit':
      return 'Coach has read 5 pages for you today. Come back tomorrow for more.';
    case 'network':
      return 'Couldn’t reach Jourme. Check your connection and try again.';
    case 'not_ready':
      return 'Coach is already on it.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

export function useStartCoaching(entryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => startCoaching(entryId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: entryKeys.entry(entryId) }),
  });
}

export function useSaveToVault(entryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('save_entry_to_vault', { p_entry_id: entryId });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: entryKeys.entry(entryId) }),
  });
}

// "This one feels heavy. Want me to just listen?" → hide the feedback, forget the mistakes.
export function useSwitchToJustListen(entryId: string) {
  const queryClient = useQueryClient();
  const entrySaved = useEntrySaved();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('switch_to_just_listen', { p_entry_id: entryId });
      if (error) throw error;
    },
    onSuccess: () => Promise.all([queryClient.invalidateQueries({ queryKey: entryKeys.entry(entryId) }), entrySaved()]),
  });
}
