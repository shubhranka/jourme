// Design tokens lifted from "Jourme — App Design.html". Light theme only, as designed.

export const colors = {
  bg: '#F7F6F2',
  surface: '#FFFFFF',
  ink: '#16181D',
  inkSoft: '#3A3E47',
  muted: '#5D616B',
  faint: '#8A8E97',
  border: '#E6E3DA',
  borderStrong: '#E2DFD6',
  divider: '#EEECE6',
  dashed: '#C9C5B9',

  primary: '#2747D6',
  primaryDark: '#1A33A3',
  primarySoft: '#EEF1FD',
  primaryTint: '#D5DCFA',
  primaryLine: '#6F86E6',
  primaryBar: '#C9D2F6',

  yellow: '#FFE45C',
  navy: '#1F2A44',
  handInk: '#1F2A44',

  grammarText: '#8A2E21',
  grammarSoft: '#FBE3DE',
  strike: '#A3392A',
  vocabText: '#1A33A3',
  vocabSoft: '#E3E8FC',
  success: '#1E5A42',
  successSoft: '#DDF1E8',

  trackerBad: '#D9644A',
  trackerMid: '#F2B33D',
  trackerGood: '#7FC8A9',

  scanner: {
    bg: '#111318',
    control: '#262A33',
    controlBorder: '#3A3F4A',
    muted: '#B4B8C2',
    paper: '#F4F1E8',
    rule: '#C8D3EC',
    margin: '#E8A8A0',
    ok: '#7FC8A9',
  },
} as const;

// Per-weight families, as exported by @expo-google-fonts. Set fontFamily, not fontWeight:
// a custom family ignores fontWeight on Android.
export const fonts = {
  regular: 'InterTight_400Regular',
  medium: 'InterTight_500Medium',
  semibold: 'InterTight_600SemiBold',
  bold: 'InterTight_700Bold',
  extrabold: 'InterTight_800ExtraBold',
  hand: 'Caveat_400Regular',
  handSemibold: 'Caveat_600SemiBold',
} as const;

export const radii = { sm: 12, md: 14, lg: 16, xl: 20, xxl: 24, pill: 999 } as const;

export const gutter = 20;

// CSS letter-spacing in em -> React Native points.
export function em(fontSize: number, value: number): number {
  return Math.round(fontSize * value * 100) / 100;
}
