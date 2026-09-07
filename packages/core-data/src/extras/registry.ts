// The Extras registry — V4's one rule, in one file. Every Extra is off by
// default unless its entry says otherwise, switchable in Settings › Extras,
// and offered once during onboarding. With every Extra off the app is
// indistinguishable from core Basalt — enforced by the all-off snapshot
// diff, not hoped for. Add an Extra by adding an entry here; nothing else
// in the app hard-codes the list.
//
// Honesty laws apply INSIDE Extras: published formulas, ranges not false
// precision, AI proposes never narrates (the one narration Extra is
// labelled as narration). No Extra may change a number the core app shows.

export type ExtraGroup = 'capture' | 'motivation' | 'glanceability' | 'depth' | 'basalt';

export type ExtraId =
  | 'sounds'
  | 'widgets'
  | 'social'
  | 'narrative'
  | 'streaks'
  | 'xp'
  | 'pebbleGrows'
  | 'capturePhoto'
  | 'captureVoice'
  | 'captureBarcode'
  | 'capturePlate'
  | 'pebble'
  | 'mealPlanning'
  | 'fasting'
  | 'hydration'
  | 'supplements'
  | 'cycle'
  | 'photos'
  | 'imports'
  | 'uncertainty';

export type ExtraOnboarding = {
  /** The question the onboarding screen asks, verbatim. */
  question: string;
  yesLabel: string;
  noLabel: string;
  /** Key the onboarding screen maps to a live preview component. */
  preview: string;
};

export type ExtraDef = {
  id: ExtraId;
  title: string;
  oneLiner: string;
  group: ExtraGroup;
  /** Off by default is the rule; capture input methods are the exception. */
  default: boolean;
  /** Present when this Extra gets its own onboarding screen. */
  onboarding?: ExtraOnboarding;
  /** Extras that must be ON for this one to be switchable. */
  requires?: ExtraId[];
  /** Android permissions the Extra will request at first use. */
  permissions?: string[];
  /** Extras sharing an onboardingGroup share one offer screen. */
  onboardingGroup?: string;
};

export const EXTRA_GROUP_TITLES: Record<ExtraGroup, string> = {
  capture: 'Capture',
  motivation: 'Motivation',
  glanceability: 'Glanceability',
  depth: 'More tools',
  basalt: 'Basalt',
};

