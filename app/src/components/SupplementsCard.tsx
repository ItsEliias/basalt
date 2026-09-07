import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Card, ReceiptHeader, SrcNote, mono, useTheme, ScaledText as Text } from '@basalt/ui';
import { isoDay } from '@basalt/core-data';
import {
  SUPPLEMENTS_LAW, addSupplement, archiveSupplement, checksForDay,
  listSupplements, setChecked, type Supplement,
} from '@basalt/nutrition';
import { supabase } from '../lib/supabase';
import {
  SUPPLEMENT_REMINDER_HOURS, getSupplementsReminderHour, setSupplementsReminderHour,
} from '../lib/supplementsReminder';

// Supplements checklist (supplements Extra) — rendered only inside its
// ExtraSlot on Today. The user's list, ticked per day; long-press a row
// to remove it. No products suggested, no doses proposed — the law is
// printed on the card.

export function SupplementsCard() {
  const { theme } = useTheme();
  const [items, setItems] = useState<Supplement[]>([]);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [reminderHour, setReminderHour] = useState<number | null>(null);
  const today = isoDay(new Date());

  useEffect(() => {
    void getSupplementsReminderHour().then(setReminderHour);
  }, []);

  const pickReminder = async (hour: number | null) => {
    const r = await setSupplementsReminderHour(hour);
    if (!r.ok) {
      Alert.alert('Reminder not scheduled', r.reason ?? 'Could not schedule.');
      return;
    }
    setReminderHour(hour);
  };

  const load = useCallback(() => {
    void (async () => {
      const [list, checks] = await Promise.all([
        listSupplements(supabase),
        checksForDay(supabase, today),
      ]);
      if (list.ok) setItems(list.data);
      if (checks.ok) setTicked(checks.data);
      setLoaded(true);
    })();
  }, [today]);
  useEffect(load, [load]);

  const toggle = async (id: string) => {
    const on = !ticked.has(id);
    const next = new Set(ticked);
    if (on) next.add(id);
    else next.delete(id);
    setTicked(next);
    const r = await setChecked(supabase, id, today, on);
    if (!r.ok) load();
  };

  const add = async () => {
    const r = await addSupplement(supabase, adding);
    if (!r.ok) {
      if (adding.trim()) Alert.alert('Not added', r.error);
      return;
    }
    setAdding('');
    setItems((xs) => [...xs, r.data]);
  };

  const remove = (s: Supplement) => {
    Alert.alert('Remove from the list?', `${s.name} — past ticks stay in your ledger.`, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void archiveSupplement(supabase, s.id).then(() => load());
        },
      },
    ]);
  };

  if (!loaded) return null;

  return (
    <Card>
      <ReceiptHeader
        label="Supplements"
        summary={items.length > 0 ? `${[...ticked].filter((id) => items.some((s) => s.id === id)).length} / ${items.length} today` : undefined}
      />
      {items.map((s) => {
        const on = ticked.has(s.id);
        return (
          <Pressable
            key={s.id}
            onPress={() => void toggle(s.id)}
            onLongPress={() => remove(s)}
            hitSlop={8}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            style={styles.row}
          >
            <Text style={[styles.tick, { color: on ? theme.text.carbs : theme.text.faint }]}>
              {on ? '[x]' : '[ ]'}
            </Text>
            <View style={styles.rowBody}>
              <Text style={[styles.name, { color: theme.text.ink2 }]}>{s.name}</Text>
              {s.doseNote ? (
                <Text style={[styles.dose, { color: theme.text.faint }]}>{s.doseNote}</Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
      <View style={styles.addRow}>
        <TextInput
          value={adding}
          onChangeText={setAdding}
          placeholder="Add one — your words"
          placeholderTextColor={theme.text.faint}
          style={[styles.input, { color: theme.text.ink, borderColor: theme.surfaces.border }]}
          onSubmitEditing={() => void add()}
          returnKeyType="done"
          accessibilityLabel="Add a supplement"
        />
        <Pressable onPress={() => void add()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Add">
          <Text style={[styles.addBtn, { color: theme.text.carbs }]}>ADD</Text>
        </Pressable>
      </View>
      <View style={styles.reminderRow}>
        <Text style={[styles.reminderLabel, { color: theme.text.faint }]}>REMINDER</Text>
        {([null, ...SUPPLEMENT_REMINDER_HOURS] as (number | null)[]).map((hour) => {
          const on = reminderHour === hour;
          return (
            <Pressable
              key={String(hour)}
              onPress={() => void pickReminder(hour)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={hour === null ? 'Reminder off' : `Reminder at ${hour}:00`}
            >
              <Text style={[styles.reminderChip, { color: on ? theme.text.carbs : theme.text.faint }]}>
                {hour === null ? 'off' : `${String(hour).padStart(2, '0')}:00`}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <SrcNote>{SUPPLEMENTS_LAW} Long-press a row to remove it.</SrcNote>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10, minHeight: 44 },
  tick: { fontFamily: mono, fontSize: 13, marginTop: 1 },
  rowBody: { flex: 1 },
  name: { fontSize: 14 },
  dose: { fontSize: 11.5, marginTop: 2 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6, marginBottom: 8 },
  input: { flex: 1, borderBottomWidth: 1, paddingVertical: 8, fontSize: 13.5 },
  addBtn: { fontFamily: mono, fontSize: 12.5, letterSpacing: 1, paddingVertical: 12 },
  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 8, minHeight: 40 },
  reminderLabel: { fontFamily: mono, fontSize: 11, letterSpacing: 1.1 },
  reminderChip: { fontFamily: mono, fontSize: 12.5, paddingVertical: 10 },
});
