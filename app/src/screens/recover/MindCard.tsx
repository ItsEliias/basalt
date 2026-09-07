import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Card, ChipGroup, ReceiptHeader, SrcNote, mono, useTheme, ScaledText as Text } from '@basalt/ui';
import {
  CHECKIN_FACTORS, SCALE_WORDS, getCheckin, listCheckins, saveCheckin, stripChars, type Checkin,
} from '@basalt/analytics';
import { checkCrisis, isoDay } from '@basalt/core-data';
import { supabase } from '../../lib/supabase';
import { writeThroughOutbox } from '../../lib/outbox';
import { CrisisSheet } from '../../components/CrisisSheet';

// Mind (V4 Phase 7, core — Recover's third section). The daily check-in:
// mood / energy / stress as words (never faces), the evening facts, an
// optional note, and the 30-day strip. The note runs through the crisis
// detector BEFORE anything else; a hit shows the crisis screen and the
// note still saves.

const SCALES = [
  { key: 'mood' as const, label: 'Mood' },
  { key: 'energy' as const, label: 'Energy' },
  { key: 'stress' as const, label: 'Stress' },
];

const empty = (date: string): Checkin => ({ date, factors: [], mood: null, energy: null, stress: null, note: null });

export function MindCard() {
  const { theme } = useTheme();
  const today = isoDay(new Date());
  const [checkin, setCheckin] = useState<Checkin>(empty(today));
  const [saved, setSaved] = useState(false);
  const [history, setHistory] = useState<Checkin[]>([]);
  const [noteDraft, setNoteDraft] = useState('');
  const [crisisOpen, setCrisisOpen] = useState(false);

  const load = useCallback(() => {
    void getCheckin(supabase, today).then((r) => {
      if (r.ok && r.data) {
        setCheckin(r.data);
        setNoteDraft(r.data.note ?? '');
        setSaved(true);
      }
    });
    void listCheckins(supabase, 30).then((r) => r.ok && setHistory(r.data));
  }, [today]);
  useEffect(load, [load]);

  const persist = (next: Checkin) => {
    setCheckin(next);
    setSaved(true);
    void writeThroughOutbox(
      () => saveCheckin(supabase, next).then((r) => (r.ok ? { ok: true as const, data: undefined } : r)),
      { kind: 'checkin', checkin: next },
    ).then(() => void listCheckins(supabase, 30).then((r) => r.ok && setHistory(r.data)));
  };

  const saveNote = () => {
    const note = noteDraft.trim() || null;
    // The crisis check runs FIRST, always — no Extra, no setting touches it.
    if (note && checkCrisis(note)) setCrisisOpen(true);
    persist({ ...checkin, note });
  };

  return (
    <Card>
      <ReceiptHeader label="Mind" summary={saved ? 'saved for today' : undefined} />
      {SCALES.map((scale) => (
        <View key={scale.key} style={styles.scaleRow}>
          <Text style={[styles.scaleLabel, { color: theme.text.mute }]}>{scale.label.toUpperCase()}</Text>
          <View style={styles.words}>
            {SCALE_WORDS.map((word, i) => {
              const on = checkin[scale.key] === i + 1;
              return (
                <Pressable
                  key={word}
                  onPress={() => persist({ ...checkin, [scale.key]: on ? null : i + 1 })}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`${scale.label} ${word}`}
                >
                  <Text style={[styles.word, { color: on ? theme.text.carbs : theme.text.faint }]}>{word}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
      <ChipGroup
        options={CHECKIN_FACTORS.map((f) => f.label)}
        values={checkin.factors.map((k) => CHECKIN_FACTORS.find((f) => f.key === k)?.label ?? k)}
        onToggle={(label) => {
          const key = CHECKIN_FACTORS.find((f) => f.label === label)?.key;
          if (!key) return;
          const factors = checkin.factors.includes(key)
            ? checkin.factors.filter((k) => k !== key)
            : [...checkin.factors, key];
          persist({ ...checkin, factors });
        }}
      />
      <View style={styles.noteRow}>
        <TextInput
          value={noteDraft}
          onChangeText={setNoteDraft}
          placeholder="A line about today, if you want one"
          placeholderTextColor={theme.text.faint}
          style={[styles.noteInput, { color: theme.text.ink, borderColor: theme.surfaces.border }]}
          onSubmitEditing={saveNote}
          onBlur={saveNote}
          returnKeyType="done"
          accessibilityLabel="Check-in note"
        />
      </View>
      {history.length > 0 ? (
        <View style={styles.stripBlock}>
          {SCALES.map((scale) => (
            <View key={scale.key} style={styles.stripRow}>
              <Text style={[styles.stripLabel, { color: theme.text.faint }]}>{scale.label[0]}</Text>
              <Text style={[styles.strip, { color: theme.text.mute }]}>
                {stripChars(history, scale.key, 30, today)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      <SrcNote>
        Words, not faces · one row per day, 30 days above · feeds Trends' correlations through the same gates (|r| ≥ 0.45, 30+ days) · never scored, never judged, never diagnosed
      </SrcNote>
      <CrisisSheet open={crisisOpen} onClose={() => setCrisisOpen(false)} />
    </Card>
  );
}

const styles = StyleSheet.create({
  scaleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 42 },
  scaleLabel: { fontFamily: mono, fontSize: 10.5, letterSpacing: 1, width: 58 },
  words: { flexDirection: 'row', gap: 14, flexWrap: 'wrap', flex: 1 },
  word: { fontFamily: mono, fontSize: 12.5, paddingVertical: 10 },
  noteRow: { marginTop: 4, marginBottom: 6 },
  noteInput: { borderBottomWidth: 1, paddingVertical: 8, fontSize: 13.5 },
  stripBlock: { marginTop: 8, marginBottom: 6, gap: 3 },
  stripRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stripLabel: { fontFamily: mono, fontSize: 10.5, width: 12 },
  strip: { fontFamily: mono, fontSize: 11, letterSpacing: 2 },
});
