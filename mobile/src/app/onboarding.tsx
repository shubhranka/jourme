import { useEffect, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton } from '@/components/buttons';
import { FieldError } from '@/components/form';
import {
  FIELD_COPY,
  GoalField,
  LanguageField,
  NameField,
  NudgeTimeField,
  PersonaField,
  type ProfileField,
} from '@/components/profile-fields';
import { Text } from '@/components/text';
import type { Persona } from '@/data/types';
import { signOut, suggestedName, useAuth } from '@/lib/auth';
import { saveErrorMessage, useCreateProfile, useDeviceTimeZone } from '@/lib/profile';
import { colors, em, fonts, gutter, radii } from '@/theme/tokens';

const STEPS: ProfileField[] = ['name', 'language', 'goal', 'persona', 'nudge'];

// First run after sign-in. Creating the profile opens the app (see the gate in _layout.tsx).
// Camera and notification permissions are asked for when those features first need them.
export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const timezone = useDeviceTimeZone();
  const create = useCreateProfile();

  const [step, setStep] = useState(0);
  const [name, setName] = useState(() => suggestedName(session?.user));
  const [nativeLanguage, setNativeLanguage] = useState('');
  const [learningGoal, setLearningGoal] = useState('');
  const [persona, setPersona] = useState<Persona>('cheerleader');
  const [nudgeTime, setNudgeTime] = useState('21:30');

  const field = STEPS[step];
  const last = step === STEPS.length - 1;
  const filled: Record<ProfileField, boolean> = {
    name: name.trim() !== '',
    language: nativeLanguage.trim() !== '',
    goal: learningGoal.trim() !== '',
    persona: true,
    nudge: true,
  };

  const back = () => setStep((s) => Math.max(0, s - 1));
  const next = () => {
    if (!filled[field] || create.isPending) return;
    if (!last) setStep(step + 1);
    else create.mutate({ name, nativeLanguage, learningGoal, persona, nudgeTime, offerJustListen: true, timezone });
  };

  // Android's back button steps back through the questions instead of leaving the app.
  useEffect(() => {
    if (step === 0) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setStep((s) => Math.max(0, s - 1));
      return true;
    });
    return () => sub.remove();
  }, [step]);

  const greeting = step === 0 ? 'Welcome to Jourme' : step === 1 ? `Nice to meet you, ${name.trim()}` : null;

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        {step > 0 ? <IconButton icon="chevronLeft" accessibilityLabel="Previous question" onPress={back} /> : <View style={styles.headerSpacer} />}
        <View
          style={styles.progress}
          accessibilityRole="progressbar"
          accessibilityLabel={`Question ${step + 1} of ${STEPS.length}`}
          accessibilityValue={{ min: 1, max: STEPS.length, now: step + 1 }}>
          {STEPS.map((s, i) => (
            <View key={s} style={[styles.segment, i <= step && styles.segmentDone]} />
          ))}
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 8 }}>
          {greeting && <Text style={styles.eyebrow}>{greeting}</Text>}
          <Text style={styles.question} accessibilityRole="header">
            {FIELD_COPY[field].question}
          </Text>
          <Text style={styles.hint}>{FIELD_COPY[field].hint}</Text>
        </View>

        {field === 'name' && <NameField value={name} onChange={setName} onSubmit={next} />}
        {field === 'language' && <LanguageField value={nativeLanguage} onChange={setNativeLanguage} onSubmit={next} />}
        {field === 'goal' && <GoalField value={learningGoal} onChange={setLearningGoal} />}
        {field === 'persona' && <PersonaField value={persona} onChange={setPersona} />}
        {field === 'nudge' && <NudgeTimeField value={nudgeTime} onChange={setNudgeTime} />}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <FieldError>{create.error ? saveErrorMessage(create.error) : null}</FieldError>
        <Button onPress={next} disabled={!filled[field] || create.isPending}>
          {!last ? 'Continue' : create.isPending ? 'Setting up…' : 'Start writing'}
        </Button>
        {step === 0 && (
          <Pressable onPress={() => signOut()} accessibilityRole="button" hitSlop={8} style={styles.signOut}>
            <Text style={styles.signOutLabel} numberOfLines={1}>
              Not {session?.user.email}? Sign out
            </Text>
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: gutter, paddingBottom: 8 },
  headerSpacer: { width: 44, height: 44 },
  progress: { flex: 1, flexDirection: 'row', gap: 6 },
  segment: { flex: 1, height: 4, borderRadius: radii.pill, backgroundColor: colors.divider },
  segmentDone: { backgroundColor: colors.primary },
  body: { paddingHorizontal: gutter, paddingTop: 20, paddingBottom: 24, gap: 24 },
  eyebrow: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: em(12, 0.08), textTransform: 'uppercase', color: colors.primary },
  question: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 33, letterSpacing: em(28, -0.02) },
  hint: { fontSize: 15, lineHeight: 21, color: colors.muted },
  footer: { paddingHorizontal: gutter, paddingTop: 12, gap: 10, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.bg },
  signOut: { minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  signOutLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
});
