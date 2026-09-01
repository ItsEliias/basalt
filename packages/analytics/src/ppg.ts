// Camera-PPG analysis (V3.1 H1) — fingertip-over-torch HRV without a
// wearable. This module is PURE: samples in (per-frame mean red), peaks,
// RR intervals, RMSSD and a quality verdict out. Honesty is the product:
// a read that fails the published quality gates returns ok:false with
// named reasons and NO number — "couldn't get a clean read" beats a
// shaky RMSSD every time. Tested against synthetic waveforms whose true
// RMSSD is known by construction.

export type PpgSample = { t: number; v: number };

export const PPG_RULES = {
  targetDurationS: 60,
  minDurationS: 30,
  /** Detrend window — subtracts slow baseline drift (finger pressure). */
  detrendWindowMs: 900,
  smoothWindowMs: 150,
  /** Physiological RR bounds: 30–200 bpm. */
  minRrMs: 300,
  maxRrMs: 2000,
  /** An RR jumping >20% from its predecessor is an artifact (motion). */
  maxRrJumpFrac: 0.2,
  /** Quality gates — all published, all named in failures. */
  minCleanRr: 30,
  maxArtifactFrac: 0.2,
  minSnr: 2,
  minFps: 20,
} as const;

export type PpgQuality = {
  ok: boolean;
  reasons: string[];
  cleanRr: number;
  artifactFrac: number;
  snr: number;
  fps: number;
  durationS: number;
};

export type PpgResult = {
  /** ms — null whenever quality.ok is false. NO shaky numbers. */
  rmssd: number | null;
  bpm: number | null;
  peaksMs: number[];
  rrMs: number[];
  cleanRrMs: number[];
  quality: PpgQuality;
  /** Detrended+smoothed signal for the debug waveform. */
  signal: PpgSample[];
};

function movingMean(samples: PpgSample[], windowMs: number): number[] {
  const out = new Array<number>(samples.length);
  let lo = 0;
  let hi = 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = samples[i]!.t;
    while (hi < samples.length && samples[hi]!.t <= t + windowMs / 2) {
      sum += samples[hi]!.v;
      hi++;
    }
    while (lo < samples.length && samples[lo]!.t < t - windowMs / 2) {
      sum -= samples[lo]!.v;
      lo++;
    }
    out[i] = sum / Math.max(1, hi - lo);
  }
  return out;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
  return sorted[idx]!;
}

