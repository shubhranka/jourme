import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, gutter } from '@/theme/tokens';

// Scrolling page body used by the tab screens and the feedback screen.
export function Screen({ children, gap = 16 }: { children: ReactNode; gap?: number }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, gap }]}
      showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  // Bottom padding clears the Scan button, which rises above the tab bar.
  content: { paddingHorizontal: gutter, paddingBottom: 40 },
});
