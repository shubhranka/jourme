// The profile questions, shared by onboarding and the You & Coach edit sheets.
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';

import { ChoiceCard, Chip, TextField } from '@/components/form';
import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { PERSONAS } from '@/data/personas';
import type { Persona } from '@/data/types';
import { formatTime12h } from '@/lib/text';
import { colors, fonts, radii } from '@/theme/tokens';

export type ProfileField = 'name' | 'language' | 'goal' | 'persona' | 'nudge';

export const FIELD_COPY: Record<ProfileField, { label: string; question: string; hint: string }> = {
  name: {
    label: 'Name',
    question: 'What should Coach call you?',
    hint: 'A first name or nickname is fine.',
  },
  language: {
    label: 'Native language',
    question: 'What’s your first language?',
    hint: 'Coach watches for the mistakes its speakers often make in English.',
  },
  goal: {
    label: 'Learning goal',
    question: 'What do you want English for?',
    hint: 'Coach uses this to decide what to work on first.',
  },
  persona: {
    label: 'Coach persona',
    question: 'Pick your coach',
    hint: 'This sets the tone of your feedback. You can switch any time.',
  },
  nudge: {
    label: 'Daily nudge',
    question: 'When do you usually write?',
    hint: 'If you haven’t written by then, Jourme sends a gentle reminder with that night’s prompt.',
  },
};

type FieldProps = { value: string; onChange: (value: string) => void; onSubmit?: () => void };

export function NameField({ value, onChange, onSubmit }: FieldProps) {
  return (
    <TextField
      autoFocus
      value={value}
      onChangeText={onChange}
      onSubmitEditing={onSubmit}
      placeholder="Your name"
      accessibilityLabel="Your name"
      autoCapitalize="words"
      autoComplete="given-name"
      textContentType="givenName"
      maxLength={50}
      returnKeyType="next"
      submitBehavior="submit"
    />
  );
}

const LANGUAGES = [
  'Hindi', 'Bengali', 'Tamil', 'Telugu', 'Marathi', 'Urdu',
  'Spanish', 'Portuguese', 'Arabic', 'Mandarin', 'French', 'Japanese',
  'Gujarati', 'Punjabi', 'Malayalam', 'Kannada', 'German', 'Italian', 'Cantonese', 'Korean',
  'Vietnamese', 'Indonesian', 'Thai', 'Turkish', 'Russian', 'Ukrainian', 'Polish', 'Persian',
  'Swahili', 'Tagalog',
];
const SHOWN = 12;

// Free text, with suggestions that narrow as you type. Any language is accepted.
export function LanguageField({ value, onChange, onSubmit }: FieldProps) {
  const query = value.trim().toLowerCase();
  const exact = LANGUAGES.find((l) => l.toLowerCase() === query);
  let shown: string[];
  if (!query) shown = LANGUAGES.slice(0, SHOWN);
  else if (exact) shown = LANGUAGES.slice(0, SHOWN).includes(exact) ? LANGUAGES.slice(0, SHOWN) : [exact, ...LANGUAGES.slice(0, SHOWN - 1)];
  else shown = LANGUAGES.filter((l) => l.toLowerCase().startsWith(query)).slice(0, SHOWN);

  return (
    <View style={{ gap: 14 }}>
      <TextField
        value={value}
        onChangeText={onChange}
        onSubmitEditing={onSubmit}
        placeholder="Type your language"
        accessibilityLabel="Your first language"
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={60}
        returnKeyType="next"
        submitBehavior="submit"
      />
      {shown.length > 0 && (
        <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Common languages">
          {shown.map((l) => (
            <Chip key={l} label={l} selected={l === exact} onPress={() => onChange(l)} />
          ))}
        </View>
      )}
    </View>
  );
}

const GOALS = [
  'Sound natural at work',
  'Pass an English exam',
  'Talk easily with friends',
  'Travel and everyday life',
  'Write more clearly',
];

export function GoalField({ value, onChange }: FieldProps) {
  const [other, setOther] = useState(value !== '' && !GOALS.includes(value));
  return (
    <View style={{ gap: 8 }}>
      <View style={{ gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel="Learning goal">
        {GOALS.map((g) => (
          <ChoiceCard
            key={g}
            title={g}
            selected={!other && value === g}
            onPress={() => {
              setOther(false);
              onChange(g);
            }}
          />
        ))}
        <ChoiceCard
          title="Something else"
          selected={other}
          onPress={() => {
            if (other) return;
            setOther(true);
            onChange('');
          }}
        />
      </View>
      {other && (
        <TextField
          autoFocus
          value={value}
          onChangeText={onChange}
          placeholder="In a few words"
          accessibilityLabel="Your learning goal"
          maxLength={120}
          returnKeyType="done"
        />
      )}
    </View>
  );
}

export function PersonaField({ value, onChange }: { value: Persona; onChange: (persona: Persona) => void }) {
  return (
    <View style={{ gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel="Coach persona">
      {PERSONAS.map((p) => (
        <ChoiceCard key={p.id} title={p.name} subtitle={p.sample} selected={p.id === value} onPress={() => onChange(p.id)} />
      ))}
    </View>
  );
}

// Every half hour of the day, "00:00" to "23:30".
const SLOTS = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
const SLOT_HEIGHT = 48;

export function NudgeTimeField({ value, onChange }: FieldProps) {
  const list = useRef<ScrollViewInstance>(null);
  const slots = SLOTS.includes(value) ? SLOTS : [...SLOTS, value].sort();
  const selected = slots.indexOf(value);

  return (
    <ScrollView
      ref={list}
      style={styles.timeList}
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
      // Open with the chosen time in the middle of the list.
      onLayout={(e) =>
        list.current?.scrollTo({ y: Math.max(0, (selected + 0.5) * SLOT_HEIGHT - e.nativeEvent.layout.height / 2), animated: false })
      }
      accessibilityRole="radiogroup"
      accessibilityLabel="Nudge time">
      {slots.map((t) => {
        const on = t === value;
        return (
          <Pressable
            key={t}
            onPress={() => onChange(t)}
            accessibilityRole="radio"
            aria-checked={on}
            style={[styles.slot, on && styles.slotSelected]}>
            <Text style={[styles.slotLabel, on && styles.slotLabelSelected]}>{formatTime12h(t)}</Text>
            {on && <Icon name="check" size={18} strokeWidth={2.4} color={colors.primary} />}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeList: {
    height: SLOT_HEIGHT * 7,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
  },
  slot: {
    height: SLOT_HEIGHT,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  slotSelected: { backgroundColor: colors.primarySoft },
  slotLabel: { fontFamily: fonts.medium, fontSize: 16, color: colors.inkSoft },
  slotLabelSelected: { fontFamily: fonts.bold, color: colors.primaryDark },
});
