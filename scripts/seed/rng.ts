// Deterministic PRNG (mulberry32) so re-running the seed script produces the
// same 90 days of data every time — idempotency depends on it: a re-run must
// generate identical rows to dedupe against, not fresh random noise.

export function makeRng(seed: number) {
  let a = seed >>> 0;
  return function rng(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = ReturnType<typeof makeRng>;

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]!;
}

export function chance(rng: Rng, p: number): boolean {
  return rng() < p;
}

/** Uniform in [min, max]. */
export function uniform(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** Gaussian-ish via sum of 3 uniforms — cheap, good enough for body/nutrition noise. */
export function jitter(rng: Rng, spread: number): number {
  return ((rng() + rng() + rng()) / 3 - 0.5) * 2 * spread;
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
