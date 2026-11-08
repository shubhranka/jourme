import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { progress } from '@/data/mock';
import type { TrackerRow, TrackerStatus } from '@/data/types';
import { colors, em, fonts } from '@/theme/tokens';

const BAR_MAX = 80;

const STATUS: Record<TrackerStatus, { label: string; color: string }> = {
  'needs-work': { label: 'Needs work', color: colors.trackerBad },
  improving: { label: 'Improving', color: colors.trackerMid },
  new: { label: 'New', color: colors.trackerMid },
  mastered: { label: 'Mastered', color: colors.trackerGood },
};

// The Sunday review card is hidden until that feature ships.
export default function ProgressScreen() {
  const { score, weeklyScores, tracker, crutchWords } = progress;
  const first = weeklyScores[0];
  const last = weeklyScores[weeklyScores.length - 1];
  const gain = last - first;

  return (
    <Screen gap={14}>
      <Text style={styles.h1} accessibilityRole="header">
        Your English
      </Text>

      <Card style={styles.scoreCard}>
        <View style={{ gap: 2 }}>
          <Text style={styles.label}>Native-like score</Text>
          <Text style={styles.score}>
            {score}
            <Text style={styles.outOf}>/100</Text>
          </Text>
          <Text style={[styles.gain, gain < 0 && { color: colors.muted }]}>
            {gain >= 0 ? '+' : '−'}
            {Math.abs(gain)} in {weeklyScores.length} weeks
          </Text>
        </View>
        <View
          style={styles.bars}
          accessibilityRole="image"
          accessibilityLabel={`Weekly score ${gain >= 0 ? 'rising' : 'falling'} from ${first} to ${last} over ${weeklyScores.length} weeks`}>
          {weeklyScores.map((s, i) => (
            <View
              key={i}
              style={[
                styles.bar,
                {
                  height: Math.max(4, Math.min(BAR_MAX, Math.round(((s - 50) / 25) * BAR_MAX))),
                  backgroundColor: i === weeklyScores.length - 1 ? colors.primary : colors.primaryBar,
                },
              ]}
            />
          ))}
        </View>
      </Card>

      <Card style={{ gap: 12 }}>
        <View style={styles.between}>
          <Text style={styles.h2}>Grammar tracker</Text>
          <Text style={styles.label}>Last 30 days</Text>
        </View>
        {tracker.map((row) => (
          <TrackerItem key={row.name} row={row} />
        ))}
      </Card>

      <Card style={{ gap: 10 }}>
        <Text style={styles.h2}>Vocabulary vault</Text>
        {crutchWords.map((c) => (
          <View key={c.word} style={styles.crutch}>
            <Text style={styles.crutchWord}>{c.word}</Text>
            <Text style={styles.crutchCount}>{c.count}×</Text>
            <Text style={styles.crutchAlts}>{c.alternatives.join(' · ')}</Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

function TrackerItem({ row }: { row: TrackerRow }) {
  const status = STATUS[row.status];
  const mastered = row.status === 'mastered';
  return (
    <View style={[{ gap: 6 }, mastered && { opacity: 0.55 }]}>
      <View style={styles.between}>
        <Text style={styles.trackerName}>{row.name}</Text>
        <Text style={styles.trackerStatus}>{mastered ? status.label : `${status.label} · ${row.count30d}×`}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round((mastered ? 1 : row.severity) * 100)}%`, backgroundColor: status.color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: fonts.bold, fontSize: 28, letterSpacing: em(28, -0.02) },
  h2: { fontFamily: fonts.bold, fontSize: 16 },
  label: { fontFamily: fonts.semibold, fontSize: 12, color: colors.muted },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },

  scoreCard: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 },
  score: { fontFamily: fonts.extrabold, fontSize: 44, lineHeight: 46, letterSpacing: em(44, -0.03) },
  outOf: { fontFamily: fonts.semibold, fontSize: 16, letterSpacing: 0, color: colors.muted },
  gain: { fontFamily: fonts.bold, fontSize: 13, color: colors.success },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: BAR_MAX },
  bar: { width: 12, borderRadius: 4 },

  trackerName: { fontFamily: fonts.semibold, fontSize: 14 },
  trackerStatus: { fontFamily: fonts.semibold, fontSize: 14, color: colors.muted },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.divider, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },

  crutch: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  crutchWord: {
    minWidth: 64,
    fontFamily: fonts.bold,
    fontSize: 14,
    textDecorationLine: 'line-through',
    textDecorationColor: colors.strike,
  },
  crutchCount: { minWidth: 28, fontFamily: fonts.semibold, fontSize: 12, color: colors.muted },
  crutchAlts: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.vocabText },
});
