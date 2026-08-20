import { describe, it, expect } from 'vitest';
import { color, accents, radius } from './tokens';

// The design contract is binding — these tests pin the exact palette so a
// well-meaning "brightness tweak" can never slip through review unnoticed.

describe('palette pins (design contract §1)', () => {
  it('core surfaces', () => {
    expect(color.bg).toBe('#0F1115');
    expect(color.surface).toBe('#16181D');
    expect(color.surface2).toBe('#1B1E24');
    expect(color.border).toBe('#22262E');
    expect(color.border2).toBe('#2A2F38');
  });

  it('ink ramp', () => {
    expect(color.ink).toBe('#F4F5F6');
    expect(color.ink2).toBe('#B6BCC6');
    expect(color.mute).toBe('#8A909B');
    expect(color.faint).toBe('#565D69');
  });

  it('the four CVD-validated accents — and only four', () => {
    expect(color.protein).toBe('#C08432');
    expect(color.carbs).toBe('#3E9B78');
    expect(color.fat).toBe('#BE5540');
    expect(color.recovery).toBe('#5E72E4');
    expect(accents).toHaveLength(4);
  });

  it('sleep-stage ramp', () => {
    expect(color.recoveryDeep).toBe('#3B4BC8');
    expect(color.recoveryLight).toBe('#8B99F0');
    expect(color.awake).toBe('#3A4048');
  });

  it('no new radii beyond the contract', () => {
    expect(radius.card).toBe(14);
    expect(radius.input).toBe(12);
    expect(radius.timer).toBe(10);
  });
});
