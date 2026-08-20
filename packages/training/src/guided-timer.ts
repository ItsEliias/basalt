// Guided set timer for timed exercises — a pure, deterministic state
// machine. The UI owns the 1 Hz tick, haptics and audio; @basalt/training
// owns every transition so the sequence is testable to the second.
//
// Phases: idle → lead-in → work → rest (last-5 warning) → work … → finished.
// Completing a work phase emits `logSet` so callers auto-log the set as a
// duration into basalt_set_entries (design contract: SETS AUTO-LOGGED).

export type GuidedConfig = {
  leadInS: number;
  workS: number;
  restS: number;
  sets: number;
};

export type GuidedPhase = 'idle' | 'lead' | 'work' | 'rest' | 'finished';

export type GuidedState = {
  config: GuidedConfig;
  phase: GuidedPhase;
  /** Seconds remaining in the current phase. */
  remaining: number;
  /** 0-based index of the set now running (or about to run). */
  setIndex: number;
  /** Completed set count. */
  setsDone: number;
};

export type GuidedEvent =
  | { type: 'phase'; phase: GuidedPhase }
  | { type: 'beep'; kind: 'work-start' | 'work-end' | 'last-5' | 'finished' }
  | { type: 'haptic'; kind: 'phase-change' | 'warning' }
  | { type: 'logSet'; setNumber: number; durationS: number };

export function createGuidedTimer(config: GuidedConfig): GuidedState {
  return { config, phase: 'idle', remaining: config.workS, setIndex: 0, setsDone: 0 };
}

export function startGuidedTimer(state: GuidedState): { state: GuidedState; events: GuidedEvent[] } {
  const lead = Math.max(0, state.config.leadInS);
  if (lead === 0) {
    return {
      state: { ...state, phase: 'work', remaining: state.config.workS, setIndex: 0, setsDone: 0 },
      events: [
        { type: 'phase', phase: 'work' },
        { type: 'beep', kind: 'work-start' },
        { type: 'haptic', kind: 'phase-change' },
      ],
    };
  }
  return {
    state: { ...state, phase: 'lead', remaining: lead, setIndex: 0, setsDone: 0 },
    events: [{ type: 'phase', phase: 'lead' }],
  };
}

export function stopGuidedTimer(state: GuidedState): GuidedState {
  return { ...state, phase: 'idle', remaining: state.config.workS, setIndex: 0, setsDone: 0 };
}

/** Advance one second. Call at 1 Hz while phase ∉ {idle, finished}. */
export function tick(state: GuidedState): { state: GuidedState; events: GuidedEvent[] } {
  const { config } = state;
  if (state.phase === 'idle' || state.phase === 'finished') {
    return { state, events: [] };
  }

  const remaining = state.remaining - 1;
  const events: GuidedEvent[] = [];

  if (state.phase === 'lead') {
    if (remaining > 0) return { state: { ...state, remaining }, events };
    events.push({ type: 'phase', phase: 'work' }, { type: 'beep', kind: 'work-start' }, { type: 'haptic', kind: 'phase-change' });
    return { state: { ...state, phase: 'work', remaining: config.workS }, events };
  }

  if (state.phase === 'work') {
    if (remaining > 0) return { state: { ...state, remaining }, events };
    const setsDone = state.setsDone + 1;
    events.push(
      { type: 'beep', kind: 'work-end' },
      { type: 'haptic', kind: 'phase-change' },
      { type: 'logSet', setNumber: setsDone, durationS: config.workS },
    );
    if (setsDone >= config.sets) {
      events.push({ type: 'phase', phase: 'finished' }, { type: 'beep', kind: 'finished' });
      return { state: { ...state, phase: 'finished', remaining: 0, setsDone }, events };
    }
    events.push({ type: 'phase', phase: 'rest' });
    return { state: { ...state, phase: 'rest', remaining: config.restS, setsDone, setIndex: setsDone }, events };
  }

  // rest
  if (remaining === 5) {
    events.push({ type: 'beep', kind: 'last-5' }, { type: 'haptic', kind: 'warning' });
  }
  if (remaining > 0) return { state: { ...state, remaining }, events };
  events.push({ type: 'phase', phase: 'work' }, { type: 'beep', kind: 'work-start' }, { type: 'haptic', kind: 'phase-change' });
  return { state: { ...state, phase: 'work', remaining: config.workS }, events };
}

/** Display descriptor the UI can render without re-deriving rules. */
export function describe(state: GuidedState): {
  seconds: number;
  tone: 'work' | 'rest' | 'warn' | 'idle';
  label: string;
  progress: number;
} {
  const { config } = state;
  const setNo = Math.min(state.setIndex + 1, config.sets);
  switch (state.phase) {
    case 'idle':
      return { seconds: config.workS, tone: 'idle', label: 'Ready — tap go', progress: 0 };
    case 'lead':
      return {
        seconds: state.remaining,
        tone: 'idle',
        label: `Get set — set ${setNo} of ${config.sets}`,
        progress: 1 - state.remaining / Math.max(1, config.leadInS),
      };
    case 'work':
      return {
        seconds: state.remaining,
        tone: 'work',
        label: `WORK — set ${setNo} of ${config.sets}`,
        progress: 1 - state.remaining / Math.max(1, config.workS),
      };
    case 'rest': {
      const warn = state.remaining <= 5;
      return {
        seconds: state.remaining,
        tone: warn ? 'warn' : 'rest',
        label: warn ? 'NEXT SET IN…' : 'Rest — breathe',
        progress: 1 - state.remaining / Math.max(1, config.restS),
      };
    }
    case 'finished':
      return {
        seconds: 0,
        tone: 'idle',
        label: `${config.sets} × ${config.workS} s logged`,
        progress: 1,
      };
  }
}
