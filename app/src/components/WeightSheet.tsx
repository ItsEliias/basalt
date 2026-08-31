import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, CTA, ObInput, SrcNote } from '@basalt/ui';
import { addWeightEntry } from '@basalt/core-data';
import { writeThroughOutbox } from '../lib/outbox';
import { supabase } from '../lib/supabase';

// Quick weight log — the ledger's TDEE loop feeds on these.

export function WeightSheet({
  open, onClose, onLogged,
}: {
  open: boolean;
  onClose: () => void;
  onLogged: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [kg, setKg] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const n = parseFloat(kg.replace(',', '.'));
    if (!isFinite(n) || n <= 0) return;
    setBusy(true);
    const measuredAt = new Date().toISOString();
    const r = await writeThroughOutbox(
      () => addWeightEntry(supabase, n, { measuredAt, source: 'manual' }),
      { kind: 'weight', weightKg: n, measuredAt, source: 'manual' },
    );
    setBusy(false);
    if (r.ok) {
      setKg('');
      onLogged();
      onClose();
    }
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.dim} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.sheet, { paddingBottom: 22 + insets.bottom }]}>
          <View style={styles.grab} />
          <ObInput
            placeholder="Weight (kg)"
            keyboardType="decimal-pad"
            value={kg}
            onChangeText={setKg}
            autoFocus
          />
          <CTA label={busy ? '…' : 'Log weight'} onPress={save} disabled={busy || !kg.trim()} />
          <SrcNote center>Weigh-ins drive the weekly target recalibration — same conditions, same scale beats precision</SrcNote>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
});
