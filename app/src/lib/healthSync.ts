import { healthService, syncHealthData, type SyncReport } from '@basalt/health-connect';
import { supabase } from './supabase';

// App-side sync runner: at most one pass per THROTTLE_MS unless forced.
// Fire-and-forget from screens; the engine itself is idempotent.

const THROTTLE_MS = 15 * 60 * 1000;
let lastRun = 0;
let inFlight: Promise<SyncReport | null> | null = null;

export function runHealthSync(options: { force?: boolean } = {}): Promise<SyncReport | null> {
  const now = Date.now();
  if (inFlight) return inFlight;
  if (!options.force && now - lastRun < THROTTLE_MS) return Promise.resolve(null);
  lastRun = now;
  inFlight = syncHealthData(supabase, healthService, { days: 7 })
    .then((r) => (r.ok ? r.data : null))
    .catch(() => null)
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}
