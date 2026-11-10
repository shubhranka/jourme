import { Link, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { FieldError } from '@/components/form';
import { Icon } from '@/components/icon';
import { PersonaField } from '@/components/profile-fields';
import { Screen } from '@/components/screen';
import { Eyebrow } from '@/components/tags';
import { Text } from '@/components/text';
import { signOut, useAuth } from '@/lib/auth';
import { useProfileStats } from '@/lib/entries';
import { saveErrorMessage, useProfile, useUpdateProfile } from '@/lib/profile';
import { formatCount, formatTime12h, plural } from '@/lib/text';
import { colors, em, fonts, radii } from '@/theme/tokens';

export default function YouScreen() {
  const profile = useProfile();
  const { session } = useAuth();
  const update = useUpdateProfile();
  const stats = useProfileStats().data;
  if (!profile) return null;

  return (
    <Screen>
      <Link href="/settings/name" asChild>
        <Pressable style={styles.identity} accessibilityRole="button" accessibilityLabel={`${profile.name}. Edit name`}>
          <View style={styles.avatar} accessible={false}>
            <Text style={styles.avatarText}>{profile.name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.name} accessibilityRole="header" numberOfLines={1}>
              {profile.name}
            </Text>
            {/* Words are counted from transcripts, so they start in Phase 4. */}
            <Text style={styles.muted13}>
              {stats
                ? `${plural(stats.entryCount, 'entry', 'entries')} · ${formatCount(stats.wordCount)} words written`
                : ' '}
            </Text>
          </View>
        </Pressable>
      </Link>

      <View style={{ gap: 8 }}>
        <View style={{ marginBottom: 8 }}>
          <Eyebrow>Coach persona</Eyebrow>
        </View>
        <PersonaField value={profile.persona} onChange={(persona) => update.mutate({ persona })} />
      </View>

      <View style={styles.settings}>
        <SettingRow label="Daily nudge" value={formatTime12h(profile.nudgeTime)} href="/settings/nudge" />
        <SettingRow label="Native language" value={profile.nativeLanguage} href="/settings/language" />
        <SettingRow label="Learning goal" value={profile.learningGoal} href="/settings/goal" />
        <Pressable
          onPress={() => update.mutate({ offerJustListen: !profile.offerJustListen })}
          accessibilityRole="checkbox"
          accessibilityLabel="Ask about Just Listen. Offer it when an entry feels heavy"
          aria-checked={profile.offerJustListen}
          style={styles.toggleRow}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.rowLabel}>Ask about Just Listen</Text>
            <Text style={styles.rowHint}>Offer it when an entry feels heavy</Text>
          </View>
          <View style={[styles.checkbox, profile.offerJustListen && styles.checkboxOn]}>
            {profile.offerJustListen && <Icon name="check" size={16} strokeWidth={2.6} color="#FFFFFF" />}
          </View>
        </Pressable>
      </View>
      <FieldError>{update.error ? saveErrorMessage(update.error) : null}</FieldError>

      <Pressable onPress={() => signOut()} accessibilityRole="button" style={styles.account}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.rowLabel}>Sign out</Text>
          <Text style={styles.rowHint} numberOfLines={1}>
            {session?.user.email}
          </Text>
        </View>
      </Pressable>
    </Screen>
  );
}

function SettingRow({ label, value, href }: { label: string; value: string; href: Href }) {
  return (
    <Link href={href} asChild>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} style={styles.row}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue} numberOfLines={1}>
          {value} ›
        </Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.bold, fontSize: 22, color: '#FFFFFF' },
  name: { fontFamily: fonts.bold, fontSize: 24, letterSpacing: em(24, -0.02) },
  muted13: { fontSize: 13, color: colors.muted },

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
  account: {
    minHeight: 60,
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
  },
});
