import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CTA, ObNote, SrcNote, mono, useTheme, ScaledText as Text } from '@basalt/ui';
import {
  CATALOG_BY_ID, doableWith, equipmentSetFrom, generateProgramme, limitationChipsFrom,
  saveTemplate, startProgram,
  type CatalogExercise, type GeneratedProgramme, type GeneratorInput,
} from '@basalt/training';
import { isoDay } from '@basalt/core-data';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../state/appStore';

// The generated programme, before you keep it (V4 Phase 8c). Every rule
// the generator used renders under "why"; every slot can be swapped
// through its substitution list before committing; gaps and trims are
// stated, never hidden. Keeping it writes ordinary editable templates
// and starts an ordinary programme — nothing special-cased afterward.

export function GenerateProgrammeSheet({ open, onClose, onKept }: {
  open: boolean;
  onClose: () => void;
  onKept: () => void;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const profile = useAppStore((s) => s.profile);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const intake = profile?.ptIntake ?? null;
  const input: GeneratorInput | null = useMemo(() => {
    if (!profile) return null;
    const equipment = equipmentSetFrom(profile.trainLocation ?? null, profile.equipment ?? []);
    return {
      daysPerWeek: intake?.schedule?.daysPerWeek ?? 3,
      sessionMinutes: intake?.schedule?.sessionMinutes ?? 60,
      experience: intake?.experience ?? 'under1y',
      goal: (profile.goalTypes ?? []).includes('lose') ? 'cut' : (profile.goalTypes ?? []).includes('build') ? 'gain' : 'maintain',
      equipment,
      inventory: {
        ...(intake?.inventory?.dumbbellMaxKg ? { dumbbellMaxKg: intake.inventory.dumbbellMaxKg } : {}),
        ...(intake?.inventory?.kettlebellKg ? { kettlebellKg: intake.inventory.kettlebellKg } : {}),
      },
      exclusions: limitationChipsFrom(profile.conditions ?? []),
      bodyweightKg: null,
    };
  }, [profile, intake]);

  const programme: GeneratedProgramme | null = useMemo(
    () => (input ? generateProgramme(input) : null),
    [input],
  );

  if (!programme || !input) return null;

  const resolved = (slotKey: string, exercise: CatalogExercise | null): CatalogExercise | null => {
    const id = overrides[slotKey];
    return id ? CATALOG_BY_ID.get(id) ?? exercise : exercise;
  };

  const swap = (slotKey: string, current: CatalogExercise) => {
    // Substitution list first, filtered to what the user can actually do.
    const doable = new Set(doableWith(input.equipment).map((x) => x.id));
    const candidates = current.subs.filter((id) => doable.has(id));
    if (candidates.length === 0) {
      Alert.alert('No substitution fits', `${current.name} has no doable substitute with your equipment.`);
      return;
    }
    const now = overrides[slotKey];
    const idx = now ? candidates.indexOf(now) : -1;
    const next = candidates[(idx + 1) % candidates.length]!;
    setOverrides((o) => ({ ...o, [slotKey]: next }));
  };

  const keep = async () => {
    setBusy(true);
    try {
      for (const day of programme.days) {
        const exercises = day.slots
          .map((g, i) => {
            const ex = resolved(`${day.name}:${i}`, g.exercise);
            if (!ex) return null;
            return {
              exerciseName: ex.name,
              targetSets: g.sets,
              targetReps: g.repHigh,
              targetWeightKg: g.startWeightKg,
            };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null);
        if (exercises.length === 0) continue;
        const saved = await saveTemplate(supabase, {
          name: `${programme.split.name} · ${day.name}`,
          location: input.equipment.has('machine') ? 'gym' : 'home',
          notes: `Generated ${isoDay(new Date())} — week 1 is a calibration week; every number is a starting point.`,
          exercises,
        });
        if (!saved.ok) {
          Alert.alert('Not saved', saved.error);
          setBusy(false);
          return;
        }
      }
      const weekdays = intake?.schedule?.weekdays?.length
        ? intake.schedule.weekdays
        : [1, 3, 5, 2, 4, 6].slice(0, programme.days.length);
      const started = await startProgram(supabase, weekdays, isoDay(new Date()), {
        id: `generated-${programme.split.id}`,
        weeks: 8,
        ratePct: input.goal === 'cut' ? -0.5 : input.goal === 'gain' ? 0.25 : 0,
      });
      if (!started.ok) {
        Alert.alert('Templates saved, programme not started', started.error);
        setBusy(false);
        return;
      }
      onKept();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: theme.surfaces.bg, paddingTop: insets.top + 22, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.head}>
          <Text style={[styles.brand, { color: theme.text.ink }]}>{programme.split.name.toUpperCase()}</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button">
            <Text style={[styles.skip, { color: theme.text.faint }]}>NOT NOW</Text>
          </Pressable>
        </View>
        <Text style={[styles.why, { color: theme.text.mute }]}>{programme.split.why}</Text>
        <ScrollView style={styles.scroll}>
          {programme.days.map((day) => (
            <View key={day.name} style={[styles.day, { borderColor: theme.surfaces.border }]}>
              <Text style={[styles.dayName, { color: theme.text.ink }]}>
                {`${day.name.toUpperCase()} · ~${day.estMinutes} MIN`}
              </Text>
              {day.slots.map((g, i) => {
                const ex = resolved(`${day.name}:${i}`, g.exercise);
                if (!ex) {
                  return (
                    <Text key={i} style={[styles.gap, { color: theme.text.fat }]}>{g.gapNote}</Text>
                  );
                }
                return (
                  <Pressable key={i} onPress={() => swap(`${day.name}:${i}`, ex)} hitSlop={6}>
                    <View style={styles.slotRow}>
                      <View style={styles.slotLeft}>
                        <Text style={[styles.slotName, { color: theme.text.ink2 }]}>{ex.name}</Text>
                        <Text style={[styles.slotBasis, { color: theme.text.faint }]}>
                          {g.startWeightKg !== null ? `${g.startWeightKg} kg · ${g.startBasis}` : g.startBasis}
                        </Text>
                      </View>
                      <Text style={[styles.slotScheme, { color: theme.text.mute }]}>
                        {`${g.sets}×${g.repLow}–${g.repHigh}`}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
              {day.trimmed.length > 0 ? (
                <Text style={[styles.trim, { color: theme.text.faint }]}>
                  {`Trimmed to fit your minutes: ${day.trimmed.join(', ')}.`}
                </Text>
              ) : null}
            </View>
          ))}
          {programme.volumeAdjustments.map((a) => (
            <Text key={a} style={[styles.adjust, { color: theme.text.mute }]}>{a}</Text>
          ))}
          <Text style={[styles.adjust, { color: theme.text.mute }]}>
            {`Steps target ${programme.cardio.stepsTarget.toLocaleString('en-US')}/day${programme.cardio.zone2Walks ? ` · ${programme.cardio.zone2Walks.count} zone-2 walks of ${programme.cardio.zone2Walks.minutes} min in the week (a cut trains legs and appetite both)` : ''}.`}
          </Text>
          <ObNote>{`RIR by block week: ${programme.rirByWeek.join(' → ')} → deload · deload every ${programme.deloadEveryWeeks} weeks${programme.newLifterBlock ? ' · first four weeks at 2–3×10–15 to learn the movements' : ''} · week 1 asks RIR on every set and week 2 adjusts from it`}</ObNote>
          <View style={styles.rules}>
            <Text style={[styles.rulesHead, { color: theme.text.faint }]}>WHY — EVERY RULE THE GENERATOR USED</Text>
            {programme.rules.map((r) => (
              <Text key={r.slice(0, 24)} style={[styles.rule, { color: theme.text.faint }]}>{`· ${r}`}</Text>
            ))}
          </View>
          <SrcNote>Tap any exercise to swap through its substitutions · keeping this writes ordinary editable templates and starts an ordinary programme — nothing here is locked</SrcNote>
        </ScrollView>
        <CTA label={busy ? '…' : 'Keep this programme'} disabled={busy} onPress={() => void keep()} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 22 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { fontFamily: mono, fontSize: 12, letterSpacing: 1.8 },
  skip: { fontFamily: mono, fontSize: 11, letterSpacing: 1 },
  why: { fontSize: 12.5, lineHeight: 18, marginTop: 8 },
  scroll: { flex: 1, marginTop: 12, marginBottom: 10 },
  day: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 10 },
  dayName: { fontFamily: mono, fontSize: 11, letterSpacing: 1.1, marginBottom: 6 },
  slotRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 6, gap: 10 },
  slotLeft: { flex: 1 },
  slotName: { fontSize: 13.5 },
  slotBasis: { fontSize: 10.5, lineHeight: 14, marginTop: 2 },
  slotScheme: { fontFamily: mono, fontSize: 12.5 },
  gap: { fontSize: 12, lineHeight: 17, paddingVertical: 6 },
  trim: { fontSize: 11, marginTop: 4 },
  adjust: { fontSize: 12, lineHeight: 17, marginBottom: 6 },
  rules: { marginTop: 10, marginBottom: 8 },
  rulesHead: { fontFamily: mono, fontSize: 10.5, letterSpacing: 1, marginBottom: 6 },
  rule: { fontSize: 11, lineHeight: 16, marginBottom: 3 },
});
