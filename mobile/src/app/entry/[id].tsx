import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { Button, IconButton } from '@/components/buttons';
import { Card } from '@/components/card';
import { CorrectedText } from '@/components/corrected-text';
import { FieldError } from '@/components/form';
import { Screen } from '@/components/screen';
import { Eyebrow, MoodTag, NoteTag } from '@/components/tags';
import { Text } from '@/components/text';
import { entries } from '@/data/mock';
import { personaName } from '@/data/personas';
import type { Entry, EntryPage } from '@/data/types';
import { coachErrorMessage, useSaveToVault, useStartCoaching, useSwitchToJustListen } from '@/lib/coach';
import { formatLongDate } from '@/lib/dates';
import { useEntrySaved, useSavedEntry } from '@/lib/entries';
import { useProfile } from '@/lib/profile';
import { countWords, plural, sentenceHint } from '@/lib/text';
import { colors, em, fonts, radii } from '@/theme/tokens';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Coach feedback for one entry. Listen / Read it back and the Sunday review caption are
// hidden until those features ship.
export default function EntryScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  // Saved entries have UUIDs. The design's sample entries (still linked from Journal and
  // Progress until Phase 5) don't.
  if (UUID.test(id)) return <SavedEntryScreen id={id} back={back} />;

  const entry = entries[id];
  if (!entry) {
    return (
      <Screen>
        <IconButton icon="chevronLeft" accessibilityLabel="Back" onPress={back} />
        <Text style={styles.h1}>Entry not found</Text>
      </Screen>
    );
  }
  return <Feedback entry={entry} back={back} onSave={() => router.navigate('/progress')} />;
}

// The design's feedback layout. `children` go between Coach's reply and the page.
function Feedback({
  entry,
  back,
  onSave,
  saved = false,
  saving = false,
  saveError,
  children,
}: {
  entry: Entry;
  back: () => void;
  onSave: () => void;
  saved?: boolean;
  saving?: boolean;
  saveError?: string | null;
  children?: ReactNode;
}) {
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

      <CoachBubble by={`Coach · ${personaName(entry.persona)}`}>{entry.coachReply}</CoachBubble>

      {children}

      {entry.justListen ? (
        <Text style={styles.listenNote}>Just Listen: no corrections or scores for this one.</Text>
      ) : (
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

          {entry.nativeVersion ? (
            <View style={styles.native}>
              <Eyebrow color={colors.primaryTint}>How a native speaker might say it</Eyebrow>
              <Text style={styles.nativeText}>{entry.nativeVersion}</Text>
            </View>
          ) : null}

          {entry.nativeScore !== null && (
            <View style={styles.metrics}>
              <Card style={styles.metric}>
                <Text style={styles.metricLabel}>Native-like score</Text>
                <Text style={styles.metricValue}>{entry.nativeScore}</Text>
                <Text style={[styles.metricNote, delta !== null && delta > 0 && styles.metricUp]}>
                  {delta === null ? 'Your first week' : `${delta > 0 ? `+${delta}` : delta < 0 ? `−${-delta}` : '±0'} vs. last week`}
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
          )}

          <FieldError>{saveError}</FieldError>
          <Button style={styles.save} onPress={onSave} disabled={saving}>
            <Text style={styles.saveText}>{saving ? 'Saving…' : saved ? 'In your vault · See progress' : 'Save to my vault'}</Text>
          </Button>
        </>
      )}
    </Screen>
  );
}

function CoachBubble({ by, children }: { by: string; children: ReactNode }) {
  return (
    <View style={styles.reply}>
      <View style={styles.avatar} accessible={false}>
        <Text style={styles.avatarText}>C</Text>
      </View>
      <View style={styles.bubble}>
        <Text style={styles.bubbleBy}>{by}</Text>
        {typeof children === 'string' ? <Text style={styles.bubbleText}>{children}</Text> : children}
      </View>
    </View>
  );
}

