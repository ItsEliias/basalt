import type { PebbleProposal } from '@basalt/ui/src/pebble/Pebble';
import { WEEK_REVIEW_CONTENT, WEEK_REVIEW_NOTIF_ID } from './weekReviewNotifModel';

// Pebble — the pure half. Two laws live here, testable without a device:
//
//  1. Pebble renders only when a proposal with an action exists, and never
//     on empty states, Trends/data screens (unless opted in), or errors.
//  2. Pebble is a VOICE setting, never a content setting: with the voice
//     toggle on, the same notifications ship with the Pebble title and
//     icon and nothing else changes. No notification exists only because
//     Pebble is on.

// ── Settings ────────────────────────────────────────────────────────────

export type PebbleSettings = {
  /** Master switch. Off by default — Pebble is opt-in, always. */
  showInApp: boolean;
  /** Notifications come from Pebble. Meaningless without showInApp. */
  notifVoice: boolean;
  /** Pebble on Trends and data screens. Default off even when Pebble is on. */
  onDataScreens: boolean;
};

export const PEBBLE_DEFAULTS: PebbleSettings = {
  showInApp: false,
  notifVoice: false,
  onDataScreens: false,
};

export const PEBBLE_STORAGE_KEY = 'basalt.pebble';
export const PEBBLE_DISMISSED_KEY_PREFIX = 'basalt.pebble.dismissed.';

/** The dependency between the toggles: no Pebble, no Pebble voice. */
export function normalizePebbleSettings(s: PebbleSettings): PebbleSettings {
  if (s.showInApp) return s;
  return { showInApp: false, notifVoice: false, onDataScreens: s.onDataScreens };
}

export function parsePebbleSettings(raw: string | null): PebbleSettings {
  if (!raw) return PEBBLE_DEFAULTS;
  try {
    const p = JSON.parse(raw) as Partial<PebbleSettings>;
    return normalizePebbleSettings({
      showInApp: p.showInApp === true,
      notifVoice: p.notifVoice === true,
      onDataScreens: p.onDataScreens === true,
    });
  } catch {
    return PEBBLE_DEFAULTS;
  }
}

// ── The rendering law ───────────────────────────────────────────────────

export type PebbleSurface = 'today' | 'log' | 'train' | 'recover' | 'trends' | 'data' | 'empty' | 'error';

/**
 * Where Pebble may appear. Empty states and errors are NEVER, regardless
 * of settings; Trends/data screens need their own opt-in.
 */
export function pebbleAllowedOnSurface(s: PebbleSettings, surface: PebbleSurface): boolean {
  if (!s.showInApp) return false;
  if (surface === 'empty' || surface === 'error') return false;
  if (surface === 'trends' || surface === 'data') return s.onDataScreens;
  return true;
}

/** The full gate: settings × surface × proposal. No proposal, no Pebble. */
export function pebbleVisible(
  s: PebbleSettings,
  surface: PebbleSurface,
  proposal: PebbleProposal | null,
): boolean {
  return proposal !== null && pebbleAllowedOnSurface(s, surface);
}

// ── Proposals — each from a real engine value, each with a way out ──────

const round5 = (n: number) => Math.round(n / 5) * 5;

/**
 * Protein shortfall with eating hours left. Needs a non-empty day (an
 * empty ledger gets a quiet empty state, never a mascot) and a shortfall
 * worth acting on, in the window where dinner can still fix it.
 */
export function macroShortfallProposal(input: {
  proteinG: number;
  proteinTargetG: number;
  entriesLogged: number;
  hour: number;
}): PebbleProposal | null {
  const short = round5(input.proteinTargetG - input.proteinG);
  if (input.entriesLogged === 0) return null;
  if (short < 25) return null;
  if (input.hour < 15 || input.hour > 21) return null;
  return {
    id: 'macro-protein',
    kind: 'macro-shortfall',
    text: `Protein's ${short} g short with dinner left. Want the two quickest options?`,
    actions: [
      { label: 'Show options', kind: 'open-log' },
      { label: 'Not tonight', kind: 'dismiss' },
    ],
  };
}

/** Low readiness on a day with a session to lighten. Score comes from the readiness engine, band included. */
export function readinessSwapProposal(input: {
  score: number | null;
  band: number | null;
  hasSessionToday: boolean;
}): PebbleProposal | null {
  if (input.score === null || input.score >= 62) return null;
  if (!input.hasSessionToday) return null;
  const band = input.band !== null ? `, ±${Math.round(input.band)}` : '';
  return {
    id: 'readiness-swap',
    kind: 'readiness-swap',
    text: `Readiness is low (${Math.round(input.score)}${band}). Swap today's session for the lighter version?`,
    actions: [
      { label: 'Swap', kind: 'open-train' },
      { label: 'Keep plan', kind: 'dismiss' },
    ],
  };
}

