import { StyleSheet, Text, type TextProps } from 'react-native';
import { useTheme, TEXT_SCALE_MULTIPLIER } from '../theme';

// The drop-in Text for screen-local type. OS accessibility scaling was
// already respected everywhere (allowFontScaling default); what raw <Text>
// missed was the IN-APP Settings → Display +1/+2 preference, which the ui
// primitives apply but ~140 screen-local Texts did not (V3 Phase 1). This
// wraps RN Text, flattens the style, and multiplies its fontSize by the
// active preference — import it aliased (`ScaledText as Text`) so a screen
// migrates with a one-line diff.
//
// `anchored` opts a single Text out, for the two spec-named exemptions
// (design-spec §2 Font scaling): hero/guided numerals and mono-tabular
// table columns stay fixed so layouts hold. ShareCards never migrates at
// all — its capture canvas is a fixed-size print surface, not UI.

export function ScaledText({ anchored, style, ...rest }: TextProps & { anchored?: boolean }) {
  const { textScale } = useTheme();
  const multiplier = anchored ? 1 : TEXT_SCALE_MULTIPLIER[textScale];
  const flat = StyleSheet.flatten(style);
  const scaled =
    flat && typeof flat.fontSize === 'number'
      ? [flat, { fontSize: flat.fontSize * multiplier }]
      : style;
  return <Text style={scaled} {...rest} />;
}
