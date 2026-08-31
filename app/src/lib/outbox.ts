import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { addWeightEntry } from '@basalt/core-data';
import { addFoodEntry, addWater, type FoodEntryInput } from '@basalt/nutrition';
import { saveCheckin, type Checkin } from '@basalt/analytics';
import { supabase } from './supabase';
import {
  parseOutbox, serializeOutbox, enqueue, ack, markFailed, drainable, outboxId,
  isNetworkError, type OutboxIntent, type PendingWrite,
} from './outboxModel';

// Offline outbox — durable storage + replay. Enqueued intents replay
// through the SAME service functions a live call uses, on app start, on
// foregrounding, and on a quiet interval. The Settings line shows the
// pending count; nothing blocks, nothing pops up.

const KEY = 'basalt:outbox:v1';
const DRAIN_INTERVAL_MS = 60_000;

let listeners: ((count: number) => void)[] = [];
let draining = false;

async function load(): Promise<PendingWrite[]> {
  return parseOutbox(await AsyncStorage.getItem(KEY));
}

async function persist(entries: PendingWrite[]): Promise<void> {
  await AsyncStorage.setItem(KEY, serializeOutbox(entries));
  listeners.forEach((l) => l(entries.length));
}

export function onOutboxChange(listener: (count: number) => void): () => void {
  listeners.push(listener);
  void load().then((e) => listener(e.length));
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export async function outboxCount(): Promise<number> {
  return (await load()).length;
}

export async function enqueueIntent(intent: OutboxIntent): Promise<void> {
  const entries = await load();
  await persist(enqueue(entries, intent, new Date().toISOString(), outboxId()));
}

/** Replay one intent through its service function. ok=true removes it. */
async function replay(intent: OutboxIntent): Promise<{ ok: boolean; error?: string }> {
  switch (intent.kind) {
    case 'food_entry': {
      const r = await addFoodEntry(supabase, intent.input as FoodEntryInput, intent.date ? { date: intent.date } : {});
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    }
    case 'water': {
      const r = await addWater(supabase, intent.ml, intent.date, intent.ts);
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    }
    case 'weight': {
      const r = await addWeightEntry(supabase, intent.weightKg, {
        measuredAt: intent.measuredAt,
        source: intent.source,
      });
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    }
    case 'checkin': {
      const r = await saveCheckin(supabase, intent.checkin as Checkin);
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    }
    case 'mindfulness': {
      const { error } = await supabase.from('basalt_mindfulness_sessions').insert(intent.row as never);
      return error ? { ok: false, error: error.message } : { ok: true };
    }
  }
}

/** One drain pass — sequential, oldest first, stops early while offline. */
export async function drainOutbox(): Promise<{ drained: number; remaining: number }> {
  if (draining) return { drained: 0, remaining: await outboxCount() };
  draining = true;
  let drained = 0;
  try {
    let entries = await load();
    for (const entry of drainable(entries)) {
      const result = await replay(entry.intent);
      if (result.ok) {
        entries = ack(entries, entry.id);
        drained += 1;
      } else {
        entries = markFailed(entries, entry.id);
        // Still offline? Stop burning attempts on the rest this pass.
        if (result.error && isNetworkError(result.error)) break;
      }
    }
    await persist(entries);
    return { drained, remaining: entries.length };
  } finally {
    draining = false;
  }
}

/**
 * Write-through with offline fallback: run the live service call; if it
 * fails looking like a network problem, queue the intent and report
 * `queued`. Real errors (validation, RLS, auth) pass through untouched —
 * queueing those would hide them.
 */
export async function writeThroughOutbox<T>(
  exec: () => Promise<{ ok: true; data: T } | { ok: false; error: string }>,
  intent: OutboxIntent,
): Promise<{ ok: true; data: T } | { ok: false; error: string } | { ok: true; queued: true }> {
  try {
    const r = await exec();
    if (r.ok) return r;
    if (isNetworkError(r.error)) {
      await enqueueIntent(intent);
      return { ok: true, queued: true };
    }
    return r;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (isNetworkError(message)) {
      await enqueueIntent(intent);
      return { ok: true, queued: true };
    }
    return { ok: false, error: message };
  }
}

let wired = false;
/** Call once at app start: drains now, on foregrounding, and on interval. */
export function wireOutboxDraining(): void {
  if (wired) return;
  wired = true;
  void drainOutbox();
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void drainOutbox();
  });
  setInterval(() => void drainOutbox(), DRAIN_INTERVAL_MS);
}
