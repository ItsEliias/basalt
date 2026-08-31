import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import {
  CTA, SrcNote, ReceiptHeader, ReceiptRow, ObInput, Stepper, EmptyState,
  color, mono, ScaledText as Text,
} from '@basalt/ui';
import { getRecipeDetail, mergeTimelines, atText, type CookRecipe } from '@basalt/nutrition';
import { supabase } from '../../lib/supabase';

// Cooking mode — several recipes, one merged timeline, everything
// finishing together. Times come ONLY from steps that state them; the
// rest are sequenced, counted and said. Two named kitchen timers run on
// the wall clock while the sheet is open — and the screen stays awake,
// which is the published mechanism here (no background service).

type KitchenTimer = { name: string; minutes: number; endsAt: number | null; fired: boolean };

function KeepAwakeWhileOpen() {
  useKeepAwake();
  return null;
}

export function CookingSheet({ open, recipeIds, onClose }: {
  open: boolean;
  recipeIds: string[];
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [recipes, setRecipes] = useState<CookRecipe[] | null>(null);
  const [now, setNow] = useState(Date.now());
  const [timers, setTimers] = useState<KitchenTimer[]>([
    { name: 'Timer A', minutes: 10, endsAt: null, fired: false },
    { name: 'Timer B', minutes: 5, endsAt: null, fired: false },
  ]);

  useEffect(() => {
    if (!open) return;
    setRecipes(null);
    void Promise.all(recipeIds.map((id) => getRecipeDetail(supabase, id))).then((results) => {
      setRecipes(
        results
          .filter((r) => r.ok)
          .map((r: any) => ({ title: r.data.title, steps: r.data.steps as string[] })),
      );
    });
  }, [open, recipeIds]);

  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [open]);

  // A finished timer says its own name — once.
  useEffect(() => {
    timers.forEach((t, i) => {
      if (t.endsAt !== null && !t.fired && now >= t.endsAt) {
        setTimers((ts) => ts.map((x, j) => (j === i ? { ...x, fired: true, endsAt: null } : x)));
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        Speech.speak(`${t.name} finished.`);
      }
    });
  }, [now, timers]);

  const plan = recipes && recipes.length > 0 ? mergeTimelines(recipes) : null;

  const setTimer = (i: number, patch: Partial<KitchenTimer>) =>
    setTimers((ts) => ts.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  const remain = (t: KitchenTimer) => {
    if (t.endsAt === null) return null;
    const s = Math.max(0, Math.round((t.endsAt - now) / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      {open ? <KeepAwakeWhileOpen /> : null}
      <Pressable style={styles.dim} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: 16 + insets.bottom }]}>
        <View style={styles.grab} />
        <ScrollView style={{ maxHeight: 580 }} keyboardShouldPersistTaps="handled">
          <ReceiptHeader
            label="Cooking mode"
            summary={plan ? `${recipes!.length} ${recipes!.length === 1 ? 'recipe' : 'recipes'} · ~${Math.round(plan.totalMin)} min` : undefined}
          />

          {recipes === null ? <EmptyState>Loading steps…</EmptyState> : null}
          {plan && plan.entries.length > 0 ? (
            <>
              {plan.entries.map((e, i) => (
                <ReceiptRow
                  key={`${e.recipeIndex}-${e.stepIndex}`}
                  name={`${atText(e.atMin)} · ${e.recipeTitle}`}
                  meta={e.text}
                  value={e.durationMin !== null ? String(Math.round(e.durationMin)) : '—'}
                  unit={e.durationMin !== null ? 'min' : ''}
                  last={i === plan.entries.length - 1}
                />
              ))}
              <SrcNote>
                {`Everything lands together at ~${Math.round(plan.totalMin)} min — later starts are on purpose` +
                  (plan.unscheduledCount > 0
                    ? ` · ${plan.unscheduledCount} ${plan.unscheduledCount === 1 ? 'step states' : 'steps state'} no time: listed in order, not scheduled`
                    : '')}
              </SrcNote>
            </>
          ) : null}
          {plan && plan.entries.length === 0 ? (
            <EmptyState>These recipes have no steps recorded — nothing to schedule.</EmptyState>
          ) : null}

          {/* ── Two named kitchen timers ─────────────────────────────── */}
          {timers.map((t, i) => (
            <View key={i} style={styles.timerRow}>
              <ObInput
                placeholder={`Timer ${i === 0 ? 'A' : 'B'}`}
                value={t.name}
                onChangeText={(v) => setTimer(i, { name: v })}
                style={{ flex: 1 }}
              />
              {t.endsAt === null ? (
                <>
                  <Stepper
                    value={String(t.minutes)}
                    unit="min"
                    onMinus={() => setTimer(i, { minutes: Math.max(1, t.minutes - 1) })}
                    onPlus={() => setTimer(i, { minutes: Math.min(180, t.minutes + 1) })}
                  />
                  <Pressable onPress={() => setTimer(i, { endsAt: Date.now() + t.minutes * 60000, fired: false })} hitSlop={10}>
                    <Text style={styles.timerLink}>START {t.minutes}m</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable onPress={() => setTimer(i, { endsAt: null })} hitSlop={10}>
                  <Text style={[styles.timerLink, styles.timerLive]}>{remain(t)} · STOP</Text>
                </Pressable>
              )}
            </View>
          ))}

          <CTA label="Done cooking" onPress={onClose} />
          <SrcNote>Timers run while this sheet is open — the screen stays awake · a finished timer speaks its name and vibrates · times above come only from steps that state them</SrcNote>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: { flex: 1, backgroundColor: 'rgba(5,6,8,.6)' },
  sheet: {
    backgroundColor: color.surface,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  grab: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: color.border, marginBottom: 8 },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  timerLink: { fontFamily: mono, fontSize: 11, letterSpacing: 0.9, color: color.faint, paddingVertical: 10 },
  timerLive: { color: color.ink },
});