export const EXTRAS: readonly ExtraDef[] = [
  // ── Capture — input methods, not motivation: ON by default, permission
  //    still asked at first use, and manual entry stays the ungated floor.
  {
    id: 'capturePhoto',
    title: 'Photo to meal',
    oneLiner: 'Point the camera at a plate — AI proposes items with portion ranges; you correct, then log.',
    group: 'capture',
    default: true,
    permissions: ['android.permission.CAMERA'],
    onboardingGroup: 'capture',
    onboarding: {
      question: 'How do you want to capture food? All of these are optional — typing always works.',
      yesLabel: 'Keep the ticked ones',
      noLabel: 'Just typing, thanks',
      preview: 'capture',
    },
  },
  {
    id: 'captureVoice',
    title: 'Voice logging',
    oneLiner: 'Say the meal — your phone transcribes on-device, the same proposal engine parses it.',
    group: 'capture',
    default: true,
    permissions: ['android.permission.RECORD_AUDIO'],
    onboardingGroup: 'capture',
    onboarding: {
      question: 'How do you want to capture food? All of these are optional — typing always works.',
      yesLabel: 'Keep the ticked ones',
      noLabel: 'Just typing, thanks',
      preview: 'capture',
    },
  },
  {
    id: 'captureBarcode',
    title: 'Barcode & label scan',
    oneLiner: 'Scan a barcode, or photograph the nutrition panel — uncertain reads come back as ranges.',
    group: 'capture',
    default: true,
    permissions: ['android.permission.CAMERA'],
    onboardingGroup: 'capture',
    onboarding: {
      question: 'How do you want to capture food? All of these are optional — typing always works.',
      yesLabel: 'Keep the ticked ones',
      noLabel: 'Just typing, thanks',
      preview: 'capture',
    },
  },
  {
    id: 'capturePlate',
    title: 'Plate builder',
    oneLiner: 'Drag your recent foods onto a plate and size the portions — commits as ordinary entries.',
    group: 'capture',
    default: true,
    onboardingGroup: 'capture',
    onboarding: {
      question: 'How do you want to capture food? All of these are optional — typing always works.',
      yesLabel: 'Keep the ticked ones',
      noLabel: 'Just typing, thanks',
      preview: 'capture',
    },
  },

  // ── Glanceability ─────────────────────────────────────────────────────
  {
    id: 'sounds',
    title: 'Sounds',
    oneLiner: 'Three short samples on set commit, log commit and a PR — off by default; haptics stay regardless.',
    group: 'glanceability',
    default: false,
  },
  {
    id: 'widgets',
    title: 'Extra home-screen widgets',
    oneLiner: 'Macros join the Today widget and a Readiness widget becomes available — system placements you add yourself.',
    group: 'glanceability',
    default: false,
  },

  // ── Motivation — all off by default, all honest inside ────────────────
  {
    id: 'streaks',
    title: 'Streaks',
    oneLiner: 'Day runs for logging, training and sleep — two automatic freezes a week, rules published on Trends.',
    group: 'motivation',
    default: false,
    onboardingGroup: 'sxb',
    onboarding: {
      question: 'Streaks, XP and badges? Formulas published, freezes automatic, rest days never break training.',
      yesLabel: 'Turn them on',
      noLabel: 'Not now',
      preview: 'sxb',
    },
  },
  {
    id: 'xp',
    title: 'XP, levels & badges',
    oneLiner: 'XP from real actions with the formula printed in-app; badges only for real milestones; confetti only on PRs.',
    group: 'motivation',
    default: false,
    onboardingGroup: 'sxb',
    onboarding: {
      question: 'Streaks, XP and badges? Formulas published, freezes automatic, rest days never break training.',
      yesLabel: 'Turn them on',
      noLabel: 'Not now',
      preview: 'sxb',
    },
  },
  {
    id: 'social',
    title: 'Friends & challenges',
    oneLiner: 'Invite-code friends, weekly challenges, leaderboards among friends only — aggregates, never your food.',
    group: 'motivation',
    default: false,
    onboarding: {
      question: 'Friends and challenges? Friends see only aggregate numbers you publish — never your entries.',
      yesLabel: 'Turn it on',
      noLabel: 'Not now',
      preview: 'social',
    },
  },
  {
    id: 'narrative',
    title: 'Daily summary',
    oneLiner: 'One AI-written paragraph about yesterday, from your real numbers — labelled as generated, never a notification.',
    group: 'motivation',
    default: false,
    onboarding: {
      question: 'A daily summary? One generated paragraph each morning from yesterday’s numbers — narration, labelled as such.',
      yesLabel: 'Turn it on',
      noLabel: 'Not now',
      preview: 'narrative',
    },
  },
  {
    id: 'pebbleGrows',
    title: 'Pebble grows',
    oneLiner: 'Five stages from a published 30-day consistency score — regression is allowed and visible.',
    group: 'motivation',
    default: false,
    requires: ['pebble'],
  },
  // ── Basalt — the pitch: ON by default, still honest, still switchable ─
  {
    id: 'uncertainty',
    title: 'Visible uncertainty',
    oneLiner: 'The day’s intake as a range that narrows as entries are weighed — per-source model published in-app.',
    group: 'basalt',
    default: true,
  },

  // ── Depth — "More tools": every one off by default, one shared offer ──
  {
    id: 'mealPlanning',
    title: 'Meal planning & grocery list',
    oneLiner: 'A week plan from your recent foods against your macro gaps; the grocery list aggregates it.',
    group: 'depth',
    default: false,
    onboardingGroup: 'depth',
    onboarding: {
      question: 'More tools? Each is a quiet screen of its own — tick any you want.',
      yesLabel: 'Add the ticked ones',
      noLabel: 'None for now',
      preview: 'depth',
    },
  },
  {
    id: 'fasting',
    title: 'Fasting timer',
    oneLiner: 'Start and end fasts on Recover — elapsed time stated plainly, no coaching about hunger.',
    group: 'depth',
    default: false,
    onboardingGroup: 'depth',
    onboarding: {
      question: 'More tools? Each is a quiet screen of its own — tick any you want.',
      yesLabel: 'Add the ticked ones',
      noLabel: 'None for now',
      preview: 'depth',
    },
  },
  {
    id: 'hydration',
    title: 'Hydration reminders',
    oneLiner: 'Scheduled nudges to drink water, at hours you set — a reminder, never a guilt trip.',
    group: 'depth',
    default: false,
    permissions: ['android.permission.POST_NOTIFICATIONS'],
    onboardingGroup: 'depth',
    onboarding: {
      question: 'More tools? Each is a quiet screen of its own — tick any you want.',
      yesLabel: 'Add the ticked ones',
      noLabel: 'None for now',
      preview: 'depth',
    },
  },
  {
    id: 'supplements',
    title: 'Supplements checklist',
    oneLiner: 'Your own list, ticked per day — no products suggested, no doses proposed, ever.',
    group: 'depth',
    default: false,
    onboardingGroup: 'depth',
    onboarding: {
      question: 'More tools? Each is a quiet screen of its own — tick any you want.',
      yesLabel: 'Add the ticked ones',
      noLabel: 'None for now',
      preview: 'depth',
    },
  },
  {
    id: 'cycle',
    title: 'Cycle tracking',
    oneLiner: 'Log-only dates and symptoms; Trends shows a band and a published average-cycle estimate with its range.',
    group: 'depth',
    default: false,
    onboardingGroup: 'depth',
    onboarding: {
      question: 'More tools? Each is a quiet screen of its own — tick any you want.',
      yesLabel: 'Add the ticked ones',
      noLabel: 'None for now',
      preview: 'depth',
    },
  },
  {
    id: 'photos',
    title: 'Progress photos',
    oneLiner: 'Side-by-side and overlay compare. Photos stay on this phone unless you flip cloud sync on, separately.',
    group: 'depth',
    default: false,
    permissions: ['android.permission.CAMERA'],
    onboardingGroup: 'depth',
    onboarding: {
      question: 'More tools? Each is a quiet screen of its own — tick any you want.',
      yesLabel: 'Add the ticked ones',
      noLabel: 'None for now',
      preview: 'depth',
    },
  },
  {
    id: 'imports',
    title: 'Connected services',
    oneLiner: 'Strava, Garmin and Oura imports with source attribution — sessions and sleep, never edited.',
    group: 'depth',
    default: false,
    onboardingGroup: 'depth',
    onboarding: {
      question: 'More tools? Each is a quiet screen of its own — tick any you want.',
      yesLabel: 'Add the ticked ones',
      noLabel: 'None for now',
      preview: 'depth',
    },
  },

  {
    id: 'pebble',
    title: 'Pebble',
    oneLiner: 'A quiet mascot that only speaks when there’s something to do.',
    group: 'motivation',
    default: false,
    onboarding: {
      question: 'Want Pebble along? It only ever proposes an action — never commentary.',
      yesLabel: 'Bring Pebble',
      noLabel: 'Not now',
      preview: 'pebble',
    },
  },
] as const;

