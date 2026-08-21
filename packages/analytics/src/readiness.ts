// Readiness — a published formula over the user's own persisted vitals,
// with the math one tap away. Four components, 0–25 points each:
//
//   · HRV vs your 30-day median   — ratio 0.6…1.4 maps linearly to 0…25
//   · RHR vs your 30-day median   — inverted (lower is better), same map
//   · Sleep duration vs target    — duration/target capped at 1, × 25
//   · Prior-day training load     — 25 × (1 − load/heavyLoad), heavyLoad =
//     your own 30-day P75 volume; a rest day scores the full 25
//
// Real-or-hidden is structural: HRV and RHR need ≥ 7 baseline days; a
// component without data is null, and the NUMBER ONLY EXISTS when at
// least 3 of 4 components do — no rescaling, no invented confidence.
// No wearable data, no number.

export const READINESS_RULES = {
  minBaselineDays: 7,
  minComponents: 3,
  ratioFloor: 0.6,
  ratioCeil: 1.4,
} as const;

export type ReadinessComponent = {
  key: 'hrv' | 'rhr' | 'sleep' | 'load';
  label: string;
  points: number | null;
  /** The literal math, e.g. "58 ms vs 30-day median 62 → ratio 0.94". */
  detail: string;
};

export type Readiness = {
  score: number | null;
  components: ReadinessComponent[];
  note: string;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function ratioPoints(ratio: number): number {
  const { ratioFloor, ratioCeil } = READINESS_RULES;
  return Math.round(clamp((ratio - ratioFloor) / (ratioCeil - ratioFloor), 0, 1) * 25);
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}

export function p75(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * 0.75))]!;
}

export function computeReadiness(input: {
  todayHrv: number | null;
  hrvBaseline: number[];
  todayRhr: number | null;
  rhrBaseline: number[];
  lastNightSleepMin: number | null;
  sleepTargetMin: number;
  priorDayVolumeKg: number;
  volumeBaseline: number[];
}): Readiness {
  const R = READINESS_RULES;
  const components: ReadinessComponent[] = [];

  const hrvMed = input.hrvBaseline.length >= R.minBaselineDays ? median(input.hrvBaseline) : null;
  if (input.todayHrv !== null && hrvMed !== null && hrvMed > 0) {
    const ratio = input.todayHrv / hrvMed;
    components.push({
      key: 'hrv', label: 'HRV (rMSSD)',
      points: ratioPoints(ratio),
      detail: `${Math.round(input.todayHrv)} ms vs 30-day median ${Math.round(hrvMed)} → ratio ${ratio.toFixed(2)}`,
    });
  } else {
    components.push({
      key: 'hrv', label: 'HRV (rMSSD)', points: null,
      detail: input.todayHrv === null ? 'no reading last night' : `needs ${R.minBaselineDays}+ baseline days`,
    });
  }

  const rhrMed = input.rhrBaseline.length >= R.minBaselineDays ? median(input.rhrBaseline) : null;
  if (input.todayRhr !== null && rhrMed !== null && input.todayRhr > 0) {
    const ratio = rhrMed / input.todayRhr; // lower RHR than usual → ratio > 1
    components.push({
      key: 'rhr', label: 'Resting HR',
      points: ratioPoints(ratio),
      detail: `${Math.round(input.todayRhr)} bpm vs 30-day median ${Math.round(rhrMed)} → inverted ratio ${ratio.toFixed(2)}`,
    });
  } else {
    components.push({
      key: 'rhr', label: 'Resting HR', points: null,
      detail: input.todayRhr === null ? 'no reading' : `needs ${R.minBaselineDays}+ baseline days`,
    });
  }

  if (input.lastNightSleepMin !== null && input.sleepTargetMin > 0) {
    const frac = clamp(input.lastNightSleepMin / input.sleepTargetMin, 0, 1);
    components.push({
      key: 'sleep', label: 'Sleep duration',
      points: Math.round(frac * 25),
      detail: `${Math.floor(input.lastNightSleepMin / 60)}h${String(Math.round(input.lastNightSleepMin % 60)).padStart(2, '0')} vs target ${Math.round(input.sleepTargetMin / 60)}h → ${(frac * 100).toFixed(0)}%`,
    });
  } else {
    components.push({ key: 'sleep', label: 'Sleep duration', points: null, detail: 'last night not persisted' });
  }

  const heavy = p75(input.volumeBaseline.filter((v) => v > 0));
  if (heavy !== null && heavy > 0) {
    const frac = clamp(input.priorDayVolumeKg / heavy, 0, 1);
    components.push({
      key: 'load', label: 'Prior-day load',
      points: Math.round((1 - frac) * 25),
      detail:
        input.priorDayVolumeKg > 0
          ? `${Math.round(input.priorDayVolumeKg)} kg vs your P75 ${Math.round(heavy)} → ${(frac * 100).toFixed(0)}% of a heavy day`
          : 'rest day — full points',
    });
  } else {
    components.push({
      key: 'load', label: 'Prior-day load',
      points: input.priorDayVolumeKg === 0 ? 25 : null,
      detail: input.priorDayVolumeKg === 0 ? 'rest day — full points' : 'no volume history to compare against',
    });
  }

  const present = components.filter((c) => c.points !== null);
  if (present.length < R.minComponents) {
    return {
      score: null,
      components,
      note: `readiness needs ${R.minComponents} of 4 components — ${4 - present.length === 1 ? 'one is' : `${4 - present.length} are`} missing, so there is no number`,
    };
  }
  const max = present.length * 25;
  const score = Math.round((present.reduce((s, c) => s + c.points!, 0) / max) * 100);
  return {
    score,
    components,
    note: present.length === 4 ? 'all four components present' : `computed from ${present.length} of 4 components — the math sheet names the gap`,
  };
}

/** 30-day band for the vitals table: min / median / max of real readings. */
export function baselineBand(values: number[]): { min: number; median: number; max: number } | null {
  if (values.length < READINESS_RULES.minBaselineDays) return null;
  return { min: Math.min(...values), median: median(values)!, max: Math.max(...values) };
}