// A real entry: feedback once coached; before that, its pages and where Coach is.
function SavedEntryScreen({ id, back }: { id: string; back: () => void }) {
  const router = useRouter();
  const query = useSavedEntry(id);
  const entry = query.data;
  const profile = useProfile();
  const start = useStartCoaching(id);
  const save = useSaveToVault(id);
  const listen = useSwitchToJustListen(id);
  const entrySaved = useEntrySaved();
  const [keepFeedback, setKeepFeedback] = useState(false);

  // When coaching lands (or fails), Today's card, the streak and the totals change.
  const status = entry?.status;
  useEffect(() => {
    if (status === 'ready' || status === 'failed') entrySaved();
    // entrySaved is a fresh closure each render; the status change is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  if (!entry) {
    return (
      <Screen>
        <IconButton icon="chevronLeft" accessibilityLabel="Back" onPress={back} />
        {query.isPending ? (
          <ActivityIndicator color={colors.primary} accessibilityLabel="Loading entry" />
        ) : query.isError ? (
          <View style={{ gap: 12 }}>
            <FieldError>Couldn’t load this entry. Check your connection and try again.</FieldError>
            <Button onPress={() => query.refetch()}>Try again</Button>
          </View>
        ) : (
          <Text style={styles.h1}>Entry not found</Text>
        )}
      </Screen>
    );
  }

  if (entry.feedback) {
    const offerListen = entry.heavy && !entry.justListen && (profile?.offerJustListen ?? true) && !keepFeedback;
    return (
      <Feedback
        entry={entry.feedback}
        back={back}
        saved={!!entry.savedAt}
        saving={save.isPending}
        saveError={save.error ? 'Couldn’t save it. Check your connection and try again.' : null}
        onSave={() => {
          if (entry.savedAt) router.navigate('/progress');
          else save.mutate(undefined, { onSuccess: () => router.navigate('/progress') });
        }}>
        {entry.safetyFlag && <SafetyCard />}
        {offerListen && (
          <Card style={styles.offer}>
            <Text style={styles.offerTitle}>This one feels heavy. Want me to just listen?</Text>
            <Text style={styles.offerBody}>I’ll hide the corrections and won’t count these mistakes.</Text>
            <FieldError>{listen.error ? 'Couldn’t switch. Please try again.' : null}</FieldError>
            <View style={styles.offerActions}>
              <Button variant="white" style={styles.offerButton} onPress={() => setKeepFeedback(true)} disabled={listen.isPending}>
                <Text style={styles.offerKeep}>Keep feedback</Text>
              </Button>
              <Button style={styles.offerButton} onPress={() => listen.mutate()} disabled={listen.isPending}>
                {listen.isPending ? 'Switching…' : 'Just listen'}
              </Button>
            </View>
          </Card>
        )}
      </Feedback>
    );
  }

  const one = entry.pageCount === 1;
  return (
    <Screen gap={20}>
      <View style={styles.header}>
        <IconButton icon="chevronLeft" accessibilityLabel="Back" onPress={back} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.h1} accessibilityRole="header">
            {formatLongDate(entry.localDate)}
          </Text>
          <Text style={styles.muted13}>
            Entry #{entry.number} · {plural(entry.pageCount, 'page')}
          </Text>
        </View>
        {entry.justListen && (
          <View style={styles.jlTag}>
            <Text style={styles.jlTagText}>Just Listen</Text>
          </View>
        )}
      </View>

      <CoachBubble by="Coach">
        {entry.status === 'processing' || start.isPending ? (
          <View style={styles.reading} accessibilityLiveRegion="polite" aria-live="polite">
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.bubbleText, { flex: 1 }]}>Reading your handwriting… This takes about a minute.</Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <Text style={styles.bubbleText}>
              {entry.failReason === 'no_handwriting'
                ? `I couldn’t find any handwriting in ${one ? 'this photo' : 'these photos'}. Scan your notebook page, or try again if I got it wrong.`
                : entry.status === 'failed'
                  ? `I couldn’t read ${one ? 'this page' : 'these pages'} just now.`
                  : `${one ? 'Your page is' : 'Your pages are'} saved. I haven’t read ${one ? 'it' : 'them'} yet.`}
            </Text>
            <FieldError>{start.error ? coachErrorMessage(start.error) : null}</FieldError>
            <Button onPress={() => start.mutate()}>{entry.status === 'failed' ? 'Try again' : 'Get feedback'}</Button>
          </View>
        )}
      </CoachBubble>

      <Pages pages={entry.pages} />
    </Screen>
  );
}

function Pages({ pages }: { pages: EntryPage[] }) {
  return (
    <View style={{ gap: 10 }}>
      <Eyebrow>{pages.length === 1 ? 'Your page' : 'Your pages'}</Eyebrow>
      {pages.map((p) => (
        <Card key={p.index} style={styles.photoCard}>
          <View style={styles.photo}>
            {p.url ? (
              <Image source={{ uri: p.url }} style={StyleSheet.absoluteFill} contentFit="contain" accessibilityLabel={`Page ${p.index + 1}`} />
            ) : (
              <Text style={styles.muted13}>This photo couldn’t be loaded.</Text>
            )}
          </View>
          {pages.length > 1 && <Text style={styles.photoCaption}>Page {p.index + 1}</Text>}
        </Card>
      ))}
    </View>
  );
}

// Shown when the coach flags that the writer may be in danger. Not in the design.
function SafetyCard() {
  return (
    <Card style={styles.safety} accessibilityRole="alert">
      <Text style={styles.safetyTitle}>You don’t have to carry this alone</Text>
      <Text style={styles.safetyBody}>
        If you might hurt yourself or someone else, or you’re in danger, call your local emergency number now. You can find a free,
        confidential helpline in your country at findahelpline.com.
      </Text>
      <Pressable accessibilityRole="link" onPress={() => Linking.openURL('https://findahelpline.com')} hitSlop={8}>
        <Text style={styles.safetyLink}>Find a helpline ›</Text>
      </Pressable>
    </Card>
  );
}


const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  jlTag: { borderRadius: radii.pill, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: colors.navy },
  jlTagText: { fontFamily: fonts.bold, fontSize: 12, color: '#FFFFFF' },
  photoCard: { padding: 10, gap: 8 },
  photo: { width: '100%', aspectRatio: 3 / 4, borderRadius: radii.sm, overflow: 'hidden', backgroundColor: colors.scanner.paper, alignItems: 'center', justifyContent: 'center' },
  photoCaption: { fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, textAlign: 'center' },
  h1: { fontFamily: fonts.bold, fontSize: 18 },
  muted13: { fontSize: 13, color: colors.muted },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  listenNote: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted, textAlign: 'center' },

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

  offer: { gap: 8, borderColor: colors.primaryTint, backgroundColor: colors.primarySoft },
  offerTitle: { fontFamily: fonts.bold, fontSize: 16 },
  offerBody: { fontSize: 14, lineHeight: 20, color: colors.inkSoft },
  offerActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  offerButton: { flex: 1 },
  offerKeep: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },

  safety: { gap: 8, borderColor: colors.strike, backgroundColor: colors.grammarSoft },
  safetyTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.grammarText },
  safetyBody: { fontSize: 14, lineHeight: 20, color: colors.inkSoft },
  safetyLink: { fontFamily: fonts.bold, fontSize: 14, color: colors.grammarText },

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
