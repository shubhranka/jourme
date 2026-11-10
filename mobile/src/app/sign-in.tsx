import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Pressable, Text as RNText, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/buttons';
import { FieldError, TextField } from '@/components/form';
import { GoogleButton } from '@/components/google-button';
import { Text } from '@/components/text';
import { authErrorMessage, sendCode, signInWithGoogle, signOut, useAuth, verifyCode } from '@/lib/auth';
import { useProfileQuery } from '@/lib/profile';
import { colors, em, fonts, gutter, radii } from '@/theme/tokens';

// Matches auth.email.otp_length in supabase/config.toml (and the hosted project's setting).
const CODE_LENGTH = 6;
// Supabase refuses a new code within 60 s of the last one on hosted projects.
const RESEND_AFTER_MS = 60_000;

const LOCAL_SUPABASE = /\/\/(127\.0\.0\.1|localhost)[:/]/.test(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '');

// Also the app's gate: shown signed in while the profile loads (or fails to).
export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <View style={styles.mark} accessible={false}>
            <RNText style={styles.markLetter}>J</RNText>
          </View>
          <Text style={styles.wordmark} accessibilityRole="header">
            Jourme
          </Text>
          <RNText style={styles.tagline}>Write on paper. Get coached in English.</RNText>
        </View>
        {session ? <ProfileGate userId={session.user.id} /> : <SignInForm />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ProfileGate({ userId }: { userId: string }) {
  const profile = useProfileQuery(userId);
  if (!profile.isError) return <ActivityIndicator color={colors.primary} accessibilityLabel="Loading your profile" />;
  return (
    <View style={{ gap: 12 }}>
      <FieldError>Couldn’t load your profile. Check your connection and try again.</FieldError>
      <Button onPress={() => profile.refetch()} disabled={profile.isFetching}>
        {profile.isFetching ? 'Trying again…' : 'Try again'}
      </Button>
      <TextButton label="Sign out" onPress={() => signOut()} />
    </View>
  );
}

function SignInForm() {
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const now = useClock(resendAt);

  const send = useMutation({
    mutationFn: sendCode,
    onSuccess: (_data, address) => {
      setSentTo(address);
      setCode('');
      setResendAt(Date.now() + RESEND_AFTER_MS);
    },
  });
  // On success the session appears and the gate moves on; nothing to do here.
  const verify = useMutation({ mutationFn: (c: string) => verifyCode(sentTo!, c) });
  const google = useMutation({ mutationFn: signInWithGoogle });

  const address = email.trim().toLowerCase();
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address);
  const submitEmail = () => {
    if (emailOk && !send.isPending) send.mutate(address);
  };
  const submitCode = (c = code) => {
    if (c.length === CODE_LENGTH && !verify.isPending) verify.mutate(c);
  };
  const waitSeconds = Math.ceil((resendAt - now) / 1000);

  if (sentTo === null) {
    return (
      <View style={{ gap: 12 }}>
        <Text style={styles.h2}>Sign in or create an account</Text>
        <GoogleButton
          busy={google.isPending}
          onPress={() => {
            send.reset();
            google.mutate();
          }}
        />
        <FieldError>{google.error ? authErrorMessage(google.error) : null}</FieldError>
        <View style={styles.divider} accessible={false}>
          <View style={styles.rule} />
          <Text style={styles.dividerLabel}>or</Text>
          <View style={styles.rule} />
        </View>
        <TextField
          value={email}
          onChangeText={(t) => {
            setEmail(t);
            send.reset();
          }}
          onSubmitEditing={submitEmail}
          placeholder="you@example.com"
          accessibilityLabel="Email address"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="send"
        />
        <FieldError>{send.error ? authErrorMessage(send.error) : null}</FieldError>
        <Button onPress={submitEmail} disabled={!emailOk || send.isPending}>
          {send.isPending ? 'Sending…' : 'Email me a code'}
        </Button>
        <Text style={styles.note}>We’ll email you a {CODE_LENGTH}-digit code. No password to remember.</Text>
        {__DEV__ && LOCAL_SUPABASE && (
          <Text style={styles.devNote}>Local Supabase: the email lands in Mailpit at http://127.0.0.1:54324</Text>
        )}
      </View>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.h2}>Check your email</Text>
      <Text style={styles.body}>
        We sent a {CODE_LENGTH}-digit code to <RNText style={styles.bodyStrong}>{sentTo}</RNText>.
      </Text>
      <TextField
        autoFocus
        value={code}
        onChangeText={(t) => {
          const digits = t.replace(/\D/g, '').slice(0, CODE_LENGTH);
          setCode(digits);
          verify.reset();
          if (digits.length === CODE_LENGTH) submitCode(digits);
        }}
        placeholder={'0'.repeat(CODE_LENGTH)}
        accessibilityLabel={`${CODE_LENGTH}-digit code`}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={CODE_LENGTH}
        style={styles.code}
      />
      <FieldError>{verify.error ? authErrorMessage(verify.error) : send.error ? authErrorMessage(send.error) : null}</FieldError>
      <Button onPress={() => submitCode()} disabled={code.length !== CODE_LENGTH || verify.isPending}>
        {verify.isPending ? 'Checking…' : 'Sign in'}
      </Button>
      <View style={styles.links}>
        <TextButton
          label={waitSeconds > 0 ? `Send a new code in ${waitSeconds}s` : send.isPending ? 'Sending…' : 'Send a new code'}
          disabled={waitSeconds > 0 || send.isPending}
          onPress={() => {
            verify.reset();
            send.mutate(sentTo);
          }}
        />
        <TextButton
          label="Use a different email"
          onPress={() => {
            setSentTo(null);
            send.reset();
            verify.reset();
          }}
        />
      </View>
      {__DEV__ && LOCAL_SUPABASE && (
        <Text style={styles.devNote}>Local Supabase: the email lands in Mailpit at http://127.0.0.1:54324</Text>
      )}
    </View>
  );
}

function TextButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" aria-disabled={disabled} hitSlop={8} style={styles.textButton}>
      <Text style={[styles.textButtonLabel, disabled && { color: colors.faint }]}>{label}</Text>
    </Pressable>
  );
}

// Re-renders every second until `until` has passed, for the resend countdown.
function useClock(until: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until <= Date.now()) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= until) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [until]);
  return now;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, paddingHorizontal: gutter, gap: 36 },
  brand: { alignItems: 'flex-start', gap: 6 },
  mark: {
    width: 56,
    height: 56,
    borderRadius: radii.lg,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  markLetter: { fontFamily: fonts.handSemibold, fontSize: 38, lineHeight: 44, color: colors.yellow },
  wordmark: { fontFamily: fonts.extrabold, fontSize: 36, lineHeight: 40, letterSpacing: em(36, -0.03) },
  tagline: { fontFamily: fonts.hand, fontSize: 26, lineHeight: 30, color: colors.handInk },
  h2: { fontFamily: fonts.bold, fontSize: 20, letterSpacing: em(20, -0.01) },
  body: { fontSize: 15, lineHeight: 21, color: colors.inkSoft },
  bodyStrong: { fontFamily: fonts.semibold, color: colors.ink },
  note: { fontSize: 13, lineHeight: 18, color: colors.muted },
  devNote: { fontSize: 12, lineHeight: 17, color: colors.faint },
  code: { height: 60, fontFamily: fonts.bold, fontSize: 28, letterSpacing: 10, textAlign: 'center' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  rule: { flex: 1, height: 1, backgroundColor: colors.borderStrong },
  dividerLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  textButton: { minHeight: 44, justifyContent: 'center' },
  textButtonLabel: { fontFamily: fonts.semibold, fontSize: 14, color: colors.primary },
});
