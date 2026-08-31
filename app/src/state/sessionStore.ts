import { create } from 'zustand';
import * as Haptics from 'expo-haptics';
import {
  startSession, endSession, addSessionExercise, logSet, getPrevExerciseSets,
  setExerciseRest, setSupersetGroup, bestE1rm, isSetPr, e1rm,
  createGuidedTimer, startGuidedTimer, stopGuidedTimer, tickMany as guidedTickMany,
  collapseSensory, describe as guidedDescribe, suggestNext, setExerciseFeedback, repPrMatrix,
  removeSessionExercise, startSessionFromTemplate, getExerciseById,
  type Suggestion, type ExerciseFeedback, type RepPr, type AdaptChange, type TimerMode,
  type SetEntry, type Exercise, type GuidedState, type GuidedEvent,
} from '@basalt/training';
import { supabase } from '../lib/supabase';

// The active training session — lives in a store (not screen state) so
// timers and typed values survive tab switches. One 1 Hz interval drives
// the rest timer and the guided set timer; haptics are the primary signal.

export type SetRowState = {
  setNumber: number;
  kg: string;
  reps: string;
  rir: string;
  comment: string;
  committed: boolean;
  isPr: boolean;
};

export type SessionExerciseState = {
  sessionExerciseId: string;
  exercise: Exercise;
  rows: SetRowState[];
  prevSets: SetEntry[];
  prevPerformedAt: string | null;
  restSeconds: number;
  supersetGroup: number | null;
  /** Best e1RM across ALL prior history for the quiet PR mark. */
  historyBestE1rm: number | null;
  /** Timed exercises carry a guided timer instead of a reps table. */
  timed: boolean;
  guided: GuidedState | null;
  timerMode: TimerMode;
  /** Circuit mode: stations per round, for the station/round label. */
  stations: number;
  /** Deterministic next-session hint — a suggestion, never a mandate. */
  suggestion: Suggestion | null;
  /** Best real weight per rep count, from all history. Empty = hidden. */
  repPrs: RepPr[];
  /** One-tap post-exercise feedback, feeding the next suggestion. */
  feedback: ExerciseFeedback | null;
  /** The user's own stated plan for this exercise, from a template — a ghost hint, never invented. */
  target: { sets: number; reps: number | null; weightKg: number | null } | null;
};

type RestState = { sessionExerciseId: string; remaining: number } | null;

type SessionState = {
  sessionId: string | null;
  startedAt: string | null;
  exercises: SessionExerciseState[];
  rest: RestState;
  busy: boolean;
  error: string | null;

  start: () => Promise<void>;
  startFromTemplate: (templateId: string) => Promise<void>;
  finish: (rpe: number | null) => Promise<void>;
  addExercise: (exercise: Exercise, timed: boolean, target?: SessionExerciseState['target']) => Promise<void>;
  updateRow: (sessionExerciseId: string, index: number, patch: Partial<SetRowState>) => void;
  addRow: (sessionExerciseId: string) => void;
  commitRow: (sessionExerciseId: string, index: number) => Promise<void>;
  skipRest: () => void;
  setRestSeconds: (sessionExerciseId: string, seconds: number) => void;
  /** Link/unlink this exercise into a superset with the one above it. */
  toggleSupersetWithPrevious: (sessionExerciseId: string) => Promise<void>;
  guidedConfigure: (sessionExerciseId: string, patch: Partial<{ leadInS: number; workS: number; restS: number; sets: number }>) => void;
  setTimerMode: (sessionExerciseId: string, mode: TimerMode, config: { leadInS: number; workS: number; restS: number; sets: number }, stations?: number) => void;
  guidedToggle: (sessionExerciseId: string) => void;
  giveFeedback: (sessionExerciseId: string, feedback: ExerciseFeedback) => Promise<void>;
  /** Apply a confirmed Adapt proposal. Exercises with logged sets arrive as 'keep'. */
  applyAdapt: (changes: AdaptChange<Exercise>[]) => Promise<void>;
};

