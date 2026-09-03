import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, EmptyState, SrcNote, ReceiptHeader, CTA, Chip, ObInput, ObChipLabel, mono, useTheme, ScaledText as Text } from '@basalt/ui';
import { saveTemplate, type TemplateLocation } from '@basalt/training';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../state/appStore';
import { equipmentTokens } from './model';
import { ExercisePicker } from './TrainScreen';

// Template builder — a plain in-place screen (not a native Modal) so the
// nested ExercisePicker Modal it opens is never a Modal-inside-Modal, which
// is unreliable on some Android builds. Targets are the user's own typed
// plan; they're never pre-computed or guessed.

type DraftExercise = {
  exerciseId: string | null;
  exerciseName: string;
  targetSets: number;
  targetReps: number | null;
  targetWeightKg: number | null;
};

export function TemplateBuilder({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const profile = useAppStore((s) => s.profile);
  const [name, setName] = useState('');
  const [location, setLocation] = useState<TemplateLocation>('gym');
  const [exercises, setExercises] = useState<DraftExercise[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const updateExercise = (i: number, patch: Partial<DraftExercise>) =>
    setExercises((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));

  const save = async () => {
    if (!name.trim() || exercises.length === 0) return;
    setSaving(true);
    const r = await saveTemplate(supabase, {
      name: name.trim(),
      location,
      exercises: exercises.map((e) => ({
        exerciseId: e.exerciseId,
        exerciseName: e.exerciseName,
        targetSets: e.targetSets,
        targetReps: e.targetReps,
        targetWeightKg: e.targetWeightKg,
      })),
    });
    setSaving(false);
    if (r.ok) onSaved();
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.surfaces.bg, paddingTop: insets.top + 12 }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <View style={styles.head}>
          <Text style={[styles.title, { color: theme.text.ink }]}>New template</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={[styles.close, { color: theme.text.faint }]}>CLOSE</Text>
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          <ObChipLabel>Name</ObChipLabel>
          <ObInput placeholder="Pull — Week 1" value={name} onChangeText={setName} />

          <ObChipLabel>Where</ObChipLabel>
          <View style={styles.locRow}>
            <Chip label="Gym" on={location === 'gym'} onPress={() => setLocation('gym')} />
            <Chip label="Home" on={location === 'home'} onPress={() => setLocation('home')} />
          </View>

          <Card>
            <ReceiptHeader label="Exercises" summary={exercises.length > 0 ? `${exercises.length} added` : undefined} />
            {exercises.length === 0 ? (
              <EmptyState>No exercises yet — add the first one below.</EmptyState>
            ) : (
              exercises.map((e, i) => (
                <View key={`${e.exerciseId ?? e.exerciseName}-${i}`} style={[styles.exRow, { borderBottomColor: theme.surfaces.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.exName, { color: theme.text.ink }]}>{e.exerciseName}</Text>
                    <View style={styles.targetRow}>
                      <NumField label="Sets" value={e.targetSets} onChange={(v) => updateExercise(i, { targetSets: Math.max(1, v) })} />
                      <NumField label="Reps" value={e.targetReps ?? 0} onChange={(v) => updateExercise(i, { targetReps: v || null })} />
                      <NumField label="kg" value={e.targetWeightKg ?? 0} onChange={(v) => updateExercise(i, { targetWeightKg: v || null })} />
                    </View>
                  </View>
                  <Pressable onPress={() => setExercises((prev) => prev.filter((_, idx) => idx !== i))} hitSlop={10}>
                    <Text style={[styles.remove, { color: theme.text.faint }]}>REMOVE</Text>
                  </Pressable>
                </View>
              ))
            )}
            <Pressable onPress={() => setPickerOpen(true)}>
              <Text style={[styles.addExercise, { color: theme.text.mute }]}>+ ADD EXERCISE</Text>
            </Pressable>
          </Card>

          <CTA
            label={saving ? '…' : 'Save template'}
            disabled={saving || !name.trim() || exercises.length === 0}
            onPress={() => void save()}
          />
          <SrcNote>Targets are your own plan — shown as ghost hints when you start a session from this template, never invented</SrcNote>
        </View>
      </ScrollView>

      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        myEquipment={equipmentTokens(profile?.equipment ?? [])}
        hasEquipmentProfile={(profile?.equipment ?? []).length > 0 && profile?.trainLocation !== 'gym'}
        onPick={(exercise) => {
          setPickerOpen(false);
          setExercises((prev) => [
            ...prev,
            { exerciseId: exercise.id, exerciseName: exercise.name, targetSets: 3, targetReps: null, targetWeightKg: null },
          ]);
        }}
      />
    </View>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text style={[styles.numLabel, { color: theme.text.faint }]}>{label.toUpperCase()}</Text>
      <ObInput
        keyboardType="decimal-pad"
        value={value ? String(value) : ''}
        onChangeText={(t) => {
          const n = parseFloat(t.replace(',', '.'));
          onChange(isFinite(n) ? n : 0);
        }}
        placeholder="0"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 16 },
  title: { fontSize: 21, fontWeight: '650' as any, letterSpacing: -0.21 },
  close: { fontFamily: mono, fontSize: 11, letterSpacing: 1.2 },
  locRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  exRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  exName: { fontSize: 14, marginBottom: 6 },
  targetRow: { flexDirection: 'row', gap: 8 },
  numLabel: { fontFamily: mono, fontSize: 11, letterSpacing: 0.9, marginTop: 8, marginBottom: -4 },
  remove: { fontFamily: mono, fontSize: 11, letterSpacing: 0.85, paddingTop: 4 },
  addExercise: { fontFamily: mono, fontSize: 11, letterSpacing: 1.2, paddingVertical: 12, textAlign: 'center' },
});
