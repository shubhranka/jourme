import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/buttons';
import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { scanResultEntryId } from '@/data/mock';
import { colors, fonts, radii } from '@/theme/tokens';

const SCANNER = colors.scanner;
const RULE_GAP = 32;

// Phase 1: the ruled page stands in for the camera preview and the shutter only counts
// pages. expo-camera replaces both in Phase 3.
export default function ScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [pages, setPages] = useState(0);
  const [flash, setFlash] = useState(false);
  const [justListen, setJustListen] = useState(false);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <IconButton icon="close" variant="dark" accessibilityLabel="Close scanner" onPress={() => router.back()} />
        <View style={styles.title}>
          <Text style={styles.titleText}>Scan entry</Text>
          <Text style={styles.subtitle}>Page {pages + 1}</Text>
        </View>
        <IconButton
          icon="flash"
          variant="dark"
          strokeWidth={1.9}
          accessibilityLabel="Flash"
          accessibilityRole="switch"
          aria-checked={flash}
          color={flash ? colors.ink : '#FFFFFF'}
          style={flash && { backgroundColor: colors.yellow }}
          onPress={() => setFlash((f) => !f)}
        />
      </View>

      <View style={styles.viewfinder}>
        <View style={styles.paper}>
          {Array.from({ length: 13 }, (_, i) => (
            <View key={i} style={[styles.rule, { top: 18 + RULE_GAP - 1 + i * RULE_GAP }]} />
          ))}
          <View style={styles.margin} />
          <Text style={styles.hand}>27 Oct — best thing I ate</Text>
          <Text style={styles.hand}>
            Today I eat rajma chawal that I cooked by myself. It was very good. Then I called my mom and she was very happy. I miss
            the taste of my grandmother food…
          </Text>
        </View>
        <View style={[styles.corner, styles.tl]} />
        <View style={[styles.corner, styles.tr]} />
        <View style={[styles.corner, styles.bl]} />
        <View style={[styles.corner, styles.br]} />
        <View style={styles.status} accessibilityRole="text" accessibilityLiveRegion="polite">
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Fit the page inside the corners</Text>
        </View>
      </View>

      <View style={[styles.controls, { paddingBottom: Math.max(insets.bottom, 16) + 20 }]}>
        <View style={styles.justListen}>
          <View>
            <Text style={styles.jlTitle}>Just Listen</Text>
            <Text style={styles.jlSub}>No corrections or scores</Text>
          </View>
          <Switch
            value={justListen}
            onValueChange={setJustListen}
            accessibilityLabel="Just Listen: no corrections or scores"
            trackColor={{ false: SCANNER.controlBorder, true: colors.yellow }}
            ios_backgroundColor={SCANNER.controlBorder}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={styles.captureRow}>
          {pages > 0 ? (
            <View style={styles.thumb} accessibilityLabel={`${pages} ${pages === 1 ? 'page' : 'pages'} captured`}>
              {[7, 15, 23, 31, 39].map((top) => (
                <View key={top} style={[styles.thumbRule, { top }]} />
              ))}
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pages}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.thumbPlaceholder} />
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Capture page"
            onPress={() => setPages((n) => n + 1)}
            style={({ pressed }) => [styles.shutter, pressed && { opacity: 0.8 }]}>
            <View style={styles.shutterInner} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={pages === 0}
            onPress={() => router.replace({ pathname: '/entry/[id]', params: { id: scanResultEntryId } })}
            style={({ pressed }) => [styles.done, pages === 0 && { opacity: 0.4 }, pressed && { opacity: 0.8 }]}>
            <Text style={styles.doneText}>Done</Text>
            <Icon name="chevronRight" size={18} strokeWidth={2.2} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const CORNER = { position: 'absolute', width: 40, height: 40, borderColor: colors.yellow } as const;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: SCANNER.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12 },
  title: { alignItems: 'center', gap: 2 },
  titleText: { fontFamily: fonts.bold, fontSize: 16, color: '#FFFFFF' },
  subtitle: { fontSize: 12, color: SCANNER.muted },

  viewfinder: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 28, overflow: 'hidden' },
  paper: {
    height: '100%',
    maxHeight: 420,
    aspectRatio: 300 / 420,
    backgroundColor: SCANNER.paper,
    borderRadius: 6,
    transform: [{ rotate: '-2deg' }],
    paddingTop: 34,
    paddingRight: 22,
    paddingBottom: 22,
    paddingLeft: 40,
    overflow: 'hidden',
  },
  rule: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: SCANNER.rule },
  margin: { position: 'absolute', top: 0, bottom: 0, left: 30, width: 1, backgroundColor: SCANNER.margin },
  hand: { fontFamily: fonts.hand, fontSize: 22, lineHeight: RULE_GAP, color: colors.handInk },
  corner: CORNER,
  tl: { top: 18, left: 30, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 10 },
  tr: { top: 18, right: 30, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 10 },
  bl: { bottom: 18, left: 30, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 10 },
  br: { bottom: 18, right: 30, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 10 },
  status: {
    position: 'absolute',
    bottom: 34,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.ink,
    borderWidth: 1,
    borderColor: SCANNER.controlBorder,
    borderRadius: radii.pill,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: SCANNER.muted },
  statusText: { fontFamily: fonts.semibold, fontSize: 13, color: '#FFFFFF' },

  controls: { paddingTop: 12, paddingHorizontal: 20, gap: 20 },
  justListen: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    backgroundColor: SCANNER.control,
    borderRadius: radii.pill,
    paddingVertical: 6,
    paddingLeft: 16,
    paddingRight: 8,
  },
  jlTitle: { fontFamily: fonts.bold, fontSize: 14, color: '#FFFFFF' },
  jlSub: { fontSize: 11, color: SCANNER.muted },
  captureRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  thumb: { width: 56, height: 56, borderRadius: radii.sm, backgroundColor: SCANNER.paper, borderWidth: 2, borderColor: '#FFFFFF' },
  thumbPlaceholder: { width: 56, height: 56 },
  thumbRule: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: SCANNER.rule },
  badge: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: fonts.extrabold, fontSize: 12 },
  shutter: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: '#FFFFFF', padding: 5 },
  shutterInner: { flex: 1, borderRadius: 40, backgroundColor: '#FFFFFF' },
  done: {
    minWidth: 56,
    height: 48,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    backgroundColor: colors.yellow,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  doneText: { fontFamily: fonts.extrabold, fontSize: 15 },
});
