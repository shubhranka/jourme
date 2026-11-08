import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, IconButton } from '@/components/buttons';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { MoodTag } from '@/components/tags';
import { Text } from '@/components/text';
import { entries, latestEntryId, MOCK_TODAY, onThisDayEntryId, profile, prompts, streak } from '@/data/mock';
import type { WeekDayState } from '@/data/types';
import { formatLongDate, greeting, parseLocalDate, relativeDay } from '@/lib/dates';
import { colors, em, fonts, radii } from '@/theme/tokens';

const WEEK_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function TodayScreen() {
  const router = useRouter();
  const [promptIndex, setPromptIndex] = useState(0);
  const latest = entries[latestEntryId];
  const flashback = entries[onThisDayEntryId];

  return (
    <Screen>
      <View>
        <Text style={styles.date}>{formatLongDate(MOCK_TODAY)}</Text>
        <Text style={styles.h1} accessibilityRole="header">
          {greeting(new Date().getHours())}, {profile.name}
        </Text>
      </View>

      <Card style={styles.streak} accessibilityLabel={`${streak.days}-day streak`}>
        <View style={styles.row}>
          <View style={styles.flame}>
            <Icon name="flame" size={22} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.streakTitle}>{streak.days}-day streak</Text>
            <Text style={styles.muted13}>{streak.writtenToday ? 'Written today. See you tomorrow' : 'Write tonight to keep it alive'}</Text>
          </View>
        </View>
        <View style={styles.week}>
          {streak.week.map((state, i) => (
            <View key={i} style={styles.weekDay}>
              <Text style={styles.weekLabel}>{WEEK_LABELS[i]}</Text>
              <View style={[styles.dot, DOT_STYLES[state]]} />
            </View>
          ))}
        </View>
      </Card>

      <View style={styles.prompt}>
        <Text style={styles.promptEyebrow}>{"Tonight's prompt"}</Text>
        <Text style={styles.promptText}>{prompts[promptIndex]}</Text>
        <View style={styles.row10}>
          <Button variant="white" style={{ flex: 1 }} onPress={() => router.push('/scan')}>
            <Icon name="camera" size={20} />
            <Text style={styles.buttonLabel}>Scan my page</Text>
          </Button>
          <IconButton
            icon="shuffle"
            accessibilityLabel="Shuffle prompt"
            variant="bare"
            strokeWidth={1.9}
            color="#FFFFFF"
            style={styles.shuffle}
            onPress={() => setPromptIndex((i) => (i + 1) % prompts.length)}
          />
        </View>
      </View>

      <Link href={{ pathname: '/entry/[id]', params: { id: latest.id } }} asChild>
        <Pressable>
          <Card style={{ gap: 10 }}>
            <View style={styles.between}>
              <Text style={styles.muted13semi}>
                {relativeDay(latest.localDate, MOCK_TODAY)} · Entry #{latest.number}
              </Text>
              <MoodTag mood={latest.mood} size="sm" />
            </View>
            <Text style={styles.excerpt} numberOfLines={2}>
              {latest.transcript}
            </Text>
            <View style={styles.row6}>
              <Text style={styles.link}>
                {latest.notes.length} notes from Coach
              </Text>
              <Icon name="chevronRight" size={16} strokeWidth={2} color={colors.primary} />
            </View>
          </Card>
        </Pressable>
      </Link>

      <Link href={{ pathname: '/entry/[id]', params: { id: flashback.id } }} asChild>
        <Pressable style={styles.flashback}>
          <Icon name="history" size={22} strokeWidth={1.8} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.flashbackEyebrow}>On this day, {parseLocalDate(flashback.localDate).getFullYear()}</Text>
            <Text style={styles.flashbackQuote} numberOfLines={1}>
              “{flashback.transcript}”
            </Text>
          </View>
        </Pressable>
      </Link>
    </Screen>
  );
}

const DOT_STYLES: Record<WeekDayState, object> = {
  done: { backgroundColor: colors.ink },
  today: { borderWidth: 2, borderStyle: 'dashed', borderColor: colors.primary, backgroundColor: colors.primarySoft },
  empty: { backgroundColor: colors.divider },
};

const styles = StyleSheet.create({
  date: { fontFamily: fonts.semibold, fontSize: 13, letterSpacing: em(13, 0.04), textTransform: 'uppercase', color: colors.muted, marginBottom: 4 },
  h1: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 32, letterSpacing: em(28, -0.02) },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  row6: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  row10: { flexDirection: 'row', gap: 10 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  streak: { gap: 14 },
  flame: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.yellow, alignItems: 'center', justifyContent: 'center' },
  streakTitle: { fontFamily: fonts.bold, fontSize: 20, letterSpacing: em(20, -0.01) },
  muted13: { fontSize: 13, color: colors.muted },
  muted13semi: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted },
  week: { flexDirection: 'row', gap: 6 },
  weekDay: { flex: 1, alignItems: 'center', gap: 6 },
  weekLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.muted },
  dot: { width: 28, height: 28, borderRadius: 14 },
  prompt: { backgroundColor: colors.primary, borderRadius: radii.xxl, paddingTop: 22, paddingHorizontal: 20, paddingBottom: 20, gap: 18 },
  promptEyebrow: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: em(12, 0.08), textTransform: 'uppercase', color: colors.primaryTint },
  promptText: { fontFamily: fonts.semibold, fontSize: 26, lineHeight: 31, letterSpacing: em(26, -0.015), color: '#FFFFFF' },
  buttonLabel: { fontFamily: fonts.bold, fontSize: 15 },
  shuffle: { width: 48, height: 48, borderRadius: radii.md, borderWidth: 1, borderColor: colors.primaryLine },
  excerpt: { fontFamily: fonts.hand, fontSize: 22, lineHeight: 27.5, color: colors.handInk },
  link: { fontFamily: fonts.semibold, fontSize: 14, color: colors.primary },
  flashback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.dashed,
    borderRadius: radii.xl,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  flashbackEyebrow: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: em(12, 0.06), textTransform: 'uppercase', color: colors.muted },
  flashbackQuote: { fontFamily: fonts.medium, fontSize: 15 },
});
