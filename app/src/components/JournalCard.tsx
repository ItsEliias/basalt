import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';
import { Card, ReceiptHeader, ReceiptRow, SrcNote, mono, useTheme, ScaledText as Text } from '@basalt/ui';
import { checkCrisis } from '@basalt/core-data';
import {
  JOURNAL_CLOUD_WARNING, addJournalEntry, isJournalCloudOn, listJournalEntries,
  setJournalCloud, shareJournalPdf, type JournalEntry,
} from '../lib/journalStore';
import { supabase } from '../lib/supabase';
import { CrisisSheet } from './CrisisSheet';
import { ExtraSlot } from './ExtrasProvider';

// Journal (journal Extra) — free writing, this phone only by default.
// Every save runs the crisis detector FIRST; a hit shows the crisis
// screen and the entry still saves. AI touches an entry only when the
// coach Extra is on AND the user taps ask — never otherwise.

export function JournalCard() {
  const { theme } = useTheme();
  const [draft, setDraft] = useState('');
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [cloud, setCloud] = useState(false);
  const [crisisOpen, setCrisisOpen] = useState(false);
  const [coachReply, setCoachReply] = useState<string | null>(null);

  const refresh = useCallback(() => {
    void listJournalEntries(5).then(setEntries);
    void isJournalCloudOn().then(setCloud);
  }, []);
  useEffect(refresh, [refresh]);

  const save = async () => {
    const text = draft.trim();
    if (!text) return;
    // Crisis first, always — and the entry still saves either way.
    if (checkCrisis(text)) setCrisisOpen(true);
    await addJournalEntry(text);
    setDraft('');
    refresh();
  };

  const askCoach = async (entry: JournalEntry) => {
    if (checkCrisis(entry.text)) {
      setCrisisOpen(true);
      return;
    }
    const { data, error } = await supabase.functions.invoke('pebble-coach', {
      body: {
        question: `Reflect factually, in 2-3 sentences, on this journal entry of mine: "${entry.text.slice(0, 400)}"`,
        numbers: {},
      },
    });
    setCoachReply(error ? `The coach could not answer: ${error.message}.` : String(data?.answer ?? data?.error ?? 'no reply'));
  };

  return (
    <Card>
      <ReceiptHeader label="Journal" summary={cloud ? 'this phone + private cloud copy' : 'this phone only'} />
      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder="Write freely — this is a journal, not a form"
        placeholderTextColor={theme.text.faint}
        multiline
        style={[styles.input, { color: theme.text.ink, borderColor: theme.surfaces.border }]}
        accessibilityLabel="Journal entry"
      />
      <Pressable onPress={() => void save()} hitSlop={8} accessibilityRole="button">
        <Text style={[styles.saveBtn, { color: theme.text.carbs }]}>SAVE ENTRY</Text>
      </Pressable>
      {entries.map((e) => (
        <View key={e.id} style={styles.entry}>
          <Text style={[styles.entryDay, { color: theme.text.faint }]}>{e.day.toUpperCase()}</Text>
          <Text style={[styles.entryText, { color: theme.text.ink2 }]} numberOfLines={4}>{e.text}</Text>
          <ExtraSlot id="coach">
            <Pressable onPress={() => void askCoach(e)} hitSlop={8} accessibilityRole="button">
              <Text style={[styles.askCoach, { color: theme.text.faint }]}>ASK THE COACH ABOUT THIS →</Text>
            </Pressable>
          </ExtraSlot>
        </View>
      ))}
      {coachReply ? (
        <View style={styles.coachReply}>
          <Text style={[styles.entryDay, { color: theme.text.faint }]}>COACH — ONLY BECAUSE YOU ASKED</Text>
          <Text style={[styles.entryText, { color: theme.text.ink2 }]}>{coachReply}</Text>
        </View>
      ) : null}
      <ReceiptRow
        name="Cloud sync"
        meta={JOURNAL_CLOUD_WARNING}
        right={
          <Switch
            value={cloud}
            onValueChange={(v) => {
              void setJournalCloud(v).then(refresh);
            }}
            trackColor={{ false: theme.surfaces.surface2, true: theme.fill.carbs }}
            thumbColor={theme.text.ink}
            accessibilityLabel="Cloud sync for the journal"
          />
        }
      />
      <Pressable
        onPress={() => void shareJournalPdf().catch(() => Alert.alert('Export failed', 'Could not build the PDF.'))}
        hitSlop={8}
        accessibilityRole="button"
      >
        <Text style={[styles.export, { color: theme.text.faint }]}>DOCTOR EXPORT — 90 DAYS AS PDF →</Text>
      </Pressable>
      <SrcNote>Never read by any engine, never in any score · AI sees an entry only when you tap ask, with the coach Extra on</SrcNote>
      <CrisisSheet open={crisisOpen} onClose={() => setCrisisOpen(false)} />
    </Card>
  );
}

const styles = StyleSheet.create({
  input: { borderBottomWidth: 1, paddingVertical: 8, fontSize: 13.5, minHeight: 64, textAlignVertical: 'top' },
  saveBtn: { fontFamily: mono, fontSize: 12, letterSpacing: 1, textAlign: 'center', paddingVertical: 12 },
  entry: { marginTop: 6, marginBottom: 4, gap: 3 },
  entryDay: { fontFamily: mono, fontSize: 10.5, letterSpacing: 0.8 },
  entryText: { fontSize: 13, lineHeight: 19 },
  askCoach: { fontFamily: mono, fontSize: 10.5, letterSpacing: 0.8, paddingVertical: 8 },
  coachReply: { marginTop: 6, gap: 3 },
  export: { fontFamily: mono, fontSize: 10.5, letterSpacing: 0.8, textAlign: 'center', paddingVertical: 10 },
});
