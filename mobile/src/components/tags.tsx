import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import type { Mood, NoteTag as NoteTagData } from '@/data/types';
import { MOODS } from '@/theme/moods';
import { colors, em, fonts, radii } from '@/theme/tokens';

export function MoodTag({ mood, size = 'md' }: { mood: Mood; size?: 'sm' | 'md' }) {
  const m = MOODS[mood];
  return (
    <View style={[styles.pill, size === 'md' && styles.pillMd, { backgroundColor: m.tagBg }]}>
      <Text style={[styles.label, { color: m.tagText }]}>{m.label}</Text>
    </View>
  );
}

export function NoteTag({ tag }: { tag: NoteTagData }) {
  const grammar = tag.kind === 'grammar';
  return (
    <View style={[styles.pill, { backgroundColor: grammar ? colors.grammarSoft : colors.vocabSoft }]}>
      <Text style={[styles.label, styles.small, { color: grammar ? colors.grammarText : colors.vocabText }]} numberOfLines={1}>
        {tag.label}
      </Text>
    </View>
  );
}

// Upper-case section label used across screens.
export function Eyebrow({ children, color = colors.muted, size = 13 }: { children: string; color?: string; size?: number }) {
  return (
    <Text style={{ fontFamily: fonts.bold, fontSize: size, letterSpacing: em(size, 0.06), textTransform: 'uppercase', color }}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  pill: { borderRadius: radii.pill, paddingVertical: 4, paddingHorizontal: 10, alignSelf: 'flex-start' },
  pillMd: { paddingVertical: 6, paddingHorizontal: 12 },
  label: { fontFamily: fonts.bold, fontSize: 12 },
  small: { fontSize: 11 },
});
