import { Text as RNText, type TextProps } from 'react-native';

import { colors, fonts } from '@/theme/tokens';

// Text with the app's default font and colour. For spans nested inside another Text, use
// react-native's Text directly: this wrapper would reset an inherited font (e.g. Caveat).
export function Text({ style, ...props }: TextProps) {
  return <RNText {...props} style={[{ fontFamily: fonts.regular, color: colors.ink }, style]} />;
}
