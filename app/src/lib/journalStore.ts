import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { currentUserId, isoDay } from '@basalt/core-data';
import { supabase } from './supabase';

// Journal (journal Extra) — local-first, exactly like progress photos:
// entries live on this phone unless the separate cloud switch is on.
// Nothing here is read by any engine; the only AI path is the user
// explicitly tapping "ask the coach" on one entry, and the crisis gate
// runs before that ever leaves the device.

export const JOURNAL_LOCAL_KEY = 'basalt.journal.local';
export const JOURNAL_CLOUD_KEY = 'basalt.journal.cloud';

export const JOURNAL_CLOUD_WARNING =
  'On: new entries also save to Basalt’s private storage, tied to your account and wiped with it. '
  + 'Off: every entry stays on this phone only. Entries written before the flip stay where they were written.';

export type JournalEntry = { id: string; day: string; text: string; createdAt: string };

function parseLocal(raw: string | null): JournalEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((e) => e && e.id && typeof e.text === 'string') : [];
  } catch {
    return [];
  }
}

export async function isJournalCloudOn(): Promise<boolean> {
  return (await AsyncStorage.getItem(JOURNAL_CLOUD_KEY)) === 'on';
}

export async function setJournalCloud(on: boolean): Promise<void> {
  await AsyncStorage.setItem(JOURNAL_CLOUD_KEY, on ? 'on' : 'off');
}

export async function addJournalEntry(text: string): Promise<JournalEntry> {
  const entry: JournalEntry = {
    id: `${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    day: isoDay(new Date()),
    text,
    createdAt: new Date().toISOString(),
  };
  const local = parseLocal(await AsyncStorage.getItem(JOURNAL_LOCAL_KEY));
  local.push(entry);
  await AsyncStorage.setItem(JOURNAL_LOCAL_KEY, JSON.stringify(local));
  if (await isJournalCloudOn()) {
    const u = await currentUserId(supabase);
    if (u.ok) {
      // Best-effort: a failed upload never loses the local copy.
      await supabase.from('basalt_journal_entries')
        .insert({ user_id: u.data, day: entry.day, text: entry.text })
        .then(() => {}, () => {});
    }
  }
  return entry;
}

/** Newest first: device entries always; cloud-only rows when the switch is on. */
export async function listJournalEntries(limit = 30): Promise<JournalEntry[]> {
  const local = parseLocal(await AsyncStorage.getItem(JOURNAL_LOCAL_KEY));
  let cloud: JournalEntry[] = [];
  if (await isJournalCloudOn()) {
    const u = await currentUserId(supabase);
    if (u.ok) {
      const { data } = await supabase
        .from('basalt_journal_entries')
        .select('id, day, text, created_at')
        .eq('user_id', u.data)
        .order('created_at', { ascending: false })
        .limit(limit);
      cloud = (data ?? []).map((r: any) => ({ id: r.id, day: r.day, text: r.text, createdAt: r.created_at }));
    }
  }
  const seenMinute = new Set(local.map((e) => `${e.day}:${e.text.slice(0, 40)}`));
  const merged = [...local, ...cloud.filter((e) => !seenMinute.has(`${e.day}:${e.text.slice(0, 40)}`))];
  return merged.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

/** 90 days of entries as a printable PDF, shared via the system sheet. */
export async function shareJournalPdf(): Promise<void> {
  const entries = await listJournalEntries(500);
  const cutoff = isoDay(new Date(Date.now() - 90 * 86_400_000));
  const recent = entries.filter((e) => e.day >= cutoff);
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const body = recent.length > 0
    ? recent
        .map((e) => `<section><h2>${esc(e.day)}</h2><p>${esc(e.text).replace(/\n/g, '<br/>')}</p></section>`)
        .join('')
    : '<p class="nodata">No entries in the last 90 days.</p>';
  const html = `<style>
  body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: #111; margin: 32px; font-size: 13px; line-height: 1.5; }
  h1 { font-size: 20px; margin-bottom: 2px; }
  .sub { color: #666; font-size: 11px; margin-bottom: 20px; }
  h2 { font-size: 13px; border-bottom: 1px solid #ccc; padding-bottom: 3px; margin: 18px 0 6px; }
  .nodata { color: #999; font-style: italic; }
</style>
<h1>Journal — last 90 days</h1>
<p class="sub">Written by the patient in their own words. Exported from Basalt only by their own action.</p>
${body}`;
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
}
