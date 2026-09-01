import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// /formulas page generator (V3.1 item 8). Every number below is IMPORTED
// from the constants the app actually runs — regenerate the page and it
// cannot drift from the code. Usage:
//   npx tsx scripts/generateFormulasPage.ts <output-dir>
// (output-dir gets an index.html; point it at basalt-site/formulas/)

import { READINESS_RULES } from '../packages/analytics/src/readiness';
import { CORRELATION_GATES } from '../packages/analytics/src/correlations';
import { REST_ADVISED_BELOW, WINDOW_DAYS } from '../packages/analytics/src/streaks';
import { SLEEP_NEED_RULES } from '../packages/analytics/src/sleep-need';
import { BEDTIME_RULES } from '../packages/analytics/src/sleep-window';
import { DEVIATION_RULES } from '../packages/analytics/src/deviation';
import { CYCLE_RULES } from '../packages/analytics/src/cycle';
import { COOP_DAYS } from '../packages/analytics/src/coop';
import { REP_RANGE, LOAD_STEP_KG, RAMP_TIERS } from '../packages/training/src/progression';
import { MESOCYCLE, DELOAD_TRIGGERS } from '../packages/training/src/periodization';
import { TM_RULES, PHASE_PERCENTS } from '../packages/training/src/training-max';
import { WEEKLY_SET_BAND, SECONDARY_CREDIT } from '../packages/training/src/weekly-volume';
import { RIEGEL_EXPONENT, PACE_MULTIPLIERS, PLAN_WEEKS_MIN, PLAN_WEEKS_MAX } from '../packages/training/src/race-plans';
import { MIN_TRANSITION_S } from '../packages/training/src/guided-timer';
import { TEMPO_DEFAULT } from '../packages/training/src/tempo';
import { DEVIATION_ALERT_M, DEVIATION_REARM_M } from '../packages/training/src/route-deviation';
import { GAP_MIN_KCAL } from '../packages/nutrition/src/fill-gap';
import { MIN_SAFE_CALORIES } from '../packages/nutrition/src/targets';

const hm = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
const pctList = (xs: readonly number[]) => xs.map((p) => `${Math.round(p * 1000) / 10}%`).join(' / ');