let interval: ReturnType<typeof setInterval> | null = null;
let lastTickMs: number | null = null;

// The foreground service is injected (App wires notifee in) so this store
// stays free of native imports and testable. onActive receives a phase
// label and is only called when it changes; onInactive ends the service.
export type TimerServiceHooks = { onActive: (label: string) => void; onInactive: () => void };
let timerHooks: TimerServiceHooks | null = null;
let lastServiceLabel: string | null = null;
export function setTimerServiceHooks(hooks: TimerServiceHooks | null) {
  timerHooks = hooks;
}

function timerLabel(s: SessionState): string | null {
  const guided = s.exercises.find(
    (e) => e.guided && e.guided.phase !== 'idle' && e.guided.phase !== 'finished',
  );
  if (guided?.guided) return guidedDescribe(guided.guided).label;
  if (s.rest !== null) {
    // 10 s buckets: the ongoing notification counts down without a
    // per-second update storm; the final 5 s go exact for the cue.
    const r = s.rest.remaining;
    const shown = r <= 5 ? r : Math.ceil(r / 10) * 10;
    const mm = Math.floor(shown / 60);
    const ss = String(shown % 60).padStart(2, '0');
    return `Rest — about ${mm}:${ss} left`;
  }
  return null;
}

function pushTimerService(s: SessionState) {
  if (!timerHooks) return;
  const label = timerLabel(s);
  if (label === null) {
    if (lastServiceLabel !== null) {
      lastServiceLabel = null;
      timerHooks.onInactive();
    }
    return;
  }
  if (label !== lastServiceLabel) {
    lastServiceLabel = label;
    timerHooks.onActive(label);
  }
}

function ensureTicking(get: () => SessionState & { _tick: (elapsedS?: number) => void }) {
  if (interval) return;
  lastTickMs = Date.now();
  pushTimerService(get());
  interval = setInterval(() => {
    const s = get();
    const active = s.rest !== null || s.exercises.some((e) => e.guided && e.guided.phase !== 'idle' && e.guided.phase !== 'finished');
    if (!active) {
      if (interval) clearInterval(interval);
      interval = null;
      lastTickMs = null;
      pushTimerService(s);
      return;
    }
    // Wall-clock elapsed, not tick count: if the OS throttled us (screen
    // off without the service, doze), replay the missed seconds so the
    // timer lands where real time says it should.
    const now = Date.now();
    const elapsedS = Math.min(24 * 3600, Math.max(1, Math.round((now - (lastTickMs ?? now)) / 1000)));
    lastTickMs = now;
    s._tick(elapsedS);
    pushTimerService(get());
  }, 1000);
}

async function historyFor(exerciseId: string): Promise<{ bestE1rm: number | null; repPrs: RepPr[] }> {
  // All prior sets for this exercise: session_exercises ids → set rows.
  const ex = await supabase
    .from('basalt_session_exercises')
    .select('id')
    .eq('exercise_id', exerciseId)
    .limit(100);
  const ids = (ex.data ?? []).map((r: any) => r.id);
  if (ids.length === 0) return { bestE1rm: null, repPrs: [] };
  const sets = await supabase
    .from('basalt_set_entries')
    .select('*')
    .in('session_exercise_id', ids)
    .limit(1000);
  const mapped: SetEntry[] = (sets.data ?? []).map((r: any) => ({
    id: r.id, sessionExerciseId: r.session_exercise_id, userId: r.user_id,
    setNumber: r.set_number, setType: r.set_type ?? 'normal', reps: r.reps ?? null,
    weightKg: r.weight_kg == null ? null : Number(r.weight_kg), durationS: r.duration_s ?? null,
    rir: r.rir == null ? null : Number(r.rir), rpe: r.rpe == null ? null : Number(r.rpe),
    restS: r.rest_s ?? null, comment: r.comment ?? null, completedAt: r.completed_at,
  }));
  return {
    bestE1rm: bestE1rm(mapped),
    repPrs: repPrMatrix(
      mapped.map((m) => ({ setType: m.setType, reps: m.reps, weightKg: m.weightKg, completedAt: m.completedAt })),
    ),
  };
}

