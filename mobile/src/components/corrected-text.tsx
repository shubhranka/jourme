import { Text as RNText, StyleSheet, type StyleProp, type TextStyle } from 'react-native';

import { Text } from '@/components/text';
import type { Correction } from '@/data/types';
import { colors, fonts } from '@/theme/tokens';

type Segment = { text: string } | { text: string; correction: Correction };

// Splits the transcript at correction offsets. Overlapping or out-of-range corrections are
// skipped rather than garbling the text.
export function segment(transcript: string, corrections: Correction[]): Segment[] {
  const out: Segment[] = [];
  let cursor = 0;
  for (const c of [...corrections].sort((a, b) => a.start - b.start)) {
    if (c.start < cursor || c.end > transcript.length || c.end <= c.start) continue;
    if (c.start > cursor) out.push({ text: transcript.slice(cursor, c.start) });
    out.push({ text: transcript.slice(c.start, c.end), correction: c });
    cursor = c.end;
  }
  if (cursor < transcript.length) out.push({ text: transcript.slice(cursor) });
  return out;
}

// The learner's page with inline marks: grammar fixes as strike-through plus a highlighted
// replacement, word upgrades as a dotted underline.
export function CorrectedText({ transcript, corrections, style }: { transcript: string; corrections: Correction[]; style?: StyleProp<TextStyle> }) {
  return (
    <Text style={[styles.page, style]}>
      {segment(transcript, corrections).map((s, i) => {
        if (!('correction' in s)) return s.text;
        const c = s.correction;
        if (c.kind === 'vocab') {
          return (
            <RNText key={i} style={styles.vocab}>
              {s.text}
            </RNText>
          );
        }
        return (
          <RNText key={i}>
            <RNText style={styles.del} accessibilityLabel={`${s.text}, corrected to`}>
              {s.text}
            </RNText>{' '}
            {/* Non-breaking spaces pad the highlight, standing in for CSS padding. */}
            <RNText style={styles.ins}>{` ${c.replacement} `}</RNText>
          </RNText>
        );
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  page: { fontFamily: fonts.hand, fontSize: 24, lineHeight: 34, color: colors.handInk },
  del: { color: colors.strike, textDecorationLine: 'line-through', textDecorationColor: colors.strike },
  ins: { fontFamily: fonts.handSemibold, backgroundColor: colors.yellow },
  // Dotted style is honoured on iOS and web; Android draws a solid underline.
  vocab: { textDecorationLine: 'underline', textDecorationStyle: 'dotted', textDecorationColor: colors.primary },
});
