import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { Button, IconButton } from '@/components/buttons';
import { Card } from '@/components/card';
import { CorrectedText } from '@/components/corrected-text';
import { Screen } from '@/components/screen';
import { Eyebrow, MoodTag, NoteTag } from '@/components/tags';
import { Text } from '@/components/text';
import { entries } from '@/data/mock';
import { personaName } from '@/data/personas';
import { formatLongDate } from '@/lib/dates';
import { countWords, plural, sentenceHint } from '@/lib/text';
import { colors, em, fonts, radii } from '@/theme/tokens';

// Coach feedback for one entry. Listen / Read it back and the Sunday review caption are
// hidden until those features ship.
export default function EntryScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const entry = entries[id];
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (!entry) {
    return (
      <Screen>
        <IconButton icon="chevronLeft" accessibilityLabel="Back" onPress={back} />
        <Text style={styles.h1}>Entry not found</Text>
      </Screen>
    );
  }

  const delta = entry.scoreDeltaVsLastWeek;

  return (
    <Screen gap={20}>
      <View style={styles.header}>
        <IconButton icon="chevronLeft" accessibilityLabel="Back" onPress={back} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.h1} accessibilityRole="header">
            {formatLongDate(entry.localDate)}
          </Text>
          <Text style={styles.muted13}>
            Entry #{entry.number} · {plural(countWords(entry.transcript), 'word')}
          </Text>
        </View>
        <MoodTag mood={entry.mood} />
      </View>

      <View style={styles.reply}>
        <View style={styles.avatar} accessible={false}>
          <Text style={styles.avatarText}>C</Text>
        </View>
        <View style={styles.bubble}>
          <Text style={styles.bubbleBy}>Coach · {personaName(entry.persona)}</Text>
          <Text style={styles.bubbleText}>{entry.coachReply}</Text>
        </View>
      </View>

      {!entry.justListen && (
        <>
          <Card style={styles.page}>
            <View style={styles.between}>
              <Eyebrow>Your page</Eyebrow>
              <Text style={styles.fixCount}>{plural(entry.corrections.length, 'fix', 'fixes')}</Text>
            </View>
            <CorrectedText transcript={entry.transcript} corrections={entry.corrections} />
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={styles.swatch} />
                <Text style={styles.legendText}>Grammar fix</Text>
              </View>
              <View style={styles.legendItem}>
                <Svg width={14} height={4}>
                  <Line x1={1.5} y1={2} x2={13} y2={2} stroke={colors.primary} strokeWidth={2.5} strokeDasharray="0.1 4" strokeLinecap="round" />
                </Svg>
                <Text style={styles.legendText}>Word upgrade</Text>
              </View>
            </View>
          </Card>

          {entry.notes.length > 0 && (
            <View style={{ gap: 10 }}>
              <Eyebrow>{"Coach's notes"}</Eyebrow>
              {entry.notes.map((n) => (
                <Card key={n.title} style={styles.note}>
                  <View style={[styles.between, { gap: 8 }]}>
                    <Text style={styles.noteTitle}>{n.title}</Text>
                    <NoteTag tag={n.tag} />
                  </View>
                  <Text style={styles.noteBody}>{n.body}</Text>
                </Card>
              ))}
            </View>
          )}

          <View style={styles.native}>
            <Eyebrow color={colors.primaryTint}>How a native speaker might say it</Eyebrow>
            <Text style={styles.nativeText}>{entry.nativeVersion}</Text>
          </View>

          <View style={styles.metrics}>
            <Card style={styles.metric}>
              <Text style={styles.metricLabel}>Native-like score</Text>
              <Text style={styles.metricValue}>{entry.nativeScore}</Text>
              <Text style={[styles.metricNote, delta > 0 && styles.metricUp]}>
                {delta > 0 ? `+${delta}` : delta < 0 ? `−${-delta}` : '±0'} vs. last week
              </Text>
            </Card>
            <Card style={styles.metric}>
              <Text style={styles.metricLabel}>Avg. sentence</Text>
              <Text style={styles.metricValue}>
                {entry.avgSentenceLength.toFixed(1)}
                <Text style={styles.metricUnit}> words</Text>
              </Text>
              <Text style={styles.metricNote}>{sentenceHint(entry.avgSentenceLength)}</Text>
            </Card>
          </View>
        </>
      )}

      <Button style={styles.save} onPress={() => router.navigate('/progress')}>
        <Text style={styles.saveText}>Save to my vault</Text>
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  h1: { fontFamily: fonts.bold, fontSize: 18 },
  muted13: { fontSize: 13, color: colors.muted },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  reply: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.yellow, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.extrabold, fontSize: 15 },
  bubble: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    borderTopLeftRadius: 4,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 6,
  },
  bubbleBy: { fontFamily: fonts.bold, fontSize: 12, color: colors.muted },
  bubbleText: { fontSize: 16, lineHeight: 23 },

  page: { padding: 18, gap: 12 },
  fixCount: { fontFamily: fonts.semibold, fontSize: 12, color: colors.muted },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 14, height: 10, borderRadius: 3, backgroundColor: colors.yellow },
  legendText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.muted },

  note: { borderRadius: radii.lg, paddingVertical: 14, gap: 6 },
  noteTitle: { fontFamily: fonts.bold, fontSize: 15, flexShrink: 1 },
  noteBody: { fontSize: 14, lineHeight: 20, color: colors.inkSoft },

  native: { backgroundColor: colors.primary, borderRadius: radii.xxl, padding: 20, gap: 14 },
  nativeText: { fontFamily: fonts.medium, fontSize: 18, lineHeight: 27, color: '#FFFFFF' },

  metrics: { flexDirection: 'row', gap: 10 },
  metric: { flex: 1, borderRadius: radii.lg, gap: 4 },
  metricLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.muted },
  metricValue: { fontFamily: fonts.extrabold, fontSize: 32, letterSpacing: em(32, -0.02) },
  metricUnit: { fontFamily: fonts.semibold, fontSize: 15, letterSpacing: 0, color: colors.muted },
  metricNote: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted },
  metricUp: { fontFamily: fonts.bold, color: colors.success },

  save: { height: 52 },
  saveText: { fontFamily: fonts.bold, fontSize: 16, color: '#FFFFFF' },
});
