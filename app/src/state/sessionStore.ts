import { create } from 'zustand';
import * as Haptics from 'expo-haptics';
import {
  startSession, endSession, addSessionExercise, logSet, getPrevExerciseSets,
  setExerciseRest, setSupersetGroup, bestE1rm, isSetPr, e1rm,
  createGuidedTimer, startGuidedTimer, stopGuidedTimer, tick as guidedTick,
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
  finish: (rpe: number | null) => Promise<void>;
  addExercise: (exercise: Exercise, timed: boolean) => Promise<void>;
  updateRow: (sessionExerciseId: string, index: number, patch: Partial<SetRowState>) => void;
  addRow: (sessionExerciseId: string) => void;
  commitRow: (sessionExerciseId: string, index: number) => Promise<void>;
  skipRest: () => void;
  setRestSeconds: (sessionExerciseId: string, seconds: number) => void;
  /** Link/unlink this exercise into a superset with the one above it. */
  toggleSupersetWithPrevious: (sessionExerciseId: string) => Promise<void>;
  guidedConfigure: (sessionExerciseId: string, patch: Partial<{ leadInS: number; workS: number; restS: number; sets: number }>) => void;
  guidedToggle: (sessionExerciseId: string) => void;
};

let interval: ReturnType<typeof setInterval> | null = null;

function ensureTicking(get: () => SessionState & { _tick: () => void }) {
  if (interval) return;
  interval = setInterval(() => {
    const s = get();
    const active = s.rest !== null || s.exercises.some((e) => e.guided && e.guided.phase !== 'idle' && e.guided.phase !== 'finished');
    if (!active) {
      if (interval) clearInterval(interval);
      interval = null;
      return;
    }
    s._tick();
  }, 1000);
}

async function historyBestFor(exerciseId: string): Promise<number | null> {
  // All prior sets for this exercise: session_exercises ids → set rows.
  const ex = await supabase
    .from('basalt_session_exercises')
    .select('id')
    .eq('exercise_id', exerciseId)
    .limit(100);
  const ids = (ex.data ?? []).map((r: any) => r.id);
  if (ids.length === 0) return null;
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
  return bestE1rm(mapped);
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

export const useSessionStore = create<SessionState & { _tick: () => void }>((set, get) => ({
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

  finish: async (rpe) => {
    const id = get().sessionId;
    if (!id) return;
    set({ busy: true });
    await endSession(supabase, id, rpe !== null ? { sessionRpe: rpe } : {});
    set({ sessionId: null, startedAt: null, exercises: [], rest: null, busy: false });
  },

  addExercise: async (exercise, timed) => {
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
    const historyBest = await historyBestFor(exercise.id);
    const rows = timed
      ? []
      : Array.from({ length: Math.max(1, prevSets.filter((s) => s.setType !== 'warmup').length || 3) }, (_, i) => ({
          setNumber: i + 1,
          kg: prevSets[i]?.weightKg != null ? String(prevSets[i]!.weightKg) : '',
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
          historyBestE1rm: historyBest,
          timed,
          guided: timed ? createGuidedTimer({ leadInS: 5, workS: 50, restS: 20, sets: 4 }) : null,
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

  _tick: () => {
    const s = get();
    // Rest timer.
    if (s.rest) {
      const remaining = s.rest.remaining - 1;
      if (remaining <= 0) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        set({ rest: null });
      } else {
        set({ rest: { ...s.rest, remaining } });
      }
    }
    // Guided timers.
    set((cur) => ({
      exercises: cur.exercises.map((e) => {
        if (!e.guided || e.guided.phase === 'idle' || e.guided.phase === 'finished') return e;
        const { state, events } = guidedTick(e.guided);
        applyGuidedEvents(events, e);
        return { ...e, guided: state };
      }),
    }));
  },
}));
