import { describe, it, expect } from 'vitest';
import {
  createGuidedTimer, startGuidedTimer, stopGuidedTimer, tick, tickMany, collapseSensory, describe as describeState,
  emomConfig, TABATA_CONFIG, circuitConfig, circuitLabel,
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

describe('tickMany + collapseSensory — the screen-off catch-up path', () => {
  it('replaying a long gap lands exactly where wall time says', () => {
    // 5s lead + (50 work + 20 rest) ×: after 130 s → set 1 (55) + rest (75)
    // + 50 work (125) + 5 s into rest 2.
    const { state } = startGuidedTimer(createGuidedTimer(CONFIG));
    const caught = tickMany(state, 130);
    expect(caught.state.phase).toBe('rest');
    expect(caught.state.setsDone).toBe(2);
    expect(caught.state.remaining).toBe(CONFIG.restS - 5);
  });

  it('every set completed during the gap is still logged', () => {
    const { state } = startGuidedTimer(createGuidedTimer(CONFIG));
    const caught = tickMany(state, 130);
    const logs = caught.events.filter((e) => e.type === 'logSet');
    expect(logs).toEqual([
      { type: 'logSet', setNumber: 1, durationS: 50 },
      { type: 'logSet', setNumber: 2, durationS: 50 },
    ]);
  });

  it('a gap past the end finishes cleanly and stops consuming', () => {
    const { state } = startGuidedTimer(createGuidedTimer(CONFIG));
    const caught = tickMany(state, 100000);
    expect(caught.state.phase).toBe('finished');
    expect(caught.state.setsDone).toBe(4);
    expect(caught.events.filter((e) => e.type === 'logSet')).toHaveLength(4);
  });

  it('tickMany(state, 1) is exactly tick(state)', () => {
    const { state } = startGuidedTimer(createGuidedTimer(CONFIG));
    expect(tickMany(state, 1)).toEqual(tick(state));
  });

  it('collapseSensory keeps data events, fires the motor once', () => {
    const { state } = startGuidedTimer(createGuidedTimer(CONFIG));
    const caught = tickMany(state, 130);
    const collapsed = collapseSensory(caught.events);
    expect(collapsed.filter((e) => e.type === 'beep')).toHaveLength(1);
    expect(collapsed.filter((e) => e.type === 'haptic')).toHaveLength(1);
    expect(collapsed.filter((e) => e.type === 'logSet')).toHaveLength(2);
    expect(collapsed.filter((e) => e.type === 'phase')).toEqual(
      caught.events.filter((e) => e.type === 'phase'),
    );
  });
});

describe('interval presets — same engine, same honesty', () => {
  it('EMOM: work + rest always fill exactly one minute', () => {
    for (const w of [20, 40, 55, 90, 2]) {
      const c = emomConfig(w, 10);
      expect(c.workS + c.restS).toBe(60);
      expect(c.workS).toBeGreaterThanOrEqual(5);
      expect(c.workS).toBeLessThanOrEqual(55);
    }
    expect(emomConfig(40, 10).sets).toBe(10);
  });

  it('Tabata is the published 20/10 × 8, pinned', () => {
    expect(TABATA_CONFIG).toEqual({ leadInS: 5, workS: 20, restS: 10, sets: 8 });
  });

  it('circuit sets = stations × rounds; labels walk stations then rounds', () => {
    const c = circuitConfig(4, 3, 45, 15);
    expect(c.sets).toBe(12);
    let state = startGuidedTimer(createGuidedTimer(c)).state;
    expect(circuitLabel(state, 4)).toBe('Station 1 of 4 · round 1 of 3');
    // run through lead + 4 full stations to reach round 2
    state = runSeconds(state, 5 + 4 * 60).state;
    expect(circuitLabel(state, 4)).toBe('Station 1 of 4 · round 2 of 3');
  });

  it('a finished circuit clamps to the last station, no phantom round', () => {
    const c = circuitConfig(2, 2, 10, 5);
    const done = tickMany(startGuidedTimer(createGuidedTimer(c)).state, 10000).state;
    expect(circuitLabel(done, 2)).toBe('Station 2 of 2 · round 2 of 2');
  });
});
