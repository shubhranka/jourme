import type { ComponentPropsWithRef, ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Text } from '@/components/text';
import { colors, fonts, radii } from '@/theme/tokens';

export function TextField({ style, ...props }: ComponentPropsWithRef<typeof TextInput>) {
  return <TextInput placeholderTextColor={colors.faint} {...props} style={[styles.input, style]} />;
}

// A radio option as a card (coach persona, learning goal).
export function ChoiceCard({
  title,
  subtitle,
  selected,
  onPress,
  children,
}: {
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
  children?: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      aria-checked={selected}
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      style={[styles.card, selected && styles.cardSelected]}>
      <View style={[styles.radio, selected && styles.radioOn]}>{selected && <View style={styles.radioDot} />}</View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={styles.cardTitle}>{title}</Text>
        {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
        {children}
      </View>
    </Pressable>
  );
}

// A single-choice suggestion; put a group of them in a radiogroup.
export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      aria-checked={selected}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && { opacity: 0.75 }]}>
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

export function FieldError({ children }: { children: string | null | undefined }) {
  if (!children) return null;
  return (
    <Text style={styles.error} accessibilityRole="alert" aria-live="polite">
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  input: {
    height: 52,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    fontFamily: fonts.medium,
    fontSize: 17,
    color: colors.ink,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  // 1pt thicker border, so trim the padding to keep the text from shifting.
  cardSelected: { backgroundColor: colors.primarySoft, borderWidth: 2, borderColor: colors.primary, paddingVertical: 13, paddingHorizontal: 15 },
  radio: {
    width: 20,
    height: 20,
    marginTop: 2,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.faint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderWidth: 0, backgroundColor: colors.primary },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' },
  cardTitle: { fontFamily: fonts.bold, fontSize: 15 },
  cardSubtitle: { fontSize: 13, lineHeight: 18, color: colors.inkSoft },

  chip: {
    minHeight: 40,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  chipSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipLabel: { fontFamily: fonts.semibold, fontSize: 14, color: colors.inkSoft },
  chipLabelSelected: { color: colors.primaryDark },

  error: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 19, color: colors.strike },
});
