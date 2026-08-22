import Svg, { Circle, Line, Polyline, Rect } from 'react-native-svg';

// Tab-bar icons — line-only, 1.5px stroke, no fills, no emoji. Built from
// primitives only (Rect/Line/Circle/Polyline), matching the app's existing
// hairline/geometric visual language (see body-figure.tsx). One glyph per
// tab, literal to its domain, never decorative.

type IconProps = { color: string; size?: number };

const STROKE = 1.5;

export function TodayIcon({ color, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Rect x={5} y={3} width={10} height={14} rx={1.5} stroke={color} strokeWidth={STROKE} />
      <Line x1={7.5} y1={7.5} x2={12.5} y2={7.5} stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
      <Line x1={7.5} y1={10.5} x2={12.5} y2={10.5} stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
      <Line x1={7.5} y1={13.5} x2={10.5} y2={13.5} stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
    </Svg>
  );
}

export function LogIcon({ color, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Line x1={5} y1={5} x2={5} y2={15} stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
      <Line x1={7.5} y1={7} x2={7.5} y2={15} stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
      <Line x1={10} y1={5} x2={10} y2={15} stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
      <Line x1={12.5} y1={7} x2={12.5} y2={15} stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
      <Line x1={15} y1={5} x2={15} y2={15} stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
    </Svg>
  );
}

export function TrainIcon({ color, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Circle cx={4} cy={10} r={2.2} stroke={color} strokeWidth={STROKE} />
      <Circle cx={16} cy={10} r={2.2} stroke={color} strokeWidth={STROKE} />
      <Line x1={6.2} y1={10} x2={13.8} y2={10} stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
    </Svg>
  );
}

export function RecoverIcon({ color, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Polyline
        points="2,10 6,10 8,4 11,16 13,7 15,10 18,10"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

export function TrendsIcon({ color, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Polyline
        points="3,15 8,10 11,12 17,4"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
