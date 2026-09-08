import type { ThemeMotion } from '../theme/contract';

// V4.1 §5b — the pure half of the motion layer. THE RULES:
//   · motion never delays a tap or hides a number
//   · nothing runs longer than 400 ms except the splash
//   · every animation has a reduced-motion path (instant states)
//   · meaning is never carried by motion alone
// Components take every duration and spring FROM THE THEME via these
// helpers — a literal duration in a component fails motionLint.
//
// Decision (V4.1): the spec assumed Reanimated was already a dependency;
// it is not (only vestigial worklets-core). The layer is built on core
// RN Animated — same tokens, same behaviours, no new native dependency
// in the same batch as a release.

export type Speed = 'fast' | 'base' | 'slow';

export function durationFor(m: ThemeMotion, speed: Speed, reduced: boolean): number {
  return reduced ? 0 : m.duration[speed];
}

/** Spring params for Animated.spring — themes without a spring personality
 *  get a stiff, overdamped pair that reads as a plain settle. */
export function springFor(m: ThemeMotion): { damping: number; stiffness: number; mass: number } {
  return m.spring
    ? { ...m.spring, mass: 1 }
    : { damping: 30, stiffness: 320, mass: 1 };
}

/** The splash is the one animation allowed past 400 ms — hard-capped. */
export const SPLASH_TOTAL_MS = 1200;
export const SPLASH_COLUMN_STAGGER_MS = 60;

/** List entrances stagger at 30 ms per row, capped so a long list never
 *  makes the tail wait — motion must not delay content. */
export const LIST_STAGGER_MS = 30;
export const LIST_STAGGER_MAX_ROWS = 8;
export function staggerDelay(index: number, reduced: boolean): number {
  if (reduced) return 0;
  return Math.min(index, LIST_STAGGER_MAX_ROWS) * LIST_STAGGER_MS;
}

/** Card press scale — 0.98 per spec; a spring theme rebounds ≤ 1.04. */
export const PRESS_SCALE = 0.98;

/** Pebble's idle breathe: 1.00–1.02 over ~4 s. Slow but continuous, and
 *  exempt from the 400 ms rule because it is an idle state, not a
 *  transition — reduced motion turns it off entirely. */
export const BREATHE_SCALE = 1.02;
export const BREATHE_PERIOD_MS = 4000;

/** Pebble's stage change — the one sanctioned longer moment. */
export const STAGE_CHANGE_MS = 600;

/** Number count-ups settle within 300 ms regardless of theme pace. */
export function countDuration(m: ThemeMotion, reduced: boolean): number {
  return reduced ? 0 : Math.min(m.duration.slow, 300);
}