function applyGuidedEvents(
  events: GuidedEvent[],
  ex: SessionExerciseState,
): void {
  for (const ev of events) {
    if (ev.type === 'haptic') {
      void Haptics.impactAsync(
        ev.kind === 'warning' ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium,
      );
    }
    if (ev.type === 'logSet') {
      void logSet(supabase, ex.sessionExerciseId, {
        setNumber: ev.setNumber,
        durationS: ev.durationS,
      });
    }
  }
}

export const useSessionStore = create<SessionState & { _tick: (elapsedS?: number) => void }>((set, get) => ({
  sessionId: null,
  startedAt: null,
  exercises: [],
  rest: null,
  busy: false,
  error: null,

  start: async () => {
    set({ busy: true, error: null });
    const r = await startSession(supabase);
    if (!r.ok) {
      set({ busy: false, error: r.error });
      return;
    }
    set({ sessionId: r.data.id, startedAt: r.data.startedAt, exercises: [], rest: null, busy: false });
  },

  startFromTemplate: async (templateId) => {
    set({ busy: true, error: null });
    const r = await startSessionFromTemplate(supabase, templateId);
    if (!r.ok) {
      set({ busy: false, error: r.error });
      return;
    }
    set({ sessionId: r.data.session.id, startedAt: r.data.session.startedAt, exercises: [], rest: null, busy: false });
    for (const te of r.data.exercises) {
      const resolved = te.exerciseId ? await getExerciseById(supabase, te.exerciseId) : null;
      const exercise: Exercise = resolved?.ok && resolved.data
        ? resolved.data
        : {
            id: te.exerciseId ?? '', extId: '', source: 'template', name: te.exerciseName,
            category: null, primaryMuscles: [], secondaryMuscles: [], equipment: null,
            difficulty: null, instructions: [], imageUrls: [], videoUrl: null,
          };
      await get().addExercise(exercise, false, { sets: te.targetSets, reps: te.targetReps, weightKg: te.targetWeightKg });
    }
  },

  finish: async (rpe) => {
    const id = get().sessionId;
    if (!id) return;
    set({ busy: true });
    await endSession(supabase, id, rpe !== null ? { sessionRpe: rpe } : {});
    set({ sessionId: null, startedAt: null, exercises: [], rest: null, busy: false });
  },

  addExercise: async (exercise, timed, target) => {
    const state = get();
    if (!state.sessionId) return;
    set({ busy: true });
    const added = await addSessionExercise(supabase, {
      sessionId: state.sessionId,
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      orderIndex: state.exercises.length,
    });
    if (!added.ok) {
      set({ busy: false, error: added.error });
      return;
    }
    const prev = await getPrevExerciseSets(supabase, exercise.id);
    const prevSets = prev.ok && prev.data ? prev.data.sets : [];
    const history = await historyFor(exercise.id);
    const suggestion = timed
      ? null
      : suggestNext({
          prev:
            prev.ok && prev.data
              ? {
                  performedAt: prev.data.performedAt,
                  feedback: prev.data.feedback,
                  sets: prev.data.sets.map((s) => ({
                    setType: s.setType, reps: s.reps, weightKg: s.weightKg, rir: s.rir,
                  })),
                }
              : null,
          today: new Date(),
        });
    const rowCount = target?.sets || prevSets.filter((s) => s.setType !== 'warmup').length || 3;
    const rows = timed
      ? []
      : Array.from({ length: Math.max(1, rowCount) }, (_, i) => ({
          setNumber: i + 1,
          kg: prevSets[i]?.weightKg != null ? String(prevSets[i]!.weightKg) : target?.weightKg != null ? String(target.weightKg) : '',
          reps: '',
          rir: '',
          comment: '',
          committed: false,
          isPr: false,
        }));
    set({
      busy: false,
      exercises: [
        ...get().exercises,
        {
          sessionExerciseId: added.data.id,
          exercise,
          rows,
          prevSets,
          prevPerformedAt: prev.ok && prev.data ? prev.data.performedAt : null,
          restSeconds: (prev.ok && prev.data?.restSeconds) || 120,
          supersetGroup: null,
          historyBestE1rm: history.bestE1rm,
          repPrs: history.repPrs,
          timed,
          guided: timed ? createGuidedTimer({ leadInS: 10, workS: 50, restS: 20, sets: 4 }) : null,
          suggestion,
          feedback: null,
          timerMode: 'custom',
          stations: 4,
          target: target ?? null,
        },
      ],
    });
  },

  updateRow: (id, index, patch) =>
    set((s) => ({
      exercises: s.exercises.map((e) =>
        e.sessionExerciseId === id
          ? { ...e, rows: e.rows.map((r, i) => (i === index ? { ...r, ...patch } : r)) }
          : e,
      ),
    })),

  addRow: (id) =>
    set((s) => ({
      exercises: s.exercises.map((e) =>
        e.sessionExerciseId === id
          ? { ...e, rows: [...e.rows, { setNumber: e.rows.length + 1, kg: '', reps: '', rir: '', comment: '', committed: false, isPr: false }] }
          : e,
      ),
    })),

  commitRow: async (id, index) => {
    const ex = get().exercises.find((e) => e.sessionExerciseId === id);
    const row = ex?.rows[index];
    if (!ex || !row) return;
    const kg = row.kg.trim() === '' ? null : parseFloat(row.kg.replace(',', '.'));
    const reps = row.reps.trim() === '' ? null : parseInt(row.reps, 10);
    const rir = row.rir.trim() === '' ? null : parseFloat(row.rir.replace(',', '.'));
    if (reps === null || !isFinite(reps)) return; // an uncommitted ghost row

    const r = await logSet(supabase, id, {
      setNumber: row.setNumber,
      reps,
      weightKg: kg !== null && isFinite(kg) ? kg : null,
      rir: rir !== null && isFinite(rir) ? Math.min(10, Math.max(0, rir)) : null,
      restS: ex.restSeconds,
      comment: row.comment.trim() || null,
    });
    if (!r.ok) {
      set({ error: r.error });
      return;
    }
    // Quiet PR mark: beats the best e1RM across all prior history.
    const pr =
      ex.historyBestE1rm !== null &&
      (() => {
        const v = e1rm(r.data.weightKg, r.data.reps);
        return v !== null && v > ex.historyBestE1rm!;
      })();
    get().updateRow(id, index, { committed: true, isPr: pr });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Start the per-exercise rest timer.
    set({ rest: { sessionExerciseId: id, remaining: ex.restSeconds } });
    ensureTicking(get);
  },

  skipRest: () => set({ rest: null }),

  setRestSeconds: (id, seconds) => {
    set((s) => ({
      exercises: s.exercises.map((e) => (e.sessionExerciseId === id ? { ...e, restSeconds: seconds } : e)),
    }));
    void setExerciseRest(supabase, id, seconds);
  },

  toggleSupersetWithPrevious: async (id) => {
    const exercises = get().exercises;
    const idx = exercises.findIndex((e) => e.sessionExerciseId === id);
    if (idx <= 0) return; // nothing above to link with
    const cur = exercises[idx]!;
    const prev = exercises[idx - 1]!;

    if (cur.supersetGroup !== null && cur.supersetGroup === prev.supersetGroup) {
      // Unlink the current exercise from the pair/chain.
      await setSupersetGroup(supabase, cur.sessionExerciseId, null);
      set((s) => ({
        exercises: s.exercises.map((e) =>
          e.sessionExerciseId === id ? { ...e, supersetGroup: null } : e,
        ),
      }));
      return;
    }

    const group =
      prev.supersetGroup ??
      Math.max(0, ...exercises.map((e) => e.supersetGroup ?? 0)) + 1;
    if (prev.supersetGroup === null) {
      await setSupersetGroup(supabase, prev.sessionExerciseId, group);
    }
    await setSupersetGroup(supabase, cur.sessionExerciseId, group);
    set((s) => ({
      exercises: s.exercises.map((e) => {
        if (e.sessionExerciseId === id) return { ...e, supersetGroup: group };
        if (e.sessionExerciseId === prev.sessionExerciseId) return { ...e, supersetGroup: group };
        return e;
      }),
    }));
  },

  guidedConfigure: (id, patch) =>
    set((s) => ({
      exercises: s.exercises.map((e) => {
        if (e.sessionExerciseId !== id || !e.guided) return e;
        if (e.guided.phase !== 'idle' && e.guided.phase !== 'finished') return e; // no live edits
        const config = { ...e.guided.config, ...patch };
        return { ...e, guided: createGuidedTimer(config) };
      }),
    })),

  applyAdapt: async (changes) => {
    for (const change of changes) {
      if (change.action === 'trim' && change.toSets !== undefined) {
        set((s) => ({
          exercises: s.exercises.map((e) => {
            if (e.sessionExerciseId !== change.id) return e;
            const kept: typeof e.rows = [];
            for (const row of e.rows) {
              if (row.committed || kept.length < change.toSets!) kept.push(row);
            }
            return { ...e, rows: kept.map((r, i) => ({ ...r, setNumber: i + 1 })) };
          }),
        }));
      }
      if (change.action === 'drop' || change.action === 'swap') {
        await removeSessionExercise(supabase, change.id);
        set((s) => ({ exercises: s.exercises.filter((e) => e.sessionExerciseId !== change.id) }));
        if (change.action === 'swap' && change.replacement) {
          await get().addExercise(change.replacement, false);
        }
      }
    }
  },

  giveFeedback: async (id, feedback) => {
    set((s) => ({
      exercises: s.exercises.map((e) => (e.sessionExerciseId === id ? { ...e, feedback } : e)),
    }));
    await setExerciseFeedback(supabase, id, feedback);
  },

  setTimerMode: (id, mode, config, stations) =>
    set((s) => ({
      exercises: s.exercises.map((e) => {
        if (e.sessionExerciseId !== id || !e.guided) return e;
        if (e.guided.phase !== 'idle' && e.guided.phase !== 'finished') return e; // no live edits
        return { ...e, timerMode: mode, stations: stations ?? e.stations, guided: createGuidedTimer(config) };
      }),
    })),

  guidedToggle: (id) => {
    const ex = get().exercises.find((e) => e.sessionExerciseId === id);
    if (!ex?.guided) return;
    if (ex.guided.phase === 'idle' || ex.guided.phase === 'finished') {
      const { state, events } = startGuidedTimer(createGuidedTimer(ex.guided.config));
      applyGuidedEvents(events, ex);
      set((s) => ({
        exercises: s.exercises.map((e) => (e.sessionExerciseId === id ? { ...e, guided: state } : e)),
      }));
      ensureTicking(get);
    } else {
      set((s) => ({
        exercises: s.exercises.map((e) =>
          e.sessionExerciseId === id && e.guided ? { ...e, guided: stopGuidedTimer(e.guided) } : e,
        ),
      }));
    }
  },

  _tick: (elapsedS = 1) => {
    const s = get();
    // Rest timer.
    if (s.rest) {
      const remaining = s.rest.remaining - elapsedS;
      if (remaining <= 0) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        set({ rest: null });
      } else {
        set({ rest: { ...s.rest, remaining } });
      }
    }
    // Guided timers — a multi-second catch-up replays every transition but
    // fires the motor once (collapseSensory), so a resumed screen never
    // machine-guns haptics.
    set((cur) => ({
      exercises: cur.exercises.map((e) => {
        if (!e.guided || e.guided.phase === 'idle' || e.guided.phase === 'finished') return e;
        const { state, events } = guidedTickMany(e.guided, elapsedS);
        applyGuidedEvents(elapsedS > 1 ? collapseSensory(events) : events, e);
        return { ...e, guided: state };
      }),
    }));
  },
}));
