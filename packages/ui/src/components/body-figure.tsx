import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { color } from '../tokens';
import { mono } from '../typography';

// The prototype's front/back body figure (§bodymap), parameterized: each
// region's fill opacity is driven by an intensity 0–1, so the same figure
// serves exercise detail (primary solid / secondary faded) and the
// per-muscle recovery map. Regions with no intensity render as quiet
// outlines — absence stays visible, never invented.

export type FigureRegion =
  | 'chest' | 'core' | 'arms' | 'shoulders' | 'quads' | 'calves'
  | 'back' | 'glutes' | 'hamstrings';

export function BodyFigure({
  intensity,
  accent = color.protein,
  scale = 1.4,
}: {
  intensity: Partial<Record<FigureRegion, number>>;
  accent?: string;
  scale?: number;
}) {
  const op = (region: FigureRegion, base: number) => {
    const v = intensity[region];
    return v === undefined || v <= 0 ? 0.08 : Math.min(1, 0.15 + base * v);
  };
  const w = 96 * scale;
  const h = 132 * scale;
  return (
    <View style={styles.wrap}>
      <Svg width={w} height={h} viewBox="0 0 96 132">
        {/* front figure */}
        <Circle cx={24} cy={9} r={5} fill={color.surface2} stroke={color.border2} strokeWidth={1} />
        <Rect x={21.5} y={14} width={5} height={4} rx={2} fill={color.surface2} />
        {/* shoulders (front caps) */}
        <Rect x={10} y={16.5} width={6} height={5} rx={2.5} fill={accent} fillOpacity={op('shoulders', 0.6)} />
        <Rect x={32} y={16.5} width={6} height={5} rx={2.5} fill={accent} fillOpacity={op('shoulders', 0.6)} />
        <Path d="M16 20 Q16 18 18 18 H30 Q32 18 32 20 L31 33 Q31 35 29 35 H19 Q17 35 17 33 Z" fill={accent} fillOpacity={op('chest', 0.72)} />
        <Path d="M17.5 37 H30.5 L31 48 Q31 51 28.5 51 H19.5 Q17 51 17 48 Z" fill={accent} fillOpacity={op('core', 0.6)} />
        <Rect x={10.5} y={22} width={4.5} height={22} rx={2.25} fill={accent} fillOpacity={op('arms', 0.5)} />
        <Rect x={33} y={22} width={4.5} height={22} rx={2.25} fill={accent} fillOpacity={op('arms', 0.5)} />
        <Rect x={16.5} y={53} width={7} height={33} rx={3.5} fill={accent} fillOpacity={op('quads', 0.6)} />
        <Rect x={25} y={53} width={7} height={33} rx={3.5} fill={accent} fillOpacity={op('quads', 0.6)} />
        <Rect x={17.5} y={88} width={5.5} height={20} rx={2.75} fill={accent} fillOpacity={op('calves', 0.5)} />
        <Rect x={25.5} y={88} width={5.5} height={20} rx={2.75} fill={accent} fillOpacity={op('calves', 0.5)} />

        {/* back figure */}
        <Circle cx={72} cy={9} r={5} fill={color.surface2} stroke={color.border2} strokeWidth={1} />
        <Rect x={69.5} y={14} width={5} height={4} rx={2} fill={color.surface2} />
        <Rect x={58} y={16.5} width={6} height={5} rx={2.5} fill={accent} fillOpacity={op('shoulders', 0.45)} />
        <Rect x={80} y={16.5} width={6} height={5} rx={2.5} fill={accent} fillOpacity={op('shoulders', 0.45)} />
        <Path d="M64 20 Q64 18 66 18 H78 Q80 18 80 20 L79 38 Q79 40 77 40 H67 Q65 40 65 38 Z" fill={accent} fillOpacity={op('back', 0.66)} />
        <Path d="M65.5 42 H78.5 L79 48 Q79 51 76.5 51 H67.5 Q65 51 65 48 Z" fill={accent} fillOpacity={op('glutes', 0.6)} />
        <Rect x={58.5} y={22} width={4.5} height={22} rx={2.25} fill={accent} fillOpacity={op('arms', 0.3)} />
        <Rect x={81} y={22} width={4.5} height={22} rx={2.25} fill={accent} fillOpacity={op('arms', 0.3)} />
        <Rect x={64.5} y={53} width={7} height={33} rx={3.5} fill={accent} fillOpacity={op('hamstrings', 0.6)} />
        <Rect x={73} y={53} width={7} height={33} rx={3.5} fill={accent} fillOpacity={op('hamstrings', 0.6)} />
        <Rect x={65.5} y={88} width={5.5} height={20} rx={2.75} fill={accent} fillOpacity={op('calves', 0.5)} />
        <Rect x={73.5} y={88} width={5.5} height={20} rx={2.75} fill={accent} fillOpacity={op('calves', 0.5)} />
      </Svg>
      <View style={[styles.labels, { width: w }]}>
        <Text style={styles.label}>FRONT</Text>
        <Text style={styles.label}>BACK</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  labels: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 4 },
  label: { fontFamily: mono, fontSize: 7.5, letterSpacing: 1, color: color.faint },
});