export const EXTRA_IDS: readonly ExtraId[] = EXTRAS.map((e) => e.id);

export function extraDef(id: ExtraId): ExtraDef {
  const def = EXTRAS.find((e) => e.id === id);
  if (!def) throw new Error(`Unknown extra: ${id}`);
  return def;
}

// ── State: a plain flag map, defaults from the registry ────────────────

export type ExtrasState = Record<ExtraId, boolean>;

export const EXTRAS_STORAGE_KEY = 'basalt.extras';
export const EXTRAS_INTRO_SEEN_KEY = 'basalt.extras.introSeen';

export function defaultExtras(): ExtrasState {
  return Object.fromEntries(EXTRAS.map((e) => [e.id, e.default])) as ExtrasState;
}

export function parseExtras(raw: string | null): ExtrasState {
  const base = defaultExtras();
  if (!raw) return base;
  try {
    const parsed = JSON.parse(raw) as Partial<Record<string, boolean>>;
    for (const id of EXTRA_IDS) {
      if (typeof parsed[id] === 'boolean') base[id] = parsed[id]!;
    }
    return base;
  } catch {
    return base;
  }
}

/** True when the Extra AND everything it requires is on. */
export function extraOn(state: ExtrasState, id: ExtraId): boolean {
  const def = extraDef(id);
  if (!state[id]) return false;
  return (def.requires ?? []).every((dep) => extraOn(state, dep));
}

/** Extras that list `id` in their requires chain (direct children only). */
export function dependentsOf(id: ExtraId): ExtraId[] {
  return EXTRAS.filter((e) => (e.requires ?? []).includes(id)).map((e) => e.id);
}

/**
 * Flip one Extra. Turning a parent off turns its dependents off too and
 * reports them, so Settings can say so instead of doing it silently.
 * Turning ON an Extra whose requirement is off is refused (the switch
 * should be disabled; this is the model-level backstop).
 */
export function setExtra(
  state: ExtrasState,
  id: ExtraId,
  on: boolean,
): { state: ExtrasState; turnedOffDependents: ExtraId[]; refused: boolean } {
  const def = extraDef(id);
  if (on && !(def.requires ?? []).every((dep) => state[dep])) {
    return { state, turnedOffDependents: [], refused: true };
  }
  const next: ExtrasState = { ...state, [id]: on };
  const turnedOff: ExtraId[] = [];
  if (!on) {
    const cascade = (parent: ExtraId) => {
      for (const child of dependentsOf(parent)) {
        if (next[child]) {
          next[child] = false;
          turnedOff.push(child);
          cascade(child);
        }
      }
    };
    cascade(id);
  }
  return { state: next, turnedOffDependents: turnedOff, refused: false };
}

// ── Onboarding sequence, derived — copy lives here, not in screens ─────

export type OnboardingExtraScreen = {
  /** Single-extra screen or one screen for a whole group. */
  ids: ExtraId[];
  question: string;
  yesLabel: string;
  noLabel: string;
  preview: string;
};

/** The screens the Extras onboarding shows, in registry order. */
export function onboardingExtraScreens(): OnboardingExtraScreen[] {
  const screens: OnboardingExtraScreen[] = [];
  const byGroup = new Map<string, OnboardingExtraScreen>();
  for (const e of EXTRAS) {
    if (!e.onboarding) continue;
    if (e.onboardingGroup) {
      const existing = byGroup.get(e.onboardingGroup);
      if (existing) { existing.ids.push(e.id); continue; }
    }
    const screen: OnboardingExtraScreen = {
      ids: [e.id],
      question: e.onboarding.question,
      yesLabel: e.onboarding.yesLabel,
      noLabel: e.onboarding.noLabel,
      preview: e.onboarding.preview,
    };
    if (e.onboardingGroup) byGroup.set(e.onboardingGroup, screen);
    screens.push(screen);
  }
  return screens;
}

export const PEBBLE_LEGACY_MIGRATED_KEY = 'basalt.extras.pebbleMigrated';
