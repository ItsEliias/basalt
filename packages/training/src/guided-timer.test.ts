import { describe, it, expect } from 'vitest';
import {
  createGuidedTimer, startGuidedTimer, stopGuidedTimer, tick, describe as describeState,
  type GuidedEvent, type GuidedState,
} from './guided-timer';

// The prototype's plank demo: 5 s lead-in → 50 s work → 20 s rest × 4 sets.
const CONFIG = { leadInS: 5, workS: 50, restS: 20, sets: 4 };

function runSeconds(state: GuidedState, seconds: number): { state: GuidedState; events: GuidedEvent[] } {
  const events: GuidedEvent[] = [];
  let cur = state;
  for (let i = 0; i < seconds; i++) {
    const r = tick(cur);
    cur = r.state;
    events.push(...r.events);
  }
  return { state: cur, events };
}

describe('guided set timer — full sequence', () => {
  it('runs lead → work → rest × sets and finishes on the last work second', () => {
    let { state } = startGuidedTimer(createGuidedTimer(CONFIG));
    expect(state.phase).toBe('lead');

    // Total run time: 5 lead + 4×50 work + 3×20 rest = 265 s.
    const r = runSeconds(state, 265);
    expect(r.state.phase).toBe('finished');
    expect(r.state.setsDone).toBe(4);

    const logs = r.events.filter((e) => e.type === 'logSet');
    expect(logs).toHaveLength(4);
    expect(logs.map((l) => l.type === 'logSet' && l.setNumber)).toEqual([1, 2, 3, 4]);
    expect(logs.every((l) => l.type === 'logSet' && l.durationS === 50)).toBe(true);
  });

  it('one second short of the end it is still working', () => {
    const { state } = startGuidedTimer(createGuidedTimer(CONFIG));
    const r = runSeconds(state, 264);
    expect(r.state.phase).toBe('work');
    expect(r.state.remaining).toBe(1);
  });

  it('emits the last-5 warning exactly once per rest, 5 s before work', () => {
    const { state } = startGuidedTimer(createGuidedTimer(CONFIG));
    const r = runSeconds(state, 265);
    const warns = r.events.filter((e) => e.type === 'beep' && e.kind === 'last-5');
    expect(warns).toHaveLength(3); // one per rest period
  });

  it('beeps work-start at every work phase and finished at the end', () => {
    const { state, events: startEvents } = startGuidedTimer(createGuidedTimer(CONFIG));
    const r = runSeconds(state, 265);
    const all = [...startEvents, ...r.events];
    expect(all.filter((e) => e.type === 'beep' && e.kind === 'work-start')).toHaveLength(4);
    expect(all.filter((e) => e.type === 'beep' && e.kind === 'finished')).toHaveLength(1);
  });

  it('haptics fire on every phase change — haptics are primary, sound optional', () => {
    const { state } = startGuidedTimer(createGuidedTimer(CONFIG));
    const r = runSeconds(state, 265);
    const haptics = r.events.filter((e) => e.type === 'haptic');
    // lead→work ×4? lead→work once, work→rest ×4 (each work end), rest→work ×3, warnings ×3.
    expect(haptics.filter((h) => h.type === 'haptic' && h.kind === 'phase-change')).toHaveLength(8);
    expect(haptics.filter((h) => h.type === 'haptic' && h.kind === 'warning')).toHaveLength(3);
  });
});

describe('edge configs', () => {
  it('zero lead-in starts straight into work', () => {
    const { state, events } = startGuidedTimer(createGuidedTimer({ ...CONFIG, leadInS: 0 }));
    expect(state.phase).toBe('work');
    expect(events.some((e) => e.type === 'beep' && e.kind === 'work-start')).toBe(true);
  });

  it('a single set skips rest entirely', () => {
    const { state } = startGuidedTimer(createGuidedTimer({ leadInS: 0, workS: 10, restS: 20, sets: 1 }));
    const r = runSeconds(state, 10);
    expect(r.state.phase).toBe('finished');
    expect(r.events.filter((e) => e.type === 'phase' && e.phase === 'rest')).toHaveLength(0);
  });

  it('stop resets to idle without logging anything', () => {
    const { state } = startGuidedTimer(createGuidedTimer(CONFIG));
    const mid = runSeconds(state, 30).state;
    const stopped = stopGuidedTimer(mid);
    expect(stopped.phase).toBe('idle');
    expect(stopped.setsDone).toBe(0);
  });

  it('ticking an idle or finished timer is a no-op', () => {
    const idle = createGuidedTimer(CONFIG);
    expect(tick(idle)).toEqual({ state: idle, events: [] });
    const { state } = startGuidedTimer(createGuidedTimer({ leadInS: 0, workS: 1, restS: 1, sets: 1 }));
    const done = runSeconds(state, 1).state;
    expect(done.phase).toBe('finished');
    expect(tick(done).events).toEqual([]);
  });
});

describe('describe() — display contract', () => {
  it('labels each phase the way the prototype does', () => {
    const idle = createGuidedTimer(CONFIG);
    expect(describeState(idle)).toMatchObject({ label: 'Ready — tap go', seconds: 50, tone: 'idle' });

    const { state: lead } = startGuidedTimer(idle);
    expect(describeState(lead).label).toBe('Get set — set 1 of 4');

    const work = runSeconds(lead, 5).state;
    expect(describeState(work)).toMatchObject({ label: 'WORK — set 1 of 4', tone: 'work' });

    const rest = runSeconds(work, 50).state;
    expect(describeState(rest)).toMatchObject({ label: 'Rest — breathe', tone: 'rest' });

    const warn = runSeconds(rest, 15).state; // 20 − 15 = 5 s left
    expect(describeState(warn)).toMatchObject({ label: 'NEXT SET IN…', tone: 'warn' });
  });

  it('reports honest progress fractions', () => {
    const { state } = startGuidedTimer(createGuidedTimer({ leadInS: 0, workS: 10, restS: 10, sets: 2 }));
    const half = runSeconds(state, 5).state;
    expect(describeState(half).progress).toBeCloseTo(0.5);
  });
});
