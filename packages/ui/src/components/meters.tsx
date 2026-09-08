import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme, resolveTypeface } from '../theme';
import { useCountUp } from '../motion/Motion';
import { ScaledText as Text } from './scaledText';
import type { TextStyle } from 'react-native';

// Ring/dial hero meters — theme-scoped expression (meter: 'ring' | 'dial').
// HONESTY LIMIT, enforced by conformance: a ring can only show 0–100%, so
// any over-cap state MUST also be stated in words by the surface that uses
// these (overCap 'word'/'all' is mandatory on ring/dial themes). Fat is
// never a ring anywhere — it renders as words in the caps row.

function ringDash(r: number, fraction: number): { dasharray: number; dashoffset: number } {
  const c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, fraction));
  return { dasharray: c, dashoffset: c * (1 - f) };
}

export type HeroRing = { fraction: number; fill: string };

/** Three nested rings (outer → inner), value + label centered. */
/** One ring arc that DRAWS to its fraction — from zero on first appearance,
 *  from its previous value on updates; instant under reduced motion. */
function RingArc({ r, fill, fraction, stroke }: { r: number; fill: string; fraction: number; stroke: number }) {
  const animated = useCountUp(fraction);
  const { dasharray, dashoffset } = ringDash(r, animated);
  return (
    <Circle
      cx={75} cy={75} r={r} fill="none"
      stroke={fill} strokeWidth={stroke} strokeLinecap="round"
      strokeDasharray={dasharray} strokeDashoffset={dashoffset}
      transform="rotate(-90 75 75)"
    />
  );
}

export function HeroRings({
  rings, centerValue, centerLabel, size = 150,
}: {
  rings: HeroRing[];
  centerValue: string;
  centerLabel: string;
  size?: number;
}) {
  const { theme } = useTheme();
  const radii = [66, 52, 38];
  const stroke = 11;
  const dataFont = resolveTypeface(theme.typography.display, theme.typography.weight.bold);
  const dataWeight = String(theme.typography.weight.bold) as TextStyle['fontWeight'];
  return (
    <View style={{ width: size, height: size }}>
      <Svg viewBox="0 0 150 150" width={size} height={size}>
        {rings.slice(0, 3).map((ring, i) => {
          const r = radii[i]!;
          return [
            <Circle key={`t${i}`} cx={75} cy={75} r={r} fill="none" stroke={ring.fill} strokeOpacity={0.18} strokeWidth={stroke} />,
            <RingArc key={`f${i}`} r={r} fill={ring.fill} fraction={ring.fraction} stroke={stroke} />,
          ];
        })}
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <Text style={[styles.centerValue, { color: theme.text.ink, fontFamily: dataFont, fontWeight: dataWeight }]} maxFontSizeMultiplier={1.3}>
          {centerValue}
        </Text>
        <Text style={[styles.centerLabel, { color: theme.text.mute }]} maxFontSizeMultiplier={1.3}>{centerLabel}</Text>
      </View>
    </View>
  );
}

/** One dial (Soft's hero): a single arc with the value centered. */
export function HeroDial({
  fraction, value, label, size = 164,
}: {
  fraction: number;
  value: string;
  label: string;
  size?: number;
}) {
  const { theme } = useTheme();
  const r = 70;
  const stroke = 12;
  const { dasharray, dashoffset } = ringDash(r, fraction);
  const dataFont = resolveTypeface(theme.typography.display, theme.typography.weight.bold);
  const dataWeight = String(theme.typography.weight.bold) as TextStyle['fontWeight'];
  return (
    <View style={[{ width: size, height: size }, styles.dialWrap]}>
      <Svg viewBox="0 0 164 164" width={size} height={size}>
        <Circle cx={82} cy={82} r={r} fill="none" stroke={theme.surfaces.surface2} strokeWidth={stroke} />
        <Circle
          cx={82} cy={82} r={r} fill="none"
          stroke={theme.fill.mark} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={dasharray} strokeDashoffset={dashoffset}
          transform="rotate(-90 82 82)"
        />
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <Text style={[styles.dialValue, { color: theme.text.ink, fontFamily: dataFont, fontWeight: dataWeight }]} maxFontSizeMultiplier={1.3}>
          {value}
        </Text>
        <Text style={[styles.centerLabel, { color: theme.text.mute }]} maxFontSizeMultiplier={1.3}>{label}</Text>
      </View>
    </View>
  );
}

/** The ring legend — dot, name, value. Lives beside HeroRings. */
export function RingKey({ items }: { items: { fill: string; name: string; value: string }[] }) {
  const { theme } = useTheme();
  return (
    <View style={styles.key}>
      {items.map((it, i) => (
        <View key={i} style={styles.keyRow}>
          <View style={[styles.keyDot, { backgroundColor: it.fill }]} />
          <Text style={[styles.keyName, { color: theme.text.mute }]} maxFontSizeMultiplier={1.3}>{it.name} </Text>
          <Text style={[styles.keyValue, { color: theme.text.ink }]} maxFontSizeMultiplier={1.3}>{it.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  centerValue: { fontSize: 17, lineHeight: 20 },
  centerLabel: { fontSize: 11 },
  dialWrap: { alignSelf: 'center' },
  dialValue: { fontSize: 30, lineHeight: 34 },
  key: { flexDirection: 'column', gap: 9, justifyContent: 'center', flexShrink: 1 },
  keyRow: { flexDirection: 'row', alignItems: 'center' },
  keyDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  keyName: { fontSize: 12 },
  keyValue: { fontSize: 12, fontWeight: '700' },
});
