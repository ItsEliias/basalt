import type { SupabaseClient } from '@supabase/supabase-js';
import { ok, type Result } from '@basalt/core-data';
import { startSession, addSessionExercise, logSet, endSession } from './sessions';
import { importExtId, type ImportedSession } from './import-csv';

// Committing an import — every row through the same service layer a live
// session uses (startSession → addSessionExercise → logSet → endSession),
// so RLS, validation, and the future outbox all apply identically. The
// ext_id unique index turns re-imports of the same file into skips, not
// duplicates.

export type ImportCommitReport = {
  imported: number;
  skipped: number; // already present (ext_id collision) — idempotent re-run
  failed: { session: string; reason: string }[];
  setsWritten: number;
};

export async function commitImport(
  client: SupabaseClient,
  sessions: ImportedSession[],
  options: {
    /** 'strong' | 'hevy' | 'generic' | 'basalt' — lands in sessions.source. */
    source: string;
    /** Source name → catalog exercise id, from the preview's mapping UI. */
    exerciseIdFor?: (name: string) => string | null;
  },
): Promise<Result<ImportCommitReport>> {
  const report: ImportCommitReport = { imported: 0, skipped: 0, failed: [], setsWritten: 0 };

  for (const session of sessions) {
    const started = await startSession(client, {
      startedAt: session.startedAt,
      notes: session.name ?? undefined,
      source: `import:${options.source}`,
      extId: importExtId(options.source, session),
    });
    if (!started.ok) {
      // A unique violation on ext_id is the idempotency path, not a failure.
      if (/duplicate|unique/i.test(started.error)) report.skipped += 1;
      else report.failed.push({ session: session.name ?? session.startedAt, reason: started.error });
      continue;
    }

    let orderIndex = 0;
    let lastSetAt = session.startedAt;
    for (const ex of session.exercises) {
      const se = await addSessionExercise(client, {
        sessionId: started.data.id,
        exerciseId: options.exerciseIdFor?.(ex.name) ?? null,
        exerciseName: ex.name,
        orderIndex: orderIndex++,
      });
      if (!se.ok) {
        report.failed.push({ session: session.name ?? session.startedAt, reason: se.error });
        continue;
      }
      for (const set of ex.sets) {
        // Backdate completions inside the session window so day-keyed
        // analysis holds (the seed script learned this the hard way).
        const completedAt = new Date(
          new Date(session.startedAt).getTime() + orderIndex * 60_000 + set.setNumber * 90_000,
        ).toISOString();
        lastSetAt = completedAt;
        const logged = await logSet(client, se.data.id, {
          setNumber: set.setNumber,
          reps: set.reps ?? undefined,
          weightKg: set.weightKg ?? undefined,
          durationS: set.durationS ?? undefined,
          rpe: set.rpe ?? undefined,
          completedAt,
        });
        if (logged.ok) report.setsWritten += 1;
      }
    }
    await endSession(client, started.data.id, { endedAt: session.endedAt ?? lastSetAt });
    report.imported += 1;
  }
  return ok(report);
}
