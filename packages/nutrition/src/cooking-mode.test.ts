import { describe, it, expect } from 'vitest';
import { stepMinutes, mergeTimelines, atText } from './cooking-mode';

describe('stepMinutes', () => {
  it('reads stated minutes, hours, seconds', () => {
    expect(stepMinutes('Simmer for 20 min')).toBe(20);
    expect(stepMinutes('Bake 1 hour')).toBe(60);
    expect(stepMinutes('Roast for 1 hr 30 min')).toBe(90);
    expect(stepMinutes('Blanch 90 seconds')).toBe(1.5);
  });

  it('ranges take the LOWER bound — you check early, food doesn\'t uncook', () => {
    expect(stepMinutes('Fry 10–12 minutes until golden')).toBe(10);
    expect(stepMinutes('Bake 25-30 mins')).toBe(25);
  });

  it('null when the step states no time — never invented', () => {
    expect(stepMinutes('Season to taste and serve')).toBeNull();
    expect(stepMinutes('Add 200 g rice and stir')).toBeNull();
  });
});

describe('mergeTimelines', () => {
  const curry = { title: 'Curry', steps: ['Fry paste 5 min', 'Simmer 30 min', 'Serve'] };
  const rice = { title: 'Rice', steps: ['Rinse', 'Cook 12 min', 'Rest 5 min'] };

  it('everything finishes together — the longest starts at zero', () => {
    const plan = mergeTimelines([curry, rice]);
    expect(plan.totalMin).toBe(35);
    // Rice total = 17, so it joins at 35 − 17 = 18.
    const riceStart = plan.entries.find((e) => e.recipeTitle === 'Rice')!;
    expect(riceStart.atMin).toBe(18);
  });

  it('steps sequence within each recipe by cumulative stated time', () => {
    const plan = mergeTimelines([curry, rice]);
    const currySteps = plan.entries.filter((e) => e.recipeTitle === 'Curry');
    expect(currySteps.map((e) => e.atMin)).toEqual([0, 5, 35]);
  });

  it('unscheduled steps are counted and keep their place, never guessed', () => {
    const plan = mergeTimelines([curry, rice]);
    expect(plan.unscheduledCount).toBe(2); // "Serve" and "Rinse"
    const rinse = plan.entries.find((e) => e.text === 'Rinse')!;
    expect(rinse.durationMin).toBeNull();
    expect(rinse.atMin).toBe(18); // sits at its recipe's start, in order
  });

  it('a single recipe is just its own schedule from zero', () => {
    const plan = mergeTimelines([rice]);
    expect(plan.totalMin).toBe(17);
    expect(plan.entries[0]!.atMin).toBe(0);
  });

  it('merged order is by time, ties broken by recipe order', () => {
    const a = { title: 'A', steps: ['Cook 10 min'] };
    const b = { title: 'B', steps: ['Cook 10 min'] };
    const plan = mergeTimelines([a, b]);
    expect(plan.entries.map((e) => e.recipeTitle)).toEqual(['A', 'B']);
  });
});

describe('atText', () => {
  it('minutes under the hour, h:mm over', () => {
    expect(atText(0)).toBe('+0 min');
    expect(atText(18)).toBe('+18 min');
    expect(atText(84)).toBe('+1:24 h');
  });
});
