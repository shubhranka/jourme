import { Caveat_400Regular, Caveat_600SemiBold } from '@expo-google-fonts/caveat';
import {
  InterTight_400Regular,
  InterTight_500Medium,
  InterTight_600SemiBold,
  InterTight_700Bold,
  InterTight_800ExtraBold,
} from '@expo-google-fonts/inter-tight';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { AuthProvider, useAuth } from '@/lib/auth';
import { useProfileQuery, useTimezoneSync } from '@/lib/profile';
import { queryClient } from '@/lib/query';
import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();

// Deep links to /scan or /entry/:id still have the tabs underneath.
export const unstable_settings = { anchor: '(tabs)' };

export default function RootLayout() {
  const [loaded, error] = useFonts({
    InterTight_400Regular,
    InterTight_500Medium,
    InterTight_600SemiBold,
    InterTight_700Bold,
    InterTight_800ExtraBold,
    Caveat_400Regular,
    Caveat_600SemiBold,
  });

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RootNavigator fontsReady={loaded || !!error} />
      </AuthProvider>
    </QueryClientProvider>
  );
}

// The gate: signed out → sign-in; signed in without a profile → onboarding; otherwise the app.
// While the profile is still loading (or failed to), sign-in stays up and shows that state.
function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { session, loading } = useAuth();
  const profileQuery = useProfileQuery(session?.user.id);
  const profile = profileQuery.data; // undefined = not known yet, null = no profile
  useTimezoneSync(profile);

  const signedIn = session !== null;
  const known = signedIn && profile !== undefined;
  const ready = fontsReady && !loading && (!signedIn || known || profileQuery.isError);

  // At launch, render nothing (the splash stays up) until we know which screen to show, so a
  // reload or deep link keeps its URL instead of bouncing through sign-in. After that, signing in
  // keeps the sign-in screen up while the profile loads.
  const [booted, setBooted] = useState(false);
  if (ready && !booted) setBooted(true);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!booted && !ready) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Protected guard={!known}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
        <Stack.Protected guard={known && profile === null}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={known && profile !== null}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="entry/[id]" />
          <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal', contentStyle: { backgroundColor: colors.scanner.bg } }} />
          <Stack.Screen name="settings/[field]" options={{ presentation: 'modal' }} />
        </Stack.Protected>
        {/* Google sign-in returns here signed out, so it sits outside the guards. It must stay
            last: a blocked route falls back to the first available screen, which must be sign-in. */}
        <Stack.Screen name="auth/callback" />
      </Stack>
    </>
  );
}