/** Missed planned session (V4 Phase 8d): shift the week, never a lecture. */
export function missedSessionProposal(input: {
  yesterdayWasPlanned: boolean;
  sessionYesterday: boolean;
}): PebbleProposal | null {
  if (!input.yesterdayWasPlanned || input.sessionYesterday) return null;
  return {
    id: 'missed-session',
    kind: 'missed-session',
    text: 'Yesterday was a planned training day with no session. Shift the week — train today and the plan slides along; nothing breaks, nothing is lost.',
    actions: [
      { label: 'Open Train', kind: 'open-train' },
      { label: 'Leave it', kind: 'dismiss' },
    ],
  };
}

/** The wellbeing stress rule (V4 Phase 7) — text comes from analytics. */
export function stressSwapProposal(input: { text: string } | null): PebbleProposal | null {
  if (!input) return null;
  return {
    id: 'stress-swap',
    kind: 'stress-swap',
    text: input.text,
    actions: [
      { label: 'Swap lighter', kind: 'open-train' },
      { label: 'Not now', kind: 'dismiss' },
    ],
  };
}

/** Short last night against the sleep target. */
export function sleepDebtProposal(input: {
  sleepHours: number | null;
  sleepTargetMin: number | null;
}): PebbleProposal | null {
  if (input.sleepHours === null || input.sleepTargetMin === null) return null;
  const debtMin = Math.round(input.sleepTargetMin - input.sleepHours * 60);
  if (debtMin < 90) return null;
  const h = Math.floor(debtMin / 60);
  const m = debtMin % 60;
  const debt = h > 0 ? `${h} h${m > 0 ? ` ${m} m` : ''}` : `${m} m`;
  return {
    id: 'sleep-debt',
    kind: 'sleep-debt',
    text: `Last night ran ${debt} under your sleep target. Want tonight's wind-down numbers?`,
    actions: [
      { label: 'Open Recover', kind: 'open-recover' },
      { label: 'Not now', kind: 'dismiss' },
    ],
  };
}

/** A progression suggestion from suggestNext, already computed by Train. */
export function progressionProposal(input: {
  exercise: string;
  weightKg: number | null;
  reps: number | null;
}): PebbleProposal | null {
  if (input.weightKg === null || input.reps === null) return null;
  return {
    id: `progression-${input.exercise.toLowerCase().replace(/\s+/g, '-')}`,
    kind: 'progression',
    text: `${input.exercise}: the engine suggests ${input.weightKg} kg × ${input.reps} today.`,
    actions: [
      { label: 'Open Train', kind: 'open-train' },
      { label: 'Dismiss', kind: 'dismiss' },
    ],
  };
}

/** First actionable proposal wins; dismissed ids are out for the day. */
export function pickProposal(
  candidates: (PebbleProposal | null)[],
  dismissedIds: readonly string[],
): PebbleProposal | null {
  for (const c of candidates) {
    if (c && !dismissedIds.includes(c.id)) return c;
  }
  return null;
}

// ── The voice law — same notifications, different voice ─────────────────

export type NotifContent = {
  id: string;
  title: string;
  body: string;
  /** Which icon the delivery uses. Never changes what is said. */
  icon: 'default' | 'pebble';
};

export const PEBBLE_NOTIF_TITLE = 'Pebble · Basalt';

/** Re-voice one notification. Body is untouchable by construction. */
export function voicedContent(base: { id: string; title: string; body: string }, pebbleVoice: boolean): NotifContent {
  return pebbleVoice
    ? { id: base.id, title: PEBBLE_NOTIF_TITLE, body: base.body, icon: 'pebble' }
    : { id: base.id, title: base.title, body: base.body, icon: 'default' };
}

export const MONTHLY_REPORT_CONTENT = {
  title: 'Last month, from your ledger',
  body: 'Behavior facts and what moved with what — open Trends to read it.',
} as const;

export const VITALS_DEVIATION_TITLE = 'Out of your range';

/**
 * Every notification Basalt can schedule, voiced. The parity test walks
 * this: the set must be identical with Pebble on and off apart from
 * title/icon — there is no Pebble-only notification.
 */
export function allNotifContents(input: {
  pebbleVoice: boolean;
  weekReviewOn: boolean;
  monthlyReportOn: boolean;
  vitalsHeadline: string | null;
}): NotifContent[] {
  const out: NotifContent[] = [];
  if (input.weekReviewOn) {
    out.push(voicedContent({ id: WEEK_REVIEW_NOTIF_ID, ...WEEK_REVIEW_CONTENT }, input.pebbleVoice));
  }
  if (input.monthlyReportOn) {
    out.push(voicedContent({ id: 'monthly-behavior-report', ...MONTHLY_REPORT_CONTENT }, input.pebbleVoice));
  }
  if (input.vitalsHeadline !== null) {
    out.push(voicedContent({
      id: 'vitals-deviation',
      title: VITALS_DEVIATION_TITLE,
      body: `${input.vitalsHeadline} — open Recover for the numbers.`,
    }, input.pebbleVoice));
  }
  return out;
}
