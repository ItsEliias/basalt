import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, mono, CTA, ObInput, ObChipLabel, ChipRow, SrcNote, ScaledText as Text } from '@basalt/ui';
import { Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
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

export type DraftEntry = FoodEntryInput & {
  conflictNote?: string | null;
  sourceNote?: string;
  /** JPEG base64 waiting to upload on save — private bucket, private by default. */
  pendingPhotoB64?: string | null;
};

export function AddEntryForm({
  draft, onCancel, onSave, onAddToTray, trayCalories = 0, trayCount = 0,
}: {
  draft: DraftEntry | null;
  onCancel: () => void;
  onSave: (entry: FoodEntryInput, photoB64: string | null) => Promise<void>;
  /** The Tray lane: stash the entry, clear the search, keep logging. */
  onAddToTray?: (entry: FoodEntryInput, photoB64: string | null) => void;
  trayCalories?: number;
  trayCount?: number;
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

  const pickPhoto = async (from: 'camera' | 'gallery') => {
    const opts = { quality: 0.55, base64: true, allowsEditing: false } as const;
    const result =
      from === 'camera'
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);
    const b64 = result.assets?.[0]?.base64;
    if (!result.canceled && b64) {
      setState((s) => (s ? { ...s, pendingPhotoB64: b64 } : s));
    }
  };

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
            <ObChipLabel>Photo — private, optional</ObChipLabel>
            <View style={styles.photoRow}>
              {state.pendingPhotoB64 ? (
                <Image
                  source={{ uri: `data:image/jpeg;base64,${state.pendingPhotoB64}` }}
                  style={styles.photoThumb}
                />
              ) : null}
              <Pressable onPress={() => void pickPhoto('camera')}>
                <Text style={styles.photoAction}>CAMERA</Text>
              </Pressable>
              <Pressable onPress={() => void pickPhoto('gallery')}>
                <Text style={styles.photoAction}>GALLERY</Text>
              </Pressable>
              {state.pendingPhotoB64 ? (
                <Pressable onPress={() => setState((s) => (s ? { ...s, pendingPhotoB64: null } : s))}>
                  <Text style={styles.photoAction}>REMOVE</Text>
                </Pressable>
              ) : null}
            </View>
            {state.conflictNote ? <Text style={styles.conflict}>{state.conflictNote.toUpperCase()}</Text> : null}
            {state.sourceNote ? <SrcNote>{state.sourceNote}</SrcNote> : null}
            {/* Live-total keypad: the tray total updates as you type. */}
            {onAddToTray && trayCount > 0 ? (
              <Text style={styles.trayLive}>
                {`TRAY AFTER ADD · ${trayCount + 1} ITEMS · ${Math.round(trayCalories + (state.calories || 0)).toLocaleString('en-US')} KCAL`}
              </Text>
            ) : null}
          </ScrollView>
          <CTA
            label={busy ? '…' : 'Log it'}
            disabled={busy || !state.foodName.trim()}
            onPress={async () => {
              setBusy(true);
              const { conflictNote: _c, sourceNote: _s, pendingPhotoB64, ...entry } = state;
              await onSave(entry, pendingPhotoB64 ?? null);
              setBusy(false);
            }}
          />
          {onAddToTray ? (
            <Pressable
              disabled={busy || !state.foodName.trim()}
              onPress={() => {
                const { conflictNote: _c, sourceNote: _s, pendingPhotoB64, ...entry } = state;
                onAddToTray(entry, pendingPhotoB64 ?? null);
              }}
              hitSlop={8}
            >
              <Text style={styles.trayAction}>ADD TO TRAY · KEEP LOGGING</Text>
            </Pressable>
          ) : null}
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
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8 },
  photoThumb: { width: 44, height: 44, borderRadius: 7, backgroundColor: color.surface2 },
  photoAction: { fontFamily: mono, fontSize: 11, letterSpacing: 0.9, color: color.mute, paddingVertical: 8 },
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
  fieldLabel: { fontFamily: mono, fontSize: 11, letterSpacing: 0.9, color: color.faint, marginTop: 12, marginBottom: -4 },
  fieldInput: { marginTop: 8 },
  conflict: {
    fontFamily: mono, fontSize: 11, letterSpacing: 0.38, color: color.fat,
    lineHeight: 15, marginTop: 12,
  },
  trayLive: { fontFamily: mono, fontSize: 11, letterSpacing: 0.9, color: color.mute, marginTop: 12 },
  trayAction: {
    fontFamily: mono, fontSize: 11, letterSpacing: 0.9, color: color.ink2,
    textAlign: 'center', paddingVertical: 12,
  },
});
