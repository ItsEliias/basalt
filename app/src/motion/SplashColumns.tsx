import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { mono, useTheme, ScaledText as Text } from '@basalt/ui';
import { useMotion } from '@basalt/ui';
import { SPLASH_COLUMN_STAGGER_MS, SPLASH_TOTAL_MS } from '@basalt/ui';

// V4.1 §5b — the basalt columns from the app icon, rising from the
// baseline in a staggered wave, then the wordmark fades in. ≤ 1.2 s total,
// skippable on tap, a single fade under reduced motion. The same wave at
// small size is the app's ONE loading indicator (ColumnLoader below).

const COLUMNS = [0.55, 0.8, 1.0, 0.7, 0.45]; // relative heights, icon-like

function Wave({ size, loop }: { size: number; loop: boolean }) {
  const { spring, reduced } = useMotion();
  const { theme } = useTheme();
  const rises = useRef(COLUMNS.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    if (reduced) { rises.forEach((r) => r.setValue(1)); return; }
    const up = Animated.stagger(
      SPLASH_COLUMN_STAGGER_MS,
      rises.map((r) => Animated.spring(r, { toValue: 1, useNativeDriver: true, ...spring })),
    );
    if (!loop) { up.start(); return; }
    const down = Animated.stagger(
      SPLASH_COLUMN_STAGGER_MS,
      rises.map((r) => Animated.spring(r, { toValue: 0.4, useNativeDriver: true, ...spring })),
    );
    const cycle = Animated.loop(Animated.sequence([up, down]));
    cycle.start();
    return () => cycle.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, loop]);
  const colW = size / (COLUMNS.length * 2 - 1);
  return (
    <View style={[styles.wave, { height: size, gap: colW }]} accessibilityLabel={loop ? 'Loading' : undefined}>
      {COLUMNS.map((h, i) => (
        <Animated.View
          key={i}
          style={{
            width: colW,
            height: size * h,
            backgroundColor: theme.fill.mark,
            borderRadius: colW / 3,
            transform: [
              { translateY: rises[i]!.interpolate({ inputRange: [0, 1], outputRange: [size * h, 0] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}

/** Full-screen splash: wave + wordmark, skippable, hard 1.2 s cap. */
export function SplashColumns({ onDone }: { onDone: () => void }) {
  const { theme } = useTheme();
  const { reduced } = useMotion();
  const word = useRef(new Animated.Value(0)).current;
  const done = useRef(false);
  const finish = () => {
    if (!done.current) { done.current = true; onDone(); }
  };
  useEffect(() => {
    Animated.timing(word, {
      toValue: 1,
      duration: reduced ? 0 : 360,
      delay: reduced ? 0 : COLUMNS.length * SPLASH_COLUMN_STAGGER_MS + 160,
      useNativeDriver: true,
    }).start();
    const t = setTimeout(finish, reduced ? 400 : SPLASH_TOTAL_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Pressable style={[styles.full, { backgroundColor: theme.surfaces.bg }]} onPress={finish} accessibilityLabel="Skip intro">
      <Wave size={84} loop={false} />
      <Animated.View style={{ opacity: word }}>
        <Text style={[styles.wordmark, { color: theme.text.ink }]}>BASALT</Text>
      </Animated.View>
    </Pressable>
  );
}

/** The one in-app loading indicator — the same wave, small, looping. */
export function ColumnLoader({ size = 28 }: { size?: number }) {
  const { reduced } = useMotion();
  const { theme } = useTheme();
  // Reduced motion: a static glyph, no loop — still says "working".
  const [dots, setDots] = useState('·');
  useEffect(() => {
    if (!reduced) return;
    const t = setInterval(() => setDots((d) => (d.length >= 3 ? '·' : `${d}·`)), 600);
    return () => clearInterval(t);
  }, [reduced]);
  if (reduced) return <Text style={{ fontFamily: mono, color: theme.text.faint }}>{dots}</Text>;
  return <Wave size={size} loop />;
}

const styles = StyleSheet.create({
  full: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 18, zIndex: 10 },
  wave: { flexDirection: 'row', alignItems: 'flex-end', overflow: 'hidden' },
  wordmark: { fontFamily: mono, fontSize: 15, letterSpacing: 6 },
});
