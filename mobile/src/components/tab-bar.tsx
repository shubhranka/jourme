import { useRouter } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { Text } from '@/components/text';
import { colors, fonts } from '@/theme/tokens';

const TAB_ICONS: Record<string, IconName> = {
  index: 'home',
  progress: 'chart',
  journal: 'calendar',
  you: 'user',
};

// Design tab bar: four tabs with the raised Scan button in the middle. Scan is not a tab;
// it opens the full-screen scanner modal.
export function TabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const router = useRouter();
  const tabs = state.routes.map((route, index) => {
    const focused = index === state.index;
    const label = descriptors[route.key].options.title ?? route.name;
    const onPress = () => {
      const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) navigateToTab(route.key);
    };
    const color = focused ? colors.primary : colors.muted;
    return (
      <Pressable
        key={route.key}
        onPress={onPress}
        accessibilityRole="tab"
        aria-selected={focused}
        accessibilityLabel={label}
        style={styles.tab}>
        <Icon name={TAB_ICONS[route.name] ?? 'home'} color={color} />
        <Text style={[styles.label, { color, fontFamily: focused ? fonts.bold : fonts.semibold }]}>{label}</Text>
      </Pressable>
    );
  });

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {tabs.slice(0, 2)}
      <Pressable
        onPress={() => router.push('/scan')}
        accessibilityRole="button"
        accessibilityLabel="Scan a page"
        style={({ pressed }) => [styles.scan, pressed && { opacity: 0.85 }]}>
        <Icon name="camera" size={26} color="#FFFFFF" />
      </Pressable>
      {tabs.slice(2)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    paddingTop: 8,
    paddingHorizontal: 8,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tab: { width: 64, minHeight: 48, alignItems: 'center', gap: 4 },
  label: { fontSize: 11 },
  scan: {
    width: 60,
    height: 60,
    marginTop: -24,
    borderRadius: 30,
    borderWidth: 4,
    borderColor: colors.bg,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