/** Full pipeline: detrend → smooth → peaks → RR → artifact filter → RMSSD. */
export function analyzePpg(samples: PpgSample[]): PpgResult {
  const R = PPG_RULES;
  const empty: PpgResult = {
    rmssd: null, bpm: null, peaksMs: [], rrMs: [], cleanRrMs: [],
    quality: { ok: false, reasons: ['no signal captured'], cleanRr: 0, artifactFrac: 1, snr: 0, fps: 0, durationS: 0 },
    signal: [],
  };
  if (samples.length < 10) return empty;

  const durationS = (samples[samples.length - 1]!.t - samples[0]!.t) / 1000;
  const fps = samples.length / Math.max(1e-6, durationS);

  // Detrend against the slow baseline, then smooth the fast noise.
  const baseline = movingMean(samples, R.detrendWindowMs);
  const detrended = samples.map((s, i) => ({ t: s.t, v: s.v - baseline[i]! }));
  const smoothArr = movingMean(detrended, R.smoothWindowMs);
  const signal = detrended.map((s, i) => ({ t: s.t, v: smoothArr[i]! }));

  // Noise = what smoothing removed; amplitude = the pulse swing that remains.
  const residuals = detrended.map((s, i) => s.v - smoothArr[i]!);
  const noise = Math.sqrt(residuals.reduce((a, r) => a + r * r, 0) / residuals.length) || 1e-9;
  const sortedV = signal.map((s) => s.v).sort((a, b) => a - b);
  const amplitude = percentile(sortedV, 0.95) - percentile(sortedV, 0.05);
  const snr = amplitude / (noise * 2);

  // Peaks: local maxima above 30% of the p95 swing, ≥ minRrMs apart
  // (keeping the taller when two crowd each other). Peak TIME is refined
  // by parabolic interpolation over the three samples around the maximum —
  // at 30 fps the frame grid alone would inject ~13 ms of fake RMSSD, and
  // sub-sample timing removes almost all of it (pinned by the metronome
  // fixture).
  const threshold = 0.3 * percentile(sortedV, 0.95);
  const refineT = (i: number): number => {
    const y0 = signal[i - 1]!.v;
    const y1 = signal[i]!.v;
    const y2 = signal[i + 1]!.v;
    const denom = y0 - 2 * y1 + y2;
    if (denom === 0) return signal[i]!.t;
    const delta = Math.max(-0.5, Math.min(0.5, (0.5 * (y0 - y2)) / denom));
    const dt = (signal[i + 1]!.t - signal[i - 1]!.t) / 2;
    return signal[i]!.t + delta * dt;
  };
  const peaksMs: number[] = [];
  let lastPeakV = -Infinity;
  for (let i = 1; i < signal.length - 1; i++) {
    const s = signal[i]!;
    if (s.v <= threshold) continue;
    if (signal[i - 1]!.v > s.v || signal[i + 1]!.v >= s.v) continue;
    const t = refineT(i);
    const last = peaksMs[peaksMs.length - 1];
    if (last !== undefined && t - last < R.minRrMs) {
      if (lastPeakV < s.v) {
        peaksMs[peaksMs.length - 1] = t;
        lastPeakV = s.v;
      }
      continue;
    }
    peaksMs.push(t);
    lastPeakV = s.v;
  }

  const rrMs: number[] = [];
  for (let i = 1; i < peaksMs.length; i++) rrMs.push(peaksMs[i]! - peaksMs[i - 1]!);

  // Artifact filter: physiological bounds + max jump vs the previous RR.
  const cleanRrMs: number[] = [];
  const cleanPairs: [number, number][] = [];
  let prevClean: number | null = null;
  let prevWasClean = false;
  for (const rr of rrMs) {
    const inBounds = rr >= R.minRrMs && rr <= R.maxRrMs;
    const smallJump = prevClean === null || Math.abs(rr - prevClean) / prevClean <= R.maxRrJumpFrac;
    if (inBounds && smallJump) {
      if (prevWasClean && prevClean !== null) cleanPairs.push([prevClean, rr]);
      cleanRrMs.push(rr);
      prevClean = rr;
      prevWasClean = true;
    } else {
      prevWasClean = false;
      if (inBounds) prevClean = rr; // re-anchor so one artifact doesn't cascade
    }
  }
  const artifactFrac = rrMs.length === 0 ? 1 : 1 - cleanRrMs.length / rrMs.length;

  // Quality gates — every failure is named.
  const reasons: string[] = [];
  if (durationS < R.minDurationS) reasons.push(`only ${Math.round(durationS)}s captured (need ${R.minDurationS}s)`);
  if (fps < R.minFps) reasons.push(`frame rate ${Math.round(fps)} fps (need ${R.minFps})`);
  if (snr < R.minSnr) reasons.push(`signal too noisy (SNR ${snr.toFixed(1)} < ${R.minSnr})`);
  if (cleanRrMs.length < R.minCleanRr) reasons.push(`${cleanRrMs.length} clean beats (need ${R.minCleanRr})`);
  if (artifactFrac > R.maxArtifactFrac) reasons.push(`${Math.round(artifactFrac * 100)}% artifacts (max ${Math.round(R.maxArtifactFrac * 100)}%)`);
  const ok = reasons.length === 0;

  // RMSSD over successive CLEAN pairs only — artifacts never touch the math.
  let rmssd: number | null = null;
  let bpm: number | null = null;
  if (ok && cleanPairs.length > 0) {
    const sq = cleanPairs.reduce((a, [a1, b1]) => a + (b1 - a1) ** 2, 0) / cleanPairs.length;
    rmssd = Math.round(Math.sqrt(sq) * 10) / 10;
    bpm = Math.round(60000 / (cleanRrMs.reduce((a, b) => a + b, 0) / cleanRrMs.length));
  }

  return {
    rmssd, bpm, peaksMs, rrMs, cleanRrMs,
    quality: {
      ok, reasons, cleanRr: cleanRrMs.length,
      artifactFrac: Math.round(artifactFrac * 1000) / 1000,
      snr: Math.round(snr * 10) / 10,
      fps: Math.round(fps * 10) / 10,
      durationS: Math.round(durationS * 10) / 10,
    },
    signal,
  };
}

/** True RMSSD of an RR sequence — the fixture-side ground truth. */
export function rmssdOf(rrMs: number[]): number {
  if (rrMs.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < rrMs.length; i++) sum += (rrMs[i]! - rrMs[i - 1]!) ** 2;
  return Math.sqrt(sum / (rrMs.length - 1));
}
