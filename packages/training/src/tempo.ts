// Tempo metronome (V3.1 item 3) — a published lifting tempo beaten out
// in haptics during the guided timer's WORK phase. Default 3-1-1:
// three seconds down, one second's pause, one second up. Off by
// default, remembered per exercise. Whole-second phases on purpose —
// the store already ticks at 1 Hz and the wall-clock catch-up keeps it
// honest; a sub-second metronome would be precision theatre.

export const TEMPO_DEFAULT = { downS: 3, pauseS: 1, upS: 1 } as const;

export type Tempo = { downS: number; pauseS: number; upS: number };

export function tempoCycleS(t: Tempo = TEMPO_DEFAULT): number {
  return t.downS + t.pauseS + t.upS;
}

export type TempoBeat = 'down' | 'pause' | 'up' | null;

/** The beat at a whole second into the work phase; null between beats. */
export function tempoBeatAt(secondIntoWork: number, t: Tempo = TEMPO_DEFAULT): TempoBeat {
  if (secondIntoWork < 0) return null;
  const pos = Math.floor(secondIntoWork) % tempoCycleS(t);
  if (pos === 0) return 'down';
  if (pos === t.downS) return 'pause';
  if (pos === t.downS + t.pauseS) return 'up';
  return null;
}

/** "3-1-1" for labels. */
export function tempoText(t: Tempo = TEMPO_DEFAULT): string {
  return `${t.downS}-${t.pauseS}-${t.upS}`;
}
