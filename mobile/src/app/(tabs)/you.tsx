import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { Eyebrow } from '@/components/tags';
import { Text } from '@/components/text';
import { profile } from '@/data/mock';
import { PERSONAS } from '@/data/personas';
import type { Persona } from '@/data/types';
import { formatCount, formatTime12h, plural } from '@/lib/text';
import { colors, em, fonts, radii } from '@/theme/tokens';

// Setting pickers (nudge time, language, goal) are wired up with the profile in Phase 2.
export default function YouScreen() {
  const [persona, setPersona] = useState<Persona>(profile.persona);
  const [offerJustListen, setOfferJustListen] = useState(profile.offerJustListen);

  return (
    <Screen>
      <View style={styles.identity}>
        <View style={styles.avatar} accessible={false}>
          <Text style={styles.avatarText}>{profile.name.charAt(0)}</Text>
        </View>
        <View style={{ gap: 2 }}>
          <Text style={styles.name} accessibilityRole="header">
            {profile.name}
          </Text>
          <Text style={styles.muted13}>
            {plural(profile.entryCount, 'entry', 'entries')} · {formatCount(profile.wordCount)} words written
          </Text>
        </View>
      </View>

      <View style={{ gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel="Coach persona">
        <View style={{ marginBottom: 8 }}>
          <Eyebrow>Coach persona</Eyebrow>
        </View>
        {PERSONAS.map((p) => {
          const selected = p.id === persona;
          return (
            <Pressable
              key={p.id}
              onPress={() => setPersona(p.id)}
              accessibilityRole="radio"
              aria-checked={selected}
              accessibilityLabel={`${p.name}. ${p.sample}`}
              style={[styles.persona, selected && styles.personaSelected]}>
              <View style={[styles.radio, selected && styles.radioOn]}>{selected && <View style={styles.radioDot} />}</View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.personaName}>{p.name}</Text>
                <Text style={styles.personaSample}>{p.sample}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.settings}>
        <SettingRow label="Daily nudge" value={formatTime12h(profile.nudgeTime)} />
        <SettingRow label="Native language" value={profile.nativeLanguage} />
        <SettingRow label="Learning goal" value={profile.learningGoal} />
        <Pressable
          onPress={() => setOfferJustListen((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityLabel="Ask about Just Listen. Offer it when an entry feels heavy"
          aria-checked={offerJustListen}
          style={styles.toggleRow}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.rowLabel}>Ask about Just Listen</Text>
            <Text style={styles.rowHint}>Offer it when an entry feels heavy</Text>
          </View>
          <View style={[styles.checkbox, offerJustListen && styles.checkboxOn]}>
            {offerJustListen && <Icon name="check" size={16} strokeWidth={2.6} color="#FFFFFF" />}
          </View>
        </Pressable>
      </View>
    </Screen>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value} ›
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.bold, fontSize: 22, color: '#FFFFFF' },
  name: { fontFamily: fonts.bold, fontSize: 24, letterSpacing: em(24, -0.02) },
  muted13: { fontSize: 13, color: colors.muted },

  persona: {
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
  personaSelected: { backgroundColor: colors.primarySoft, borderWidth: 2, borderColor: colors.primary, paddingVertical: 13, paddingHorizontal: 15 },
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
  personaName: { fontFamily: fonts.bold, fontSize: 15 },
  personaSample: { fontSize: 13, lineHeight: 18, color: colors.inkSoft },

  settings: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.xl, overflow: 'hidden' },
  row: {
    minHeight: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowLabel: { fontFamily: fonts.semibold, fontSize: 15 },
  rowValue: { flexShrink: 1, fontSize: 15, color: colors.muted },
  rowHint: { fontSize: 12, color: colors.muted },
  toggleRow: { minHeight: 60, paddingVertical: 8, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.faint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { borderWidth: 0, backgroundColor: colors.primary },
});
