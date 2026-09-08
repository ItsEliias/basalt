import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CTA, ChipGroup, ChipRow, ObChipLabel, ObInput, ObNote, ObOption, ObQuestion, ObSub,
  mono, useTheme, ScaledText as Text,
} from '@basalt/ui';
import { saveProfile, type PtIntake } from '@basalt/core-data';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../state/appStore';
import {
  COOKING_OPTIONS, DAYS_PER_WEEK_OPTIONS, EXPERIENCE_OPTIONS, MEALS_PER_DAY_OPTIONS,
  MEDICAL_LINE, SESSION_MINUTES_OPTIONS, WEEKDAY_LABELS,
} from '../screens/onboarding/model';

// "Finish your profile" (V4 Phase 8a) — the PT-intake questions existing
// users never saw, once, dismissable. Also reachable any time from
// Settings › Profile, where every answer stays editable.

export const FINISH_PROFILE_SEEN_KEY = 'basalt.finishProfileSeen';

export function FinishProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const profile = useAppStore((s) => s.profile);
  const refreshCore = useAppStore((s) => s.refreshCore);
  const existing = profile?.ptIntake ?? null;
  const [experience, setExperience] = useState<PtIntake['experience'] | null>(existing?.experience ?? null);
  const [daysPerWeek, setDaysPerWeek] = useState<string | null>(existing?.schedule?.daysPerWeek ? String(existing.schedule.daysPerWeek) : null);
  const [minutes, setMinutes] = useState<string | null>(existing?.schedule?.sessionMinutes ? String(existing.schedule.sessionMinutes) : null);
  const [weekdays, setWeekdays] = useState<number[]>(existing?.schedule?.weekdays ?? []);
  const [dumbbellMaxKg, setDumbbellMaxKg] = useState(existing?.inventory?.dumbbellMaxKg ? String(existing.inventory.dumbbellMaxKg) : '');
  const [kettlebellKg, setKettlebellKg] = useState(existing?.inventory?.kettlebellKg ? String(existing.inventory.kettlebellKg) : '');
  const [limitationNote, setLimitationNote] = useState(existing?.limitations?.note ?? '');
  const [dislikes, setDislikes] = useState((existing?.diet?.dislikes ?? []).join(', '));
  const [mealsPerDay, setMealsPerDay] = useState<string | null>(existing?.diet?.mealsPerDay ? String(existing.diet.mealsPerDay) : null);
  const [cookingTime, setCookingTime] = useState<NonNullable<PtIntake['diet']>['cookingTime'] | null>(existing?.diet?.cookingTime ?? null);
  const [busy, setBusy] = useState(false);

  const dismiss = async () => {
    await AsyncStorage.setItem(FINISH_PROFILE_SEEN_KEY, 'yes');
    onClose();
  };

  const save = async () => {
    setBusy(true);
    const num = (v: string) => {
      const n = parseFloat(v.replace(',', '.'));
      return isFinite(n) && n > 0 ? n : undefined;
    };
    const intake: PtIntake = {
      ...(experience ? { experience } : {}),
      ...(daysPerWeek || minutes || weekdays.length > 0
        ? {
            schedule: {
              ...(daysPerWeek ? { daysPerWeek: parseInt(daysPerWeek, 10) } : {}),
              ...(minutes ? { sessionMinutes: parseInt(minutes, 10) } : {}),
              ...(weekdays.length > 0 ? { weekdays: [...weekdays].sort() } : {}),
            },
          }
        : {}),
      ...(num(dumbbellMaxKg) || num(kettlebellKg)
        ? {
            inventory: {
              ...(num(dumbbellMaxKg) ? { dumbbellMaxKg: num(dumbbellMaxKg) } : {}),
              ...(num(kettlebellKg) ? { kettlebellKg: num(kettlebellKg) } : {}),
            },
          }
        : {}),
      ...(limitationNote.trim() ? { limitations: { note: limitationNote.trim() } } : {}),
      ...(dislikes.trim() || mealsPerDay || cookingTime
        ? {
            diet: {
              ...(dislikes.trim() ? { dislikes: dislikes.split(',').map((d) => d.trim()).filter(Boolean) } : {}),
              ...(mealsPerDay ? { mealsPerDay: parseInt(mealsPerDay, 10) } : {}),
              ...(cookingTime ? { cookingTime } : {}),
            },
          }
        : {}),
    };
    await saveProfile(supabase, { ptIntake: Object.keys(intake).length > 0 ? intake : null });
    await refreshCore();
    setBusy(false);
    await dismiss();
  };

  return (
    <Modal visible={open} animationType="slide" onRequestClose={() => void dismiss()}>
      <View style={[styles.root, { backgroundColor: theme.surfaces.bg, paddingTop: insets.top + 22, paddingBottom: insets.bottom + 22 }]}>
        <View style={styles.head}>
          <Text style={[styles.brand, { color: theme.text.ink }]}>FINISH YOUR PROFILE</Text>
          <Pressable onPress={() => void dismiss()} hitSlop={10} accessibilityRole="button">
            <Text style={[styles.skip, { color: theme.text.faint }]}>NOT NOW</Text>
          </Pressable>
        </View>
        <ObQuestion>The questions a PT would ask.</ObQuestion>
        <ObSub>They power the programme generator and the meal plan. All optional, all editable in Settings › Profile.</ObSub>
        <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
          <ObChipLabel>Training experience</ObChipLabel>
          {EXPERIENCE_OPTIONS.map((e) => (
            <ObOption key={e.key} title={e.title} subtitle={e.sub} on={experience === e.key} onPress={() => setExperience(e.key)} />
          ))}
          <ObChipLabel>Days a week</ObChipLabel>
          <ChipRow options={DAYS_PER_WEEK_OPTIONS} value={daysPerWeek ?? undefined} onChange={setDaysPerWeek} />
          <ObChipLabel>Minutes a session</ObChipLabel>
          <ChipRow options={SESSION_MINUTES_OPTIONS} value={minutes ?? undefined} onChange={setMinutes} />
          <ObChipLabel>Which days — optional</ObChipLabel>
          <ChipGroup
            options={WEEKDAY_LABELS}
            values={weekdays.map((d) => WEEKDAY_LABELS[d]!)}
            onToggle={(label) => {
              const idx = WEEKDAY_LABELS.indexOf(label);
              setWeekdays(weekdays.includes(idx) ? weekdays.filter((d) => d !== idx) : [...weekdays, idx]);
            }}
          />
          <ObChipLabel>Heaviest dumbbell pair (kg) — if you have dumbbells</ObChipLabel>
          <ObInput placeholder="e.g. 20" keyboardType="decimal-pad" value={dumbbellMaxKg} onChangeText={setDumbbellMaxKg} />
          <ObChipLabel>Kettlebell (kg) — if you have one</ObChipLabel>
          <ObInput placeholder="e.g. 16" keyboardType="decimal-pad" value={kettlebellKg} onChangeText={setKettlebellKg} />
          <ObChipLabel>Anything to work around, in your own words</ObChipLabel>
          <ObInput placeholder="e.g. left knee dislikes deep squats" value={limitationNote} onChangeText={setLimitationNote} />
          <ObChipLabel>Foods you just don't want — comma-separated</ObChipLabel>
          <ObInput placeholder="e.g. mushrooms, olives" value={dislikes} onChangeText={setDislikes} />
          <ObChipLabel>Meals a day</ObChipLabel>
          <ChipRow options={MEALS_PER_DAY_OPTIONS} value={mealsPerDay ?? undefined} onChange={setMealsPerDay} />
          <ObChipLabel>Cooking time</ObChipLabel>
          <ChipRow
            options={COOKING_OPTIONS.map((c) => c.label)}
            value={COOKING_OPTIONS.find((c) => c.key === cookingTime)?.label}
            onChange={(label) => setCookingTime(COOKING_OPTIONS.find((c) => c.label === label)?.key ?? null)}
          />
          <ObNote>{MEDICAL_LINE}</ObNote>
        </ScrollView>
        <CTA label={busy ? '…' : 'Save'} disabled={busy} onPress={() => void save()} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 22 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  brand: { fontFamily: mono, fontSize: 11, letterSpacing: 2.42 },
  skip: { fontFamily: mono, fontSize: 11, letterSpacing: 1 },
  scroll: { flex: 1, marginTop: 14, marginBottom: 12 },
});
