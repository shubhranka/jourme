import { useMutation } from '@tanstack/react-query';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, BackHandler, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton } from '@/components/buttons';
import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { useUserId } from '@/lib/auth';
import { startCoaching } from '@/lib/coach';
import { useEntrySaved, useTodayPrompt } from '@/lib/entries';
import { plural } from '@/lib/text';
import { MAX_PAGES, uploadEntry, uploadErrorMessage, type CapturedPage } from '@/lib/upload';
import { colors, fonts, radii } from '@/theme/tokens';

const SCANNER = colors.scanner;

// expo-camera on web hands back bare base64 rather than a data URI.
function imageUri(uri: string): string {
  return /^(data|blob|https?|file|content|ph|assets-library):/.test(uri) ? uri : `data:image/jpeg;base64,${uri}`;
}

let lastKey = 0;
const newKey = () => `page-${++lastKey}`;

type Notice = { text: string; tone: 'ok' | 'warn' };

// Photograph one or more notebook pages (or pick photos), then save them as one entry.
// "Page found" detection is deferred: the corners are a static guide.
export default function ScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = useUserId();
  const prompt = useTodayPrompt();
  const entrySaved = useEntrySaved();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);

  const [pages, setPages] = useState<CapturedPage[]>([]);
  // The entry a failed save created; a retry with the same pages continues it.
  const [entryId, setEntryId] = useState<string | null>(null);
  const [torch, setTorch] = useState(false);
  const [justListen, setJustListen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [sheet, setSheet] = useState<'review' | 'discard' | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [progress, setProgress] = useState({ saved: 0, total: 0 });

  const save = useMutation({
    mutationFn: () =>
      uploadEntry({
        userId: userId!,
        pages,
        promptId: prompt.data?.id ?? null,
        justListen,
        entryId,
        onEntryCreated: setEntryId,
        onProgress: (saved, total) => setProgress({ saved, total }),
      }),
    onSuccess: async (id) => {
      entrySaved();
      // Hand the pages to Coach. If that fails, the entry screen offers "Get feedback".
      await startCoaching(id).catch(() => undefined);
      router.replace({ pathname: '/entry/[id]', params: { id } });
    },
  });

  const full = pages.length >= MAX_PAGES;
  const busy = save.isPending;

  // Notices fade back to the framing hint.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 2200);
    return () => clearTimeout(t);
  }, [notice]);

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };
  const close = () => {
    if (pages.length > 0) setSheet('discard');
    else leave();
  };

  // Android's back button: close a sheet, or ask before throwing pages away.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (busy) return true;
      if (sheet) {
        setSheet(null);
        return true;
      }
      if (pages.length > 0) {
        setSheet('discard');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [busy, sheet, pages.length]);

  // A different set of pages is a new entry, not a retry of a failed one.
  const changePages = (next: CapturedPage[]) => {
    setPages(next);
    setEntryId(null);
  };

  const addPages = (uris: string[]) => {
    const added = uris.slice(0, MAX_PAGES - pages.length).map((uri) => ({ key: newKey(), uri: imageUri(uri) }));
    if (added.length === 0) return;
    changePages([...pages, ...added]);
    setNotice({ tone: 'ok', text: added.length === 1 ? `Page ${pages.length + 1} added` : `${added.length} pages added` });
  };

  const capture = async () => {
    if (!camera.current || !cameraReady || capturing || full) return;
    setCapturing(true);
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.9 });
      if (photo?.uri) addPages([photo.uri]);
    } catch {
      setNotice({ tone: 'warn', text: 'Couldn’t take the photo. Try again.' });
    } finally {
      setCapturing(false);
    }
  };

  const pickPhotos = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: true,
      selectionLimit: MAX_PAGES - pages.length,
      orderedSelection: true,
      quality: 1,
    });
    if (!result.canceled) addPages(result.assets.map((a) => a.uri));
  };

  const deletePage = (key: string) => {
    const next = pages.filter((p) => p.key !== key);
    changePages(next);
    if (next.length === 0) setSheet(null);
  };

  let status: Notice = { tone: 'warn', text: 'Fit the page inside the corners' };
  if (notice) status = notice;
  else if (full) status = { tone: 'warn', text: `That’s ${MAX_PAGES} pages, the most for one entry` };
  else if (!cameraReady) status = { tone: 'warn', text: 'Starting the camera…' };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <IconButton icon="close" variant="dark" accessibilityLabel="Close scanner" onPress={close} disabled={busy} />
        <View style={styles.title}>
          <Text style={styles.titleText}>Scan entry</Text>
          <Text style={styles.subtitle}>{full ? plural(MAX_PAGES, 'page') : `Page ${pages.length + 1}`}</Text>
        </View>
        <IconButton
          icon="flash"
          variant="dark"
          strokeWidth={1.9}
          accessibilityLabel="Torch"
          accessibilityRole="switch"
          aria-checked={torch}
          disabled={!permission?.granted}
          color={torch ? colors.ink : '#FFFFFF'}
          style={[torch && { backgroundColor: colors.yellow }, !permission?.granted && { opacity: 0.4 }]}
          onPress={() => setTorch((t) => !t)}
        />
      </View>

      <View style={styles.viewfinder}>
        {permission?.granted ? (
          <>
            <CameraView
              ref={camera}
              style={StyleSheet.absoluteFill}
              facing="back"
              enableTorch={torch}
              onCameraReady={() => setCameraReady(true)}
              onMountError={() => setNotice({ tone: 'warn', text: 'The camera didn’t start. Try photos instead.' })}
            />
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
            <View style={styles.status} accessibilityRole="text" accessibilityLiveRegion="polite" aria-live="polite">
              <View style={[styles.statusDot, status.tone === 'ok' && { backgroundColor: SCANNER.ok }]} />
              <Text style={styles.statusText}>{status.text}</Text>
            </View>
          </>
        ) : permission ? (
          <CameraPermission canAskAgain={permission.canAskAgain} onAllow={requestPermission} onPick={pickPhotos} />
        ) : null}
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
            disabled={busy}
            accessibilityLabel="Just Listen: no corrections or scores"
            trackColor={{ false: SCANNER.controlBorder, true: colors.yellow }}
            ios_backgroundColor={SCANNER.controlBorder}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={styles.captureRow}>
          {pages.length > 0 ? (
            <Pressable
              onPress={() => setSheet('review')}
              accessibilityRole="button"
              accessibilityLabel={`Review ${plural(pages.length, 'page')}`}
              style={styles.thumb}>
              <View style={styles.thumbClip}>
                <Image source={{ uri: pages[pages.length - 1].uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pages.length}</Text>
              </View>
            </Pressable>
          ) : (
            <IconButton icon="image" variant="dark" accessibilityLabel="Choose from photos" onPress={pickPhotos} style={styles.gallery} />
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Capture page"
            disabled={!permission?.granted || !cameraReady || capturing || full}
            aria-disabled={!permission?.granted || !cameraReady || capturing || full}
            onPress={capture}
            style={({ pressed }) => [styles.shutter, (pressed || capturing) && { opacity: 0.8 }, (!cameraReady || full) && { opacity: 0.4 }]}>
            <View style={styles.shutterInner} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={pages.length === 0 || busy}
            aria-disabled={pages.length === 0 || busy}
            onPress={() => save.mutate()}
            style={({ pressed }) => [styles.done, pages.length === 0 && { opacity: 0.4 }, pressed && { opacity: 0.8 }]}>
            <Text style={styles.doneText}>Done</Text>
            <Icon name="chevronRight" size={18} strokeWidth={2.2} />
          </Pressable>
        </View>
      </View>

      {sheet === 'review' && !busy && (
        <Sheet bottom={insets.bottom}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle} accessibilityRole="header">
              {plural(pages.length, 'page')}
            </Text>
            <IconButton icon="close" variant="dark" accessibilityLabel="Close review" onPress={() => setSheet(null)} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {pages.map((p, i) => (
              <View key={p.key} style={styles.reviewPage}>
                <View style={styles.reviewClip}>
                  <Image source={{ uri: p.uri }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel={`Page ${i + 1}`} />
                </View>
                <View style={styles.reviewFooter}>
                  <Text style={styles.reviewLabel}>Page {i + 1}</Text>
                  <IconButton icon="trash" variant="dark" iconSize={18} accessibilityLabel={`Delete page ${i + 1}`} onPress={() => deletePage(p.key)} />
                </View>
              </View>
            ))}
          </ScrollView>
          <View style={styles.sheetActions}>
            {!full && (
              <Button variant="outline" style={{ flex: 1 }} onPress={pickPhotos}>
                Add from photos
              </Button>
            )}
            <Button variant="yellow" style={{ flex: 1 }} onPress={() => setSheet(null)}>
              Keep scanning
            </Button>
          </View>
        </Sheet>
      )}

      {sheet === 'discard' && !busy && (
        <Sheet bottom={insets.bottom}>
          <Text style={styles.sheetTitle} accessibilityRole="header">
            Discard {plural(pages.length, 'page')}?
          </Text>
          <Text style={styles.sheetBody}>They haven’t been saved yet.</Text>
          <View style={styles.sheetActions}>
            <Button variant="outline" style={{ flex: 1 }} onPress={() => setSheet(null)}>
              Keep scanning
            </Button>
            <Button variant="white" style={{ flex: 1 }} onPress={leave}>
              <Text style={styles.discardLabel}>Discard</Text>
            </Button>
          </View>
        </Sheet>
      )}

      {(busy || save.isError) && (
        <Sheet bottom={insets.bottom}>
          {busy ? (
            <View style={styles.saving} accessibilityLiveRegion="polite" aria-live="polite">
              <ActivityIndicator color={colors.yellow} />
              <Text style={styles.sheetTitle}>
                {progress.total === 0 || progress.saved < progress.total
                  ? `Saving page ${Math.min(progress.saved + 1, Math.max(progress.total, 1))} of ${Math.max(progress.total, pages.length)}…`
                  : 'Finishing up…'}
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.sheetTitle} accessibilityRole="header">
                Your pages weren’t saved
              </Text>
              <Text style={styles.sheetBody} accessibilityRole="alert">
                {uploadErrorMessage(save.error)}
              </Text>
              <View style={styles.sheetActions}>
                <Button variant="outline" style={{ flex: 1 }} onPress={() => save.reset()}>
                  Back
                </Button>
                <Button variant="yellow" style={{ flex: 1 }} onPress={() => save.mutate()}>
                  Try again
                </Button>
              </View>
            </>
          )}
        </Sheet>
      )}
    </View>
  );
}

