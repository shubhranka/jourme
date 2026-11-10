import { isAuthRetryableFetchError, type Session, type User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { queryClient } from './query';
import { supabase } from './supabase';

type AuthState = { session: Session | null; loading: boolean };

const AuthContext = createContext<AuthState>({ session: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true });

  useEffect(() => {
    // Fires INITIAL_SESSION first, once the stored session has been read.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setState({ session, loading: false }));
    return () => data.subscription.unsubscribe();
  }, []);

  // Drop the previous user's cached data after sign-out. This runs after the signed-in screens
  // have unmounted, so none of them renders with an empty cache.
  const userId = state.session?.user.id;
  useEffect(() => {
    if (!userId) queryClient.clear();
  }, [userId]);

  return <AuthContext value={state}>{children}</AuthContext>;
}

export function useAuth(): AuthState {
  return use(AuthContext);
}

// New and returning users take the same path: the code signs them up or in.
export async function sendCode(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw error;
}

export async function verifyCode(email: string, code: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
  if (error) throw error;
}

// Signs out this device only; other devices stay signed in.
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) throw error;
}

// Google sign-in, in a browser sheet on iOS and Android and as a full-page redirect on web.
// Google returns to /auth/callback: http://localhost:8081/auth/callback on web,
// exp://<ip>:8081/--/auth/callback in Expo Go, jourme://auth/callback in builds. These must be
// allowed in additional_redirect_urls (supabase/config.toml, and the hosted project's settings).
// Resolves false if the user closed the sheet.
export async function signInWithGoogle(): Promise<boolean> {
  const redirectTo = Linking.createURL('auth/callback');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    // Always show the account chooser, so signing out and back in can switch accounts.
    options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
  });
  if (error) throw error;

  if (Platform.OS === 'web') {
    window.location.assign(data.url);
    return new Promise(() => {}); // the page is unloading; stay busy until it does
  }
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return false;
  await completeOAuth(paramsFromUrl(result.url));
  return true;
}

export type OAuthParams = { code?: string; error?: string; error_code?: string; error_description?: string };

export function paramsFromUrl(url: string): OAuthParams {
  const parsed = new URL(url);
  // Errors can come back in the fragment as well as the query.
  const params = new URLSearchParams(parsed.hash.slice(1));
  parsed.searchParams.forEach((value, key) => params.set(key, value));
  return Object.fromEntries(params) as OAuthParams;
}

class OAuthError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const exchanges = new Map<string, Promise<void>>();

// Turns the code Google sign-in returned into a session. On Android both the browser sheet and
// the /auth/callback route receive the redirect, so each code is exchanged only once.
export function completeOAuth({ code, error, error_code, error_description }: OAuthParams): Promise<void> {
  if (error || error_code) return Promise.reject(new OAuthError(error_code ?? error!, error_description ?? error ?? 'Sign-in failed'));
  if (!code) return Promise.reject(new OAuthError('no_code', 'No sign-in code in the redirect'));
  let exchange = exchanges.get(code);
  if (!exchange) {
    exchange = supabase.auth.exchangeCodeForSession(code).then(({ error: e }) => {
      if (e) throw e;
    });
    exchanges.set(code, exchange);
  }
  return exchange;
}

// First name from the Google profile, to prefill onboarding. Empty for email-code sign-ups.
export function suggestedName(user: User | undefined): string {
  const full = user?.user_metadata?.full_name ?? user?.user_metadata?.name;
  return typeof full === 'string' ? (full.trim().split(/\s+/)[0] ?? '') : '';
}

export function authErrorMessage(error: unknown): string {
  if (isAuthRetryableFetchError(error)) return 'Couldn’t reach Jourme. Check your connection and try again.';
  const code = (error as { code?: string } | null)?.code;
  switch (code) {
    case 'access_denied':
      return 'Google sign-in was cancelled.';
    case 'flow_state_not_found':
    case 'flow_state_expired':
    case 'bad_code_verifier':
    case 'pkce_code_verifier_not_found':
    case 'no_code':
      return 'That sign-in didn’t finish. Please try again.';
    case 'otp_expired':
      return 'That code is wrong or has expired. Check it, or send a new one.';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Too many tries. Wait a minute, then try again.';
    case 'email_address_invalid':
    case 'validation_failed':
      return 'That email address doesn’t look right.';
    case 'signup_disabled':
      return 'Jourme isn’t taking new sign-ups right now.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
