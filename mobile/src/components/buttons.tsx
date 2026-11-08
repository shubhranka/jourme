import type { ReactNode } from 'react';
import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { Text } from '@/components/text';
import { colors, fonts, radii } from '@/theme/tokens';

type IconButtonProps = Omit<PressableProps, 'style'> & {
  icon: IconName;
  accessibilityLabel: string;
  variant?: 'light' | 'dark' | 'bare';
  iconSize?: number;
  strokeWidth?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

// 44pt round button (back, close, flash, month arrows).
export function IconButton({ icon, variant = 'light', iconSize = 20, strokeWidth = 2, color, style, ...props }: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={4}
      {...props}
      style={({ pressed }) => [styles.icon, styles[variant], pressed && styles.pressed, style]}>
      <Icon name={icon} size={iconSize} strokeWidth={strokeWidth} color={color ?? (variant === 'dark' ? '#FFFFFF' : colors.ink)} />
    </Pressable>
  );
}

type ButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  variant?: 'ink' | 'white' | 'outline' | 'yellow';
  style?: StyleProp<ViewStyle>;
};

export function Button({ children, variant = 'ink', style, ...props }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      {...props}
      style={({ pressed }) => [styles.button, buttonVariants[variant], pressed && styles.pressed, props.disabled && styles.disabled, style]}>
      {typeof children === 'string' ? (
        <Text style={[styles.buttonLabel, { color: variant === 'ink' || variant === 'outline' ? '#FFFFFF' : colors.ink }]}>
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  light: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong },
  dark: { backgroundColor: colors.scanner.control },
  bare: { backgroundColor: 'transparent' },
  button: {
    height: 48,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  buttonLabel: { fontFamily: fonts.bold, fontSize: 15 },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.4 },
});

const buttonVariants = StyleSheet.create({
  ink: { backgroundColor: colors.ink },
  white: { backgroundColor: colors.surface },
  outline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primaryLine },
  yellow: { backgroundColor: colors.yellow },
});
