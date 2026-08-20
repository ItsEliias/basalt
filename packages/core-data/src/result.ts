// Canonical Result<T> — was copy-pasted byte-identically across 13 source
// service files (achievementService, exerciseService, foodService,
// habitService, meditationService, questService, sleepService,
// streakService, stepService, walkService, waterService, weightService,
// workoutService) plus services/health/types.ts. Every mutation/query
// returns a Result<T> instead of throwing into the UI layer.
export type Ok<T> = { ok: true; data: T };
export type Err = { ok: false; error: string };
export type Result<T> = Ok<T> | Err;

export const ok = <T>(data: T): Ok<T> => ({ ok: true, data });
export const err = (error: string): Err => ({ ok: false, error });