function CameraPermission({ canAskAgain, onAllow, onPick }: { canAskAgain: boolean; onAllow: () => void; onPick: () => void }) {
  const blocked = !canAskAgain;
  return (
    <View style={styles.permission}>
      <Icon name="camera" size={34} color="#FFFFFF" strokeWidth={1.7} />
      <Text style={styles.permissionTitle}>Scan pages with your camera</Text>
      <Text style={styles.permissionBody}>
        {blocked
          ? 'Camera access is off for Jourme. Turn it on in Settings, or add photos you’ve already taken.'
          : 'Jourme needs the camera to photograph your notebook. Your pages stay private to you.'}
      </Text>
      {!blocked ? (
        <Button variant="yellow" style={styles.permissionButton} onPress={onAllow}>
          Allow camera
        </Button>
      ) : Platform.OS !== 'web' ? (
        <Button variant="yellow" style={styles.permissionButton} onPress={() => Linking.openSettings()}>
          Open Settings
        </Button>
      ) : null}
      <Button variant="outline" style={styles.permissionButton} onPress={onPick}>
        Choose from photos
      </Button>
    </View>
  );
}

// A bottom sheet over the scanner (review, discard, saving).
function Sheet({ children, bottom }: { children: ReactNode; bottom: number }) {
  return (
    <View style={styles.backdrop}>
      <View style={[styles.sheet, { paddingBottom: Math.max(bottom, 16) + 8 }]} accessibilityViewIsModal aria-modal>
        {children}
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

  viewfinder: {
    flex: 1,
    marginHorizontal: 12,
    borderRadius: radii.xxl,
    overflow: 'hidden',
    backgroundColor: '#000000',
    justifyContent: 'center',
  },
  corner: CORNER,
  tl: { top: 18, left: 18, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 10 },
  tr: { top: 18, right: 18, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 10 },
  bl: { bottom: 18, left: 18, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 10 },
  br: { bottom: 18, right: 18, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 10 },
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

  permission: { alignItems: 'center', gap: 12, paddingHorizontal: 28 },
  permissionTitle: { fontFamily: fonts.bold, fontSize: 18, color: '#FFFFFF', textAlign: 'center', marginTop: 4 },
  permissionBody: { fontSize: 14, lineHeight: 20, color: SCANNER.muted, textAlign: 'center', marginBottom: 6 },
  permissionButton: { alignSelf: 'stretch' },

  controls: { paddingTop: 16, paddingHorizontal: 20, gap: 20 },
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
  gallery: { width: 56, height: 56, borderRadius: radii.sm },
  thumb: { width: 56, height: 56 },
  thumbClip: { flex: 1, borderRadius: radii.sm, borderWidth: 2, borderColor: '#FFFFFF', overflow: 'hidden', backgroundColor: SCANNER.paper },
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

  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(17, 19, 24, 0.72)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: SCANNER.control,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    paddingTop: 20,
    paddingHorizontal: 20,
    gap: 14,
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle: { fontFamily: fonts.bold, fontSize: 18, color: '#FFFFFF' },
  sheetBody: { fontSize: 14, lineHeight: 20, color: SCANNER.muted },
  sheetActions: { flexDirection: 'row', gap: 10 },
  reviewPage: { width: 168, gap: 8 },
  reviewClip: { width: 168, aspectRatio: 3 / 4, borderRadius: radii.md, overflow: 'hidden', backgroundColor: SCANNER.paper },
  reviewFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewLabel: { fontFamily: fonts.semibold, fontSize: 13, color: '#FFFFFF' },
  discardLabel: { fontFamily: fonts.bold, fontSize: 15, color: colors.strike },
  saving: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
});
