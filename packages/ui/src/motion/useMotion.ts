import { useEffect, useState } from 'react';
import { AccessibilityInfo, Easing } from 'react-native';
import { useTheme } from '../theme';
import type { ThemeMotion } from '../theme/contract';
import { durationFor, springFor, type Speed } from './motionTokens';

// The runtime half: theme motion + the system "Remove animations" flag.
// Android's reduce-motion setting maps every duration to 0 — instant
// states, exactly what the accessibility setting asks for.

let cachedReduced = false;
AccessibilityInfo.isReduceMotionEnabled().then((v) => { cachedReduced = v; }).catch(() => {});

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(cachedReduced);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (live) { cachedReduced = v; setReduced(v); } });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => {
      cachedReduced = v;
      setReduced(v);
    });
    return () => { live = false; sub.remove(); };
  }, []);
  return reduced;
}

export type Motion = {
  m: ThemeMotion;
  reduced: boolean;
  ms: (speed: Speed) => number;
  spring: { damping: number; stiffness: number; mass: number };
  easing: (t: number) => number;
};

export function useMotion(): Motion {
  const { theme } = useTheme();
  const reduced = useReducedMotion();
  const m = theme.motion;
  return {
    m,
    reduced,
    ms: (speed) => durationFor(m, speed, reduced),
    spring: springFor(m),
    easing: m.easing === 'ease-out' ? Easing.out(Easing.cubic) : Easing.inOut(Easing.cubic),
  };
}
