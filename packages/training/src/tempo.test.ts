import { describe, it, expect } from 'vitest';
import { tempoBeatAt, tempoCycleS, tempoText, TEMPO_DEFAULT } from './tempo';

describe('tempo metronome', () => {
  it('default is the published 3-1-1, five-second cycle', () => {
    expect(TEMPO_DEFAULT).toEqual({ downS: 3, pauseS: 1, upS: 1 });
    expect(tempoCycleS()).toBe(5);
    expect(tempoText()).toBe('3-1-1');
  });

  it('beats land at phase boundaries and nowhere else', () => {
    expect(tempoBeatAt(0)).toBe('down');
    expect(tempoBeatAt(1)).toBeNull();
    expect(tempoBeatAt(2)).toBeNull();
    expect(tempoBeatAt(3)).toBe('pause');
    expect(tempoBeatAt(4)).toBe('up');
    expect(tempoBeatAt(5)).toBe('down'); // next rep
  });

  it('negative time (lead-in) never beats', () => {
    expect(tempoBeatAt(-2)).toBeNull();
  });
});
