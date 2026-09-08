import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, type PressableProps, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { mono } from '../typography';
import { useMotion } from './useMotion';
import { BREATHE_PERIOD_MS, BREATHE_SCALE, PRESS_SCALE, staggerDelay } from './motionTokens';

// V4.1 §5b — the shared motion primitives. Every duration and spring comes
// from the theme via useMotion(); reduced motion collapses everything to
// instant states. None of these ever gates content: children render
// immediately, only opacity/transform animate.

/** Card/row press: scales to 0.98 and springs back on the theme's spring. */
export function PressScale({ children, style, ...press }: PressableProps & {
  children: React.ReactNode; style?: StyleProp<ViewStyle>;
}) {
  const { spring, reduced } = useMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) => {
    if (reduced) { scale.setValue(1); return; }
    Animated.spring(scale, { toValue: v, useNativeDriver: true, ...spring }).start();
  };
  return (
    <Pressable {...press} onPressIn={(e) => { to(PRESS_SCALE); press.onPressIn?.(e); }} onPressOut={(e) => { to(1); press.onPressOut?.(e); }}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

/** New rows fade + rise 8–12 px, staggered 30 ms by index (capped). */
export function FadeRise({ children, index = 0, rise = 10, style }: {
  children: React.ReactNode; index?: number; rise?: number; style?: StyleProp<ViewStyle>;
}) {
  const { ms, easing, reduced } = useMotion();
  const opacity = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const y = useRef(new Animated.Value(reduced ? 0 : rise)).current;
  useEffect(() => {
    if (reduced) { opacity.setValue(1); y.setValue(0); return; }
    const delay = staggerDelay(index, reduced);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: ms('base'), delay, easing, useNativeDriver: true }),
      Animated.timing(y, { toValue: 0, duration: ms('base'), delay, easing, useNativeDriver: true }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <Animated.View style={[style, { opacity, transform: [{ translateY: y }] }]}>{children}</Animated.View>;
}

/** Crossfade keyed content — tab switches, theme changes. No slide. */
export function Crossfade({ children, viewKey, style }: {
  children: React.ReactNode; viewKey: string; style?: StyleProp<ViewStyle>;
}) {
  const { ms, easing, reduced } = useMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (reduced) { opacity.setValue(1); return; }
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: ms('base'), easing, useNativeDriver: true }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey]);
  return <Animated.View style={[{ flex: 1 }, style, { opacity }]}>{children}</Animated.View>;
}

/**
 * A number that counts to its new value — mono digits so nothing shifts,
 * ≤ 300 ms, instant under reduced motion. The REAL value is always the
 * target: the animation is presentation, the ledger never lies.
 */
export function CountUpText({ value, format, style }: {
  value: number;
  format?: (v: number) => string;
  style?: StyleProp<TextStyle>;
}) {
  const { m, reduced } = useMotion();
  const fmt = format ?? ((v: number) => String(Math.round(v)));
  const [shown, setShown] = useState(value);
  const anim = useRef(new Animated.Value(value)).current;
  const prev = useRef(value);
  useEffect(() => {
    if (reduced || prev.current === value) {
      prev.current = value;
      setShown(value);
      anim.setValue(value);
      return;
    }
    prev.current = value;
    const id = anim.addListener(({ value: v }) => setShown(v));
    Animated.timing(anim, {
      toValue: value,
      duration: Math.min(m.duration.slow, 300),
      useNativeDriver: false,
    }).start(() => { anim.removeListener(id); setShown(value); });
    return () => anim.removeListener(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduced]);
  return <Animated.Text style={[{ fontFamily: mono, fontVariant: ['tabular-nums'] }, style]}>{fmt(shown)}</Animated.Text>;
}

/** Count a number toward its target — ≤ 300 ms, instant under reduced
 *  motion. The returned value ENDS at the target exactly; the animation is
 *  presentation, the ledger never lies. */
export function useCountUp(value: number): number {
  const { m, reduced } = useMotion();
  const [shown, setShown] = useState(value);
  const anim = useRef(new Animated.Value(value)).current;
  const prev = useRef(value);
  useEffect(() => {
    if (reduced || prev.current === value) {
      prev.current = value;
      setShown(value);
      anim.setValue(value);
      return;
    }
    prev.current = value;
    const id = anim.addListener(({ value: v }) => setShown(v));
    Animated.timing(anim, {
      toValue: value,
      duration: Math.min(m.duration.slow, 300),
      useNativeDriver: false,
    }).start(() => { anim.removeListener(id); setShown(value); });
    return () => anim.removeListener(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduced]);
  return shown;
}

/** A meter that fills FROM ITS PREVIOUS VALUE, never from zero. */
export function AnimatedFill({ fraction, style, children }: {
  fraction: number; style?: StyleProp<ViewStyle>; children?: React.ReactNode;
}) {
  const { ms, easing, reduced } = useMotion();
  const w = useRef(new Animated.Value(fraction)).current;
  useEffect(() => {
    if (reduced) { w.setValue(fraction); return; }
    Animated.timing(w, { toValue: fraction, duration: ms('slow'), easing, useNativeDriver: false }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fraction, reduced]);
  return (
    <Animated.View
      style={[style, { width: w.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}
    >
      {children}
    </Animated.View>
  );
}

/** Pebble's idle breathe — scale 1.00–1.02 over ~4 s, off under reduced
 *  motion. An idle state, not a transition, so it may loop. */
export function Breathe({ children }: { children: React.ReactNode }) {
  const { reduced } = useMotion();
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduced) { scale.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: BREATHE_SCALE, duration: BREATHE_PERIOD_MS / 2, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: BREATHE_PERIOD_MS / 2, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);
  return <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>;
}

/** Pop-in on the theme's spring — bubbles, sheets. Scale 0.9→1 + fade. */
export function SpringPop({ children, popKey, style }: {
  children: React.ReactNode; popKey: string; style?: StyleProp<ViewStyle>;
}) {
  const { spring, ms, reduced } = useMotion();
  const scale = useRef(new Animated.Value(reduced ? 1 : 0.9)).current;
  const opacity = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) { scale.setValue(1); opacity.setValue(1); return; }
    scale.setValue(0.9);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, ...spring }),
      Animated.timing(opacity, { toValue: 1, duration: ms('fast'), useNativeDriver: true }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popKey, reduced]);
  return <Animated.View style={[style, { opacity, transform: [{ scale }] }]}>{children}</Animated.View>;
}

/** Sheets and trays rise with the theme's spring on mount. */
export function SheetRise({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { spring, reduced } = useMotion();
  const y = useRef(new Animated.Value(reduced ? 0 : 28)).current;
  const opacity = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) { y.setValue(0); opacity.setValue(1); return; }
    Animated.parallel([
      Animated.spring(y, { toValue: 0, useNativeDriver: true, ...spring }),
      Animated.spring(opacity, { toValue: 1, useNativeDriver: true, ...spring }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <Animated.View style={[style, { opacity, transform: [{ translateY: y }] }]}>{children}</Animated.View>;
}
