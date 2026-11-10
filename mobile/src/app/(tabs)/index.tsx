import { Link, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, IconButton } from '@/components/buttons';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import type { EntrySummary, Streak, WeekDayState } from '@/data/types';
import { formatLongDate, greeting, relativeDay, toLocalDate } from '@/lib/dates';
import { useLatestEntry, useShufflePrompt, useStreak, useTodayPrompt } from '@/lib/entries';
import { useProfile } from '@/lib/profile';
import { plural } from '@/lib/text';
import { colors, em, fonts, radii } from '@/theme/tokens';

const WEEK_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// Shown until the first load (a few hundred ms); never mistaken for real data.
const NO_STREAK: Streak = { days: 0, writtenToday: false, week: Array<WeekDayState>(7).fill('empty'), today: toLocalDate(new Date()) };

// "On this day" comes back with the journal queries in Phase 5 (hidden without an entry from a year ago).
export default function TodayScreen() {
  const router = useRouter();
  const profile = useProfile();
  const streakQuery = useStreak();
  const prompt = useTodayPrompt();
  const shuffle = useShufflePrompt();
  const latest = useLatestEntry();
  if (!profile) return null;

  const streak = streakQuery.data ?? NO_STREAK;

  return (
    <Screen>
      <View>
        <Text style={styles.date}>{formatLongDate(streak.today)}</Text>
        <Text style={styles.h1} accessibilityRole="header">
          {greeting(new Date().getHours())}, {profile.name}
        </Text>
      </View>

      <StreakCard streak={streak} />

      <View style={styles.prompt}>
        <Text style={styles.promptEyebrow}>{"Tonight's prompt"}</Text>
        <Text style={styles.promptText} accessibilityLiveRegion="polite" aria-live="polite">
          {prompt.data?.text ?? (prompt.isError ? 'Write about anything that’s on your mind tonight.' : ' ')}
        </Text>
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
            disabled={shuffle.isPending || !prompt.data}
            style={[styles.shuffle, shuffle.isPending && { opacity: 0.5 }]}
            onPress={() => shuffle.mutate()}
          />
        </View>
      </View>

      {latest.data && <LatestEntryCard entry={latest.data} today={streak.today} />}
    </Screen>
  );
}

function StreakCard({ streak }: { streak: Streak }) {
  const title = streak.days === 0 ? 'Start your streak' : `${streak.days}-day streak`;
  const note = streak.writtenToday
    ? 'Written today. See you tomorrow'
    : streak.days === 0
      ? 'Write tonight to begin'
      : 'Write tonight to keep it alive';
  return (
    <Card style={styles.streak} accessible accessibilityLabel={`${title}. ${note}`}>
      <View style={styles.row}>
        <View style={styles.flame}>
          <Icon name="flame" size={22} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.streakTitle}>{title}</Text>
          <Text style={styles.muted13}>{note}</Text>
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
  );
}

// Before coaching (Phase 4) there's no mood, excerpt or notes yet: the card says the pages are
// saved and opens them.
function LatestEntryCard({ entry, today }: { entry: EntrySummary; today: string }) {
  return (
    <Link href={{ pathname: '/entry/[id]', params: { id: entry.id } }} asChild>
      <Pressable accessibilityRole="link">
        <Card style={{ gap: 10 }}>
          <View style={styles.between}>
            <Text style={styles.muted13semi}>
              {relativeDay(entry.localDate, today)} · Entry #{entry.number}
            </Text>
            {entry.justListen && (
              <View style={styles.jlTag}>
                <Text style={styles.jlTagText}>Just Listen</Text>
              </View>
            )}
          </View>
          <Text style={styles.waiting}>
            {plural(entry.pageCount, 'page')} saved. Coach hasn’t read {entry.pageCount === 1 ? 'it' : 'them'} yet.
          </Text>
          <View style={styles.row6}>
            <Text style={styles.link}>{entry.pageCount === 1 ? 'See your page' : 'See your pages'}</Text>
            <Icon name="chevronRight" size={16} strokeWidth={2} color={colors.primary} />
          </View>
        </Card>
      </Pressable>
    </Link>
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
  promptText: { minHeight: 62, fontFamily: fonts.semibold, fontSize: 26, lineHeight: 31, letterSpacing: em(26, -0.015), color: '#FFFFFF' },
  buttonLabel: { fontFamily: fonts.bold, fontSize: 15 },
  shuffle: { width: 48, height: 48, borderRadius: radii.md, borderWidth: 1, borderColor: colors.primaryLine },
  waiting: { fontSize: 15, lineHeight: 21, color: colors.inkSoft },
  link: { fontFamily: fonts.semibold, fontSize: 14, color: colors.primary },
  jlTag: { borderRadius: radii.pill, paddingVertical: 4, paddingHorizontal: 10, backgroundColor: colors.navy },
  jlTagText: { fontFamily: fonts.bold, fontSize: 12, color: '#FFFFFF' },
});
