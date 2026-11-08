import { View, type ViewProps } from 'react-native';

import { colors, radii } from '@/theme/tokens';

export function Card({ style, ...props }: ViewProps) {
  return (
    <View
      {...props}
      style={[
        { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.xl, padding: 16 },
        style,
      ]}
    />
  );
}
