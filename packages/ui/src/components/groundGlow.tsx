import { StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { useTheme } from '../theme';

// The ambient backdrop behind Depth's screen root — reference/themes-today.
// html's `.depth .scr` two-radial-gradient recipe, rendered once at the app
// shell so every screen shares one glow rather than re-painting it per card.
// Every other theme's `shape.groundGlow` is undefined, so this renders null
// — zero cost, zero visual change for the other five themes.

export function GroundGlow() {
  const { theme } = useTheme();
  const glow = theme.shape.groundGlow;
  if (!glow || glow.length === 0) return null;

  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
      <Defs>
        {glow.map((g, i) => (
          <RadialGradient key={i} id={`glow-${i}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={g.color} />
            <Stop offset="0.7" stopColor={g.color} stopOpacity={0} />
            <Stop offset="1" stopColor={g.color} stopOpacity={0} />
          </RadialGradient>
        ))}
      </Defs>
      {glow.map((g, i) => (
        <Rect
          key={i}
          x={`${(g.cx - g.rx) * 100}%`}
          y={`${(g.cy - g.ry) * 100}%`}
          width={`${g.rx * 200}%`}
          height={`${g.ry * 200}%`}
          fill={`url(#glow-${i})`}
        />
      ))}
    </Svg>
  );
}
