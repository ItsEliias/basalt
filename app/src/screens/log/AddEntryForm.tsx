import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, mono, CTA, ObInput, ObChipLabel, ChipRow, SrcNote } from '@basalt/ui';
import type { FoodEntryInput, MealType } from '@basalt/nutrition';

// Editable-before-save — the AI rule generalized: capture → editable
// suggestion → confirm. Barcode results, search hits and manual adds all
// pass through here; nothing auto-commits.

const MEALS: { key: MealType; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snacks', label: 'Snacks' },
];

export type DraftEntry = FoodEntryInput & { conflictNote?: string | null; sourceNote?: string };

export function AddEntryForm({
  draft, onCancel, onSave,
}: {
  draft: DraftEntry | null;
  onCancel: () => void;
  onSave: (entry: FoodEntryInput) => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<DraftEntry | null>(draft);
  const [busy, setBusy] = useState(false);

  useEffect(() => setState(draft), [draft]);

  if (!state) return null;

  const patchNum = (key: keyof FoodEntryInput) => (text: string) => {
    const n = parseFloat(text.replace(',', '.'));
    setState((s) => (s ? { ...s, [key]: isFinite(n) ? n : 0 } : s));
  };
  const numText = (v: number | undefined) => (v === undefined || v === 0 ? '' : String(v));

  return (
    <Modal visible={draft !== null} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.dim} onPress={onCancel} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.sheet, { paddingBottom: 16 + insets.bottom }]}>
          <View style={styles.grab} />
          <ScrollView style={{ maxHeight: 460 }} keyboardShouldPersistTaps="handled">
            <ObInput
              placeholder="Food name"
              value={state.foodName}
              onChangeText={(foodName) => setState((s) => (s ? { ...s, foodName } : s))}
            />
            <ObInput
              placeholder="Brand (optional)"
              value={state.brand ?? ''}
              onChangeText={(brand) => setState((s) => (s ? { ...s, brand: brand || undefined } : s))}
            />
            <ObChipLabel>Meal</ObChipLabel>
            <ChipRow
              options={MEALS.map((m) => m.label)}
              value={MEALS.find((m) => m.key === state.mealType)?.label}
              onChange={(label) =>
                setState((s) => (s ? { ...s, mealType: MEALS.find((m) => m.label === label)!.key } : s))
              }
            />
            <ObChipLabel>Energy & macros — per serving</ObChipLabel>
            <View style={styles.row}>
              <Field label="kcal" value={numText(state.calories)} onChange={patchNum('calories')} />
              <Field label="Protein g" value={numText(state.protein)} onChange={patchNum('protein')} />
            </View>
            <View style={styles.row}>
              <Field label="Carbs g" value={numText(state.carbs)} onChange={patchNum('carbs')} />
              <Field label="Fat g" value={numText(state.fat)} onChange={patchNum('fat')} />
            </View>
            <View style={styles.row}>
              <Field label="Fibre g" value={numText(state.fiber)} onChange={patchNum('fiber')} />
              <Field label="Sugar g" value={numText(state.sugar)} onChange={patchNum('sugar')} />
            </View>
            <View style={styles.row}>
              <Field label="Sodium mg" value={numText(state.sodiumMg)} onChange={patchNum('sodiumMg')} />
              <Field label="Serves" value={numText(state.quantity ?? 1)} onChange={patchNum('quantity')} />
            </View>
            {state.conflictNote ? <Text style={styles.conflict}>{state.conflictNote.toUpperCase()}</Text> : null}
            {state.sourceNote ? <SrcNote>{state.sourceNote}</SrcNote> : null}
          </ScrollView>
          <CTA
            label={busy ? '…' : 'Log it'}
            disabled={busy || !state.foodName.trim()}
            onPress={async () => {
              setBusy(true);
              const { conflictNote: _c, sourceNote: _s, ...entry } = state;
              await onSave(entry);
              setBusy(false);
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (t: string) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label.toUpperCase()}</Text>
      <ObInput keyboardType="decimal-pad" value={value} onChangeText={onChange} placeholder="0" style={styles.fieldInput} />
    </View>
  );
}

const styles = StyleSheet.create({
  dim: { flex: 1, backgroundColor: 'rgba(5,6,8,.6)' },
  sheet: {
    backgroundColor: color.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border2,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  grab: { width: 34, height: 3, borderRadius: 2, backgroundColor: color.border2, alignSelf: 'center', marginTop: 4, marginBottom: 10 },
  row: { flexDirection: 'row', gap: 10 },
  field: { flex: 1 },
  fieldLabel: { fontFamily: mono, fontSize: 9, letterSpacing: 0.9, color: color.faint, marginTop: 12, marginBottom: -4 },
  fieldInput: { marginTop: 8 },
  conflict: {
    fontFamily: mono, fontSize: 9.5, letterSpacing: 0.38, color: color.fat,
    lineHeight: 15, marginTop: 12,
  },
});
