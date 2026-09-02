import { describe, it, expect } from 'vitest';
import { analyzePpg, rmssdOf, PPG_RULES, type PpgSample } from './ppg';

// Synthetic PPG: gaussian pulses at known RR intervals, 30 fps, with a
// slow baseline drift like real finger pressure. The truth is known by
// construction; the analyzer must recover it — or refuse.

function synth(rrMs: number[], opts: { fps?: number; noise?: number; drift?: number; seed?: number } = {}): PpgSample[] {
  const fps = opts.fps ?? 30;
  const noise = opts.noise ?? 0.3;
  const drift = opts.drift ?? 8;
  let rng = (opts.seed ?? 42) >>> 0;
  const rand = () => {
    rng = (rng * 1664525 + 1013904223) >>> 0;
    return rng / 2 ** 32 - 0.5;
  };
  const peaks: number[] = [1000];
  for (const rr of rrMs) peaks.push(peaks[peaks.length - 1]! + rr);
  const total = peaks[peaks.length - 1]! + 1000;
  const samples: PpgSample[] = [];
  for (let t = 0; t <= total; t += 1000 / fps) {
    let v = 120 + drift * Math.sin((2 * Math.PI * t) / 15000); // slow drift
    for (const p of peaks) {
      const d = t - p;
      if (Math.abs(d) < 400) v += 10 * Math.exp(-(d * d) / (2 * 90 * 90)); // pulse
    }
    samples.push({ t, v: v + noise * rand() * 2 });
  }
  return samples;
}

/** ~65 bpm with genuine variability; long enough to clear every gate. */
const RR_VARIED = Array.from({ length: 70 }, (_, i) => 900 + Math.round(40 * Math.sin(i / 2.5)));

describe('analyzePpg — recovery of known truth', () => {
  it('finds every synthetic beat and recovers RMSSD within tolerance', () => {
    const r = analyzePpg(synth(RR_VARIED));
    expect(r.quality.ok).toBe(true);
    expect(r.peaksMs.length).toBe(RR_VARIED.length + 1);
    const truth = rmssdOf(RR_VARIED);
    expect(Math.abs(r.rmssd! - truth)).toBeLessThan(6);
    expect(r.bpm).toBeGreaterThan(60);
    expect(r.bpm).toBeLessThan(72);
  });

  it('a metronomic heart reads near-zero RMSSD — no invented variability', () => {
    const r = analyzePpg(synth(Array(70).fill(880)));
    expect(r.quality.ok).toBe(true);
    expect(r.rmssd!).toBeLessThan(6);
  });
});

describe('analyzePpg — refusal is the honest failure mode', () => {
  it('heavy noise fails the SNR gate with the reason named, and rmssd is NULL', () => {
    const r = analyzePpg(synth(RR_VARIED, { noise: 30 }));
    expect(r.quality.ok).toBe(false);
    expect(r.rmssd).toBeNull();
    expect(r.quality.reasons.join(' ')).toMatch(/nois|artifact|clean beats/i);
  });

  it('a too-short capture is refused by duration', () => {
    const r = analyzePpg(synth(RR_VARIED.slice(0, 15)));
    expect(r.quality.ok).toBe(false);
    expect(r.quality.reasons.join(' ')).toContain('captured');
    expect(r.rmssd).toBeNull();
  });

  it('low frame rate is refused by fps', () => {
    const r = analyzePpg(synth(RR_VARIED, { fps: 10 }));
    expect(r.quality.ok).toBe(false);
    expect(r.quality.reasons.join(' ')).toContain('fps');
  });

  it('empty input refuses without throwing', () => {
    const r = analyzePpg([]);
    expect(r.quality.ok).toBe(false);
    expect(r.rmssd).toBeNull();
  });
});

describe('artifact handling', () => {
  it('a motion spike is excluded from RMSSD, not averaged in', () => {
    const withArtifact = [...RR_VARIED];
    withArtifact[30] = 1800; // one wild interval — a finger shift
    const clean = analyzePpg(synth(RR_VARIED));
    const dirty = analyzePpg(synth(withArtifact));
    // The artifact and its neighbors drop out; the estimate barely moves.
    expect(dirty.quality.artifactFrac).toBeGreaterThan(0);
    if (dirty.quality.ok && clean.quality.ok) {
      expect(Math.abs(dirty.rmssd! - clean.rmssd!)).toBeLessThan(10);
    }
  });

  it(`the published gates hold still: ${PPG_RULES.minCleanRr} clean beats, ${PPG_RULES.maxArtifactFrac * 100}% artifacts, SNR ${PPG_RULES.minSnr}`, () => {
    expect(PPG_RULES.minCleanRr).toBe(30);
    expect(PPG_RULES.maxArtifactFrac).toBe(0.2);
    expect(PPG_RULES.minSnr).toBe(2);
    expect(PPG_RULES.minDurationS).toBe(30);
  });
});
