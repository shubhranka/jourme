import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/buttons';
import { FieldError } from '@/components/form';
import { authErrorMessage, completeOAuth, useAuth, type OAuthParams } from '@/lib/auth';
import { colors, gutter } from '@/theme/tokens';

// Where Google sign-in returns (with ?code=… or ?error=…). On web this is a full page load; on
// Android the app also lands here while signInWithGoogle() is finishing the same code. Not behind
// the gate: once signed in it hands over to "/", and the gate picks onboarding or the app.
export default function AuthCallbackScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { code, error, error_code, error_description } = useLocalSearchParams<OAuthParams>();
  const [failure, setFailure] = useState<unknown>(null);

  useEffect(() => {
    if (session) return;
    completeOAuth({ code, error, error_code, error_description }).catch(setFailure);
  }, [session, code, error, error_code, error_description]);

  if (session) return <Redirect href="/" />;

  return (
    <View style={styles.root}>
      {failure ? (
        <View style={{ gap: 12, alignSelf: 'stretch' }}>
          <FieldError>{authErrorMessage(failure)}</FieldError>
          <Button onPress={() => router.replace('/sign-in')}>Back to sign in</Button>
        </View>
      ) : (
        <ActivityIndicator color={colors.primary} accessibilityLabel="Signing you in" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: gutter, backgroundColor: colors.bg },
});