const sections: { title: string; rows: [string, string][] }[] = [
  {
    title: 'Readiness',
    rows: [
      ['Components', 'HRV vs your 30-day median · resting HR vs median · sleep vs target · training load vs your own P75 — equal weight, each shown with its literal math in-app'],
      ['Baseline floor', `${READINESS_RULES.minBaselineDays} days of a signal before it scores; fewer than ${READINESS_RULES.minComponents} scorable components → no score at all`],
      ['Ratio clamp', `each component ratio clamps to [${READINESS_RULES.ratioFloor}, ${READINESS_RULES.ratioCeil}] before scoring`],
      ['Rest advice', `readiness below ${REST_ADVISED_BELOW} marks a rest-advised day (feeds the rest-aware streak)`],
    ],
  },
  {
    title: 'Progression & training',
    rows: [
      ['Rep range', `${REP_RANGE.min}–${REP_RANGE.max} reps; load moves in ${LOAD_STEP_KG} kg steps`],
      ['Layoff ramp', RAMP_TIERS.map((t) => `≥${t.minDays} days away → suggest ×${t.factor}`).join(' · ')],
      ['Mesocycle', `${MESOCYCLE.accumulationWeeks} weeks accumulation · ${MESOCYCLE.intensificationWeeks} intensification · ${MESOCYCLE.deloadWeeks} deload`],
      ['Early-deload triggers (any two advise)', `≥${DELOAD_TRIGGERS.tooHardFraction * 100}% "too hard" feedback in 7 days · 7-day readiness mean < ${DELOAD_TRIGGERS.readinessMeanBelow} · a main lift stalled ${DELOAD_TRIGGERS.stallWeeks}+ weeks`],
      ['Training max', `TM = ${TM_RULES.tmFraction * 100}% of best e1RM over ${TM_RULES.windowWeeks} weeks, rounded to ${TM_RULES.roundKg} kg; moves only by ≥${TM_RULES.updateThresholdKg} kg`],
      ['Phase percentages of TM', `accumulation ${pctList(PHASE_PERCENTS.accumulation)} · intensification ${pctList(PHASE_PERCENTS.intensification)} · deload ${pctList(PHASE_PERCENTS.deload)}`],
      ['Weekly volume band', `${WEEKLY_SET_BAND.low}–${WEEKLY_SET_BAND.high} hard sets per muscle per week (deload halves it); primary sets count 1, secondary ${SECONDARY_CREDIT}; warmups excluded`],
      ['Timer transition floor', `no timed transition shorter than ${MIN_TRANSITION_S} s (user-initiated starts exempt)`],
      ['Tempo metronome', `${TEMPO_DEFAULT.downS}-${TEMPO_DEFAULT.pauseS}-${TEMPO_DEFAULT.upS} (down-pause-up), haptic beats, off by default`],
    ],
  },
  {
    title: 'Sleep',
    rows: [
      ['Personal need', `median of your last ${SLEEP_NEED_RULES.personalWindowNights} nights, clamped ${hm(SLEEP_NEED_RULES.clampMin)}–${hm(SLEEP_NEED_RULES.clampMax)}; published default ${hm(SLEEP_NEED_RULES.defaultNeedMin)} until ${SLEEP_NEED_RULES.minNightsForPersonal} nights exist`],
      ['Strain', `a P75-heavy training day adds ${SLEEP_NEED_RULES.strainExtraMin} min to that night's need`],
      ['Nap credit', `a day's longest session is the night; extras ≤ ${hm(SLEEP_NEED_RULES.napMaxMin)} h are naps and credit the day; naps never enter the need median`],
      ['Debt', `Σ(need − slept) over ${SLEEP_NEED_RULES.debtWindowDays} nights, floored at zero; surplus repays; absent nights are absent`],
      ['Bedtime window', `target = need + min(${hm(BEDTIME_RULES.debtRepayCapMin)}, debt ÷ ${Math.round(1 / BEDTIME_RULES.debtRepayFraction)}), anchored to your median wake; a ${BEDTIME_RULES.windowWidthMin}-min window; hidden until the need is personal and ${BEDTIME_RULES.minWakeSamples} wakes exist`],
      ['Consistency', `±(median absolute deviation) of the last ${BEDTIME_RULES.consistencyWindowNights} bedtimes around their median`],
      ['Stages', 'display-only, by law — stages never enter any score or suggestion'],
    ],
  },
  {
    title: 'Signals & trends',
    rows: [
      ['Correlation gates', `shown only at |r| ≥ ${CORRELATION_GATES.minAbsR} with n ≥ ${CORRELATION_GATES.minDays} days; checked-but-not-shown pairs are listed in-app`],
      ['Vitals deviation', `outside your own ${DEVIATION_RULES.baselineDays}-day min–max; withheld under ${DEVIATION_RULES.minBaselineDays} baseline days; a card only at ≥${DEVIATION_RULES.cardAt} vitals deviating — never diagnosis language`],
      ['Streak window', `${WINDOW_DAYS} days; program rest days and rest-advised days maintain a run, never start one`],
      ['Cycle estimate', `next-period window = median of your last ≤${CYCLE_RULES.historyCycles} cycles ± your own spread (floor ±${CYCLE_RULES.windowFloorDays} days); nothing under ${CYCLE_RULES.minCyclesForEstimate} complete cycles; no phase-based training advice, ever`],
      ['Co-op', `the only shared datum: one boolean per day over ${COOP_DAYS} days — "logged anything real"`],
    ],
  },
  {
    title: 'Food & movement',
    rows: [
      ['Energy targets', `Mifflin-St Jeor BMR × activity, goal delta applied; hard floor ${MIN_SAFE_CALORIES} kcal — the app refuses to go lower`],
      ['Water goal', 'weight kg × 32 ml (+ activity and goal adjustments); 2,200 ml fallback without a weight'],
      ['Fill-the-gap', `nothing renders under ${GAP_MIN_KCAL} kcal remaining; a food that exceeds the remaining energy is excluded outright`],
      ['Race prediction', `Riegel (1977): T2 = T1 × (D2/D1)^${RIEGEL_EXPONENT}; easy pace ×${PACE_MULTIPLIERS.easy}, steady ×${PACE_MULTIPLIERS.steady} of race pace; plans ${PLAN_WEEKS_MIN}–${PLAN_WEEKS_MAX} weeks`],
      ['Route nudge', `one buzz beyond ${DEVIATION_ALERT_M} m off a chosen loop, re-arming inside ${DEVIATION_REARM_M} m`],
      ['AI estimates', 'always ranges (~low–high) from the model itself, point inside the range; nothing auto-commits; eval harnesses are committed in the repo'],
    ],
  },
];

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Basalt — Every formula, published</title>
<link rel="stylesheet" href="/style.css">
</head>
<body>
<header class="site">
  <div class="wrap">
    <a class="wordmark" href="/">BASALT</a>
    <nav class="site">
      <a href="/formulas/">Formulas</a>
      <a href="/privacy/">Privacy</a>
      <a href="/delete-account/">Delete account</a>
    </nav>
  </div>
</header>
<main class="doc">
<div class="wrap">
  <h1>Every formula, published</h1>
  <div class="sub">Basalt: Health &amp; Fitness · generated from the app's own constants on ${new Date().toISOString().slice(0, 10)}</div>
  <p>Every number Basalt shows you is computed by a rule you can read. This page is
  <strong>generated from the same constants the app compiles against</strong> — it cannot say one
  thing while the code does another. If a rule changes, this page changes with it, dated.</p>
${sections
  .map(
    (sec) => `  <h2>${sec.title}</h2>
  <ul>
${sec.rows.map(([k, v]) => `    <li><strong>${k}</strong> — ${v}</li>`).join('\n')}
  </ul>`,
  )
  .join('\n')}
  <p class="note" style="margin-top:40px">Generated by scripts/generateFormulasPage.ts ·
  the in-app math sheets show each rule applied to your own numbers · nothing here is aspirational</p>
</div>
</main>
<footer class="site">
  <div class="wrap">
    <nav>
      <a href="/formulas/">Formulas</a>
      <a href="/privacy/">Privacy policy</a>
      <a href="/delete-account/">Delete your account</a>
    </nav>
    <div class="copy">Basalt: Health &amp; Fitness · Android · in development</div>
  </div>
</footer>
</body>
</html>
`;

const outDir = process.argv[2];
if (!outDir) {
  console.error('Usage: npx tsx scripts/generateFormulasPage.ts <output-dir>');
  process.exit(1);
}
writeFileSync(resolve(outDir, 'index.html'), html);
console.log(`Wrote ${resolve(outDir, 'index.html')} (${html.length} bytes)`);
