import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, mono, CTA, ObInput, SrcNote, ScaledText as Text } from '@basalt/ui';
import { addWeightEntry } from '@basalt/core-data';
import { writeThroughOutbox } from '../lib/outbox';
import { bleAvailable, startScaleRead, type ScaleSession } from '../lib/bleScale';
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
  const [scaleState, setScaleState] = useState<'idle' | 'reading'>('idle');
  const [scaleError, setScaleError] = useState<string | null>(null);
  const [scaleValue, setScaleValue] = useState<string | null>(null);
  const sessionRef = useRef<ScaleSession | null>(null);

  const stopScale = () => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    setScaleState('idle');
  };
  useEffect(() => {
    if (!open) stopScale();
    return stopScale;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const readScale = async () => {
    if (scaleState === 'reading') {
      stopScale();
      return;
    }
    setScaleError(null);
    setScaleState('reading');
    sessionRef.current = await startScaleRead({
      onReading: (readKg) => {
        const text = readKg.toFixed(2).replace(/\.?0+$/, '');
        setKg(text);
        setScaleValue(text);
      },
      onError: (message) => {
        setScaleError(message);
        stopScale();
      },
    });
  };

  const save = async () => {
    const n = parseFloat(kg.replace(',', '.'));
    if (!isFinite(n) || n <= 0) return;
    setBusy(true);
    const measuredAt = new Date().toISOString();
    // Source honesty: the untouched scale reading is 'ble_scale'; the
    // moment the user edits it, the number is theirs — 'manual'.
    const source = scaleValue !== null && kg === scaleValue ? 'ble_scale' : 'manual';
    const r = await writeThroughOutbox(
      () => addWeightEntry(supabase, n, { measuredAt, source }),
      { kind: 'weight', weightKg: n, measuredAt, source },
    );
    setBusy(false);
    if (r.ok) {
      setKg('');
      setScaleValue(null);
      stopScale();
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
          {bleAvailable() ? (
            <Pressable onPress={() => void readScale()} hitSlop={8}>
              <Text style={[styles.scaleLink, scaleState === 'reading' && styles.scaleLive]}>
                {scaleState === 'reading' ? 'LISTENING FOR YOUR SCALE — STEP ON · TAP TO STOP' : 'READ FROM A BLUETOOTH SCALE'}
              </Text>
            </Pressable>
          ) : null}
          {scaleError ? <SrcNote center>{scaleError}</SrcNote> : null}
          <CTA label={busy ? '…' : 'Log weight'} onPress={save} disabled={busy || !kg.trim()} />
          <SrcNote center>Weigh-ins drive the weekly target recalibration — same conditions, same scale beats precision{bleAvailable() ? ' · scale readings use the standard Bluetooth weight profile; edit before saving and the entry is yours, untouched and it logs as ble_scale' : ''}</SrcNote>
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
  scaleLink: { fontFamily: mono, fontSize: 11, letterSpacing: 0.9, color: color.faint, textAlign: 'center', paddingVertical: 10 },
  scaleLive: { color: color.ink },
});
