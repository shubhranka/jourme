import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton } from '@/components/buttons';
import { FieldError } from '@/components/form';
import { FIELD_COPY, GoalField, LanguageField, NameField, NudgeTimeField } from '@/components/profile-fields';
import { Text } from '@/components/text';
import type { Profile } from '@/data/types';
import { saveErrorMessage, useProfile, useUpdateProfile } from '@/lib/profile';
import { colors, em, fonts, gutter } from '@/theme/tokens';

// Settings edited in this sheet, keyed by the URL segment (/settings/nudge). Persona and the
// Just Listen toggle change in place on You & Coach.
const FIELDS = {
  name: 'name',
  language: 'nativeLanguage',
  goal: 'learningGoal',
  nudge: 'nudgeTime',
} as const satisfies Record<string, keyof Profile>;

type Field = keyof typeof FIELDS;

const isField = (f: string | undefined): f is Field => !!f && f in FIELDS;

export default function EditSettingScreen() {
  const { field } = useLocalSearchParams<{ field: string }>();
  const profile = useProfile();
  if (!profile || !isField(field)) return null;
  return <Editor field={field} initial={profile[FIELDS[field]]} />;
}

function Editor({ field, initial }: { field: Field; initial: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const update = useUpdateProfile();
  const [value, setValue] = useState(initial);
  const copy = FIELD_COPY[field];

  const close = () => (router.canGoBack() ? router.back() : router.replace('/you'));
  const save = async () => {
    if (value.trim() === '' || update.isPending) return;
    if (value.trim() === initial) return close();
    try {
      await update.mutateAsync({ [FIELDS[field]]: value });
      close();
    } catch {
      // Shown below from update.error; the old value is back in place.
    }
  };

  // A modal on iOS keeps its own top inset; elsewhere the sheet is a full screen.
  const top = Platform.OS === 'ios' ? 16 : insets.top + 12;

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.root}>
      <View style={[styles.header, { paddingTop: top }]}>
        <Text style={styles.title} accessibilityRole="header">
          {copy.label}
        </Text>
        <IconButton icon="close" accessibilityLabel="Close without saving" onPress={close} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.hint}>{copy.hint}</Text>
        {field === 'name' && <NameField value={value} onChange={setValue} onSubmit={save} />}
        {field === 'language' && <LanguageField value={value} onChange={setValue} onSubmit={save} />}
        {field === 'goal' && <GoalField value={value} onChange={setValue} />}
        {field === 'nudge' && <NudgeTimeField value={value} onChange={setValue} />}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <FieldError>{update.error ? saveErrorMessage(update.error) : null}</FieldError>
        <Button onPress={save} disabled={value.trim() === '' || update.isPending}>
          {update.isPending ? 'Saving…' : 'Save'}
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: gutter, paddingBottom: 4 },
  title: { fontFamily: fonts.bold, fontSize: 24, letterSpacing: em(24, -0.02) },
  body: { paddingHorizontal: gutter, paddingTop: 8, paddingBottom: 24, gap: 18 },
  hint: { fontSize: 15, lineHeight: 21, color: colors.muted },
  footer: { paddingHorizontal: gutter, paddingTop: 12, gap: 10, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.bg },
});
