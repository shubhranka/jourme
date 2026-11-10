import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { IconButton } from '@/components/buttons';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { entries, MOCK_TODAY, moodsByDate, onThisDayEntryId } from '@/data/mock';
import type { Mood } from '@/data/types';
import { formatMonth, formatShortDate, monthGrid, parseLocalDate, toLocalDate } from '@/lib/dates';
import { useProfileStats } from '@/lib/entries';
import { plural } from '@/lib/text';
import { MOOD_ORDER, MOODS } from '@/theme/moods';
import { colors, em, fonts, radii } from '@/theme/tokens';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// Search results, the calendar and On this day become real in Phase 5; the page count is real.
export default function JournalScreen() {
  const pageCount = useProfileStats().data?.pageCount ?? 0;
  const today = parseLocalDate(MOCK_TODAY);
  const [month, setMonth] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [query, setQuery] = useState('');
  const atCurrentMonth = month.year === today.getFullYear() && month.month === today.getMonth();
  const flashback = entries[onThisDayEntryId];
  const todayMood = moodsByDate[MOCK_TODAY];

  const cells = monthGrid(month.year, month.month).map((day) => {
    if (day === null) return null;
    const date = toLocalDate(new Date(month.year, month.month, day));
    return { day, date, mood: moodsByDate[date] as Mood | undefined, future: date > MOCK_TODAY, isToday: date === MOCK_TODAY };
  });
  const weeks = Array.from({ length: Math.ceil(cells.length / 7) }, (_, w) => {
    const week = cells.slice(w * 7, w * 7 + 7);
    return [...week, ...Array<null>(7 - week.length).fill(null)];
  });
  const counts = Object.fromEntries(MOOD_ORDER.map((m) => [m, cells.filter((c) => c?.mood === m).length])) as Record<Mood, number>;

  const shift = (delta: number) =>
    setMonth(({ year, month: m }) => {
      const d = new Date(year, m + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  return (
    <Screen gap={14}>
      <Text style={styles.h1} accessibilityRole="header">
        Journal
      </Text>

      <View style={styles.search}>
        <Icon name="search" size={20} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={`Search ${plural(pageCount, 'handwritten page')}`}
          placeholderTextColor={colors.muted}
          accessibilityLabel="Search your notebook"
          returnKeyType="search"
          style={styles.searchInput}
        />
      </View>

      <Card style={styles.calendar}>
        <View style={styles.calendarHeader}>
          <IconButton icon="chevronLeft" variant="bare" accessibilityLabel="Previous month" onPress={() => shift(-1)} />
          <Text style={styles.h2} accessibilityRole="header">
            {formatMonth(month.year, month.month)}
          </Text>
          <IconButton
            icon="chevronRight"
            variant="bare"
            accessibilityLabel="Next month"
            disabled={atCurrentMonth}
            style={atCurrentMonth && { opacity: 0.3 }}
            onPress={() => shift(1)}
          />
        </View>
        <View style={styles.week}>
          {WEEKDAYS.map((w, i) => (
            <Text key={i} style={[styles.cell, styles.weekday]}>
              {w}
            </Text>
          ))}
        </View>
        {weeks.map((week, w) => (
          <View key={w} style={styles.week}>
            {week.map((c, i) =>
              c === null ? (
                <View key={i} style={styles.cell} />
              ) : (
                <View
                  key={i}
                  style={[styles.cell, styles.day, c.mood ? { backgroundColor: MOODS[c.mood].color } : !c.future && styles.noEntry]}
                  accessibilityLabel={`${c.day} ${formatMonth(month.year, month.month)}: ${c.mood ? MOODS[c.mood].label : c.future ? 'upcoming' : 'no entry'}`}>
                  {c.isToday && <View style={styles.todayRing} />}
                  <Text style={[styles.dayText, c.future && { color: colors.faint }, !c.mood && !c.future && { color: colors.muted }]}>
                    {c.day}
                  </Text>
                </View>
              ),
            )}
          </View>
        ))}
      </Card>

      <View style={styles.summary}>
        {MOOD_ORDER.map((m) => (
          <View key={m} style={styles.summaryCard} accessibilityLabel={`${MOODS[m].label}: ${counts[m]} days`}>
            <View style={[styles.summaryDot, { backgroundColor: MOODS[m].color }]} />
            <Text style={styles.summaryCount}>{counts[m]}</Text>
            <Text style={styles.summaryName}>{MOODS[m].label}</Text>
          </View>
        ))}
      </View>

      <Link href={{ pathname: '/entry/[id]', params: { id: flashback.id } }} asChild>
        <Pressable style={styles.flashback}>
          <Text style={styles.flashbackEyebrow}>On this day · {formatShortDate(flashback.localDate)}</Text>
          <Text style={styles.flashbackText}>{flashback.transcript}</Text>
          {todayMood && (
            <Text style={styles.flashbackMood}>
              {MOODS[flashback.mood].label} then — {MOODS[todayMood].label} today
            </Text>
          )}
        </Pressable>
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: fonts.bold, fontSize: 28, letterSpacing: em(28, -0.02) },
  h2: { fontFamily: fonts.bold, fontSize: 16 },

  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 48,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
  },
  searchInput: { flex: 1, minWidth: 0, height: '100%', fontFamily: fonts.regular, fontSize: 15, color: colors.ink },

  calendar: { paddingTop: 14, paddingHorizontal: 14, paddingBottom: 16, gap: 6 },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  week: { flexDirection: 'row', gap: 6 },
  cell: { flex: 1, textAlign: 'center' },
  weekday: { fontFamily: fonts.bold, fontSize: 11, color: colors.muted },
  day: { height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  noEntry: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.dashed },
  dayText: { fontFamily: fonts.bold, fontSize: 13 },
  // Ink ring 2pt outside the day, with a white gap, like the design's double box-shadow.
  todayRing: { position: 'absolute', top: -4, bottom: -4, left: -4, right: -4, borderRadius: 22, borderWidth: 2, borderColor: colors.ink },

  summary: { flexDirection: 'row', gap: 8 },
  summaryCard: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
  },
  summaryDot: { width: 14, height: 14, borderRadius: 7 },
  summaryCount: { fontFamily: fonts.extrabold, fontSize: 16 },
  summaryName: { fontFamily: fonts.semibold, fontSize: 11, color: colors.muted },

  flashback: { backgroundColor: colors.navy, borderRadius: radii.xl, padding: 16, gap: 8 },
  flashbackEyebrow: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: em(12, 0.06), textTransform: 'uppercase', color: colors.primaryBar },
  flashbackText: { fontFamily: fonts.hand, fontSize: 23, lineHeight: 29, color: '#FFFFFF' },
  flashbackMood: { fontFamily: fonts.semibold, fontSize: 13, color: colors.yellow },
});
