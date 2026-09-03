import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import {
  Card, MicroLabel, KV, SrcNote, HeroNumeral, EmptyState, Rule,
  MacroRow, CapRow, SegmentedStack, ReceiptHeader, ReceiptRow, MealTag,
  TileGrid, StatTile, EmptyTile, WaterTicks, TickCaption, MicroRow,
  TileGridThemed, Tile,
  color, mono, groupInt, useTheme,
  ScaledText as Text,
} from '@basalt/ui';
import { getFoodEntriesForDay, getDailyTotals, getWaterForDay, addWater, undoLastWater, hydrationGoalMl, deleteFoodEntry, type FoodEntryRow, type DailyTotals } from '@basalt/nutrition';
import { listRecentSessions, getSessionDetail, sessionVolumeKg } from '@basalt/training';
import { healthService } from '@basalt/health-connect';
import { todayISO } from '@basalt/core-data';
import { supabase } from '../../lib/supabase';
import { runHealthSync } from '../../lib/healthSync';
import { useAppStore } from '../../state/appStore';
import { groupEntriesByMeal, heroModel, ledgerHeroMode, entryMeta, sessionMeta, microTotals, todayTileSpecs, type SessionRow, filterTiles, microDetail,
} from './model';
import { Image } from 'react-native';
import { signedPhotoUrls, mealBudgets, trainingDayTarget } from '@basalt/nutrition';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { BasaltTodayWidget } from '../../widgets/BasaltTodayWidget';
import { WIDGET_SNAPSHOT_KEY } from '../../widgets/handler';
import { parseSnapshot } from '../../widgets/widgetModel';

// Today — the ledger's front page. Everything on it is real or absent:
// targets from the versioned row, entries from the receipt tables, steps
// only when a source granted them, active energy only when measured.

type TodayData = {
  entries: FoodEntryRow[];
  totals: DailyTotals;
  waterMl: number;
  sessions: (SessionRow & { setCount: number; volumeKg: number })[];
  steps: number | null;
  activeKcal: number | null;
  /** Fractional hours, e.g. 7.2 = 7:12. null when the sync job hasn't
   *  written a session for today (see basalt_sleep_sessions.date). */
  sleepHours: number | null;
};

const EMPTY_TOTALS: DailyTotals = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodiumMg: 0 };

async function loadToday(): Promise<TodayData> {
  const [entriesR, totalsR, waterR, sessionsR] = await Promise.all([
    getFoodEntriesForDay(supabase),
    getDailyTotals(supabase),
    getWaterForDay(supabase),
    listRecentSessions(supabase, 10),
  ]);

  const today = todayISO();
  const todaySessions = (sessionsR.ok ? sessionsR.data : []).filter((s) => s.startedAt.slice(0, 10) === today);
  const sessions: TodayData['sessions'] = [];
  for (const s of todaySessions) {
    const d = await getSessionDetail(supabase, s.id);
    if (!d.ok) continue;
    const sets = d.data.exercises.flatMap((e) => e.sets);
    const minutes = s.endedAt ? (Date.parse(s.endedAt) - Date.parse(s.startedAt)) / 60000 : null;
    sessions.push({
      title: s.notes?.trim() || 'Training session',
      meta: sessionMeta(sets.length, sessionVolumeKg(sets), minutes),
      startedAt: s.startedAt,
      setCount: sets.length,
      volumeKg: sessionVolumeKg(sets),
    });
  }

  // Steps: the persisted ledger row first (the sync job writes it), a live
  // Health Connect read second — real-or-hidden either way.
  let steps: number | null = null;
  let activeKcal: number | null = null;
  const stepRow = await supabase
    .from('basalt_step_logs')
    .select('steps')
    .eq('date', today)
    .maybeSingle();
  if (stepRow.data && Number(stepRow.data.steps) > 0) steps = Number(stepRow.data.steps);

  const avail = await healthService.isAvailable();
  if (avail.ok && avail.data === 'available') {
    const granted = await healthService.getGrantedPermissions();
    if (steps === null && granted.ok && granted.data.includes('steps')) {
      const s = await healthService.getStepsForDay();
      if (s.ok && s.data > 0) steps = s.data;
    }
    if (granted.ok && granted.data.includes('activeCalories')) {
      const a = await healthService.getActiveCaloriesForDay();
      if (a.ok && a.data > 0) activeKcal = a.data;
    }
  }

  // Sleep — persisted only (the Tiles layout's Sleep tile; matches the
  // same source-of-truth pattern as steps above). No live HC fallback: a
  // single night's sleep is already the sync job's job, not this screen's.
  let sleepHours: number | null = null;
  const sleepRow = await supabase
    .from('basalt_sleep_sessions')
    .select('bedtime, waketime')
    .eq('date', today)
    .maybeSingle();
  if (sleepRow.data?.bedtime && sleepRow.data?.waketime) {
    const hours = (Date.parse(sleepRow.data.waketime) - Date.parse(sleepRow.data.bedtime)) / 3600000;
    if (hours > 0) sleepHours = hours;
  }

  return {
    entries: entriesR.ok ? entriesR.data : [],
    totals: totalsR.ok ? totalsR.data : EMPTY_TOTALS,
    waterMl: waterR.ok ? waterR.data : 0,
    sleepHours,
    sessions,
    steps,
    activeKcal,
  };
}

export function TodayScreen() {
  const { theme } = useTheme();
  const targets = useAppStore((s) => s.targets);
  const profile = useAppStore((s) => s.profile);
  const todayVersion = useAppStore((s) => s.todayVersion);
  const [data, setData] = useState<TodayData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<Map<string, string>>(new Map());
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [microWallOpen, setMicroWallOpen] = useState(false);
  // Tiles Today layout (docs/basalt-layouts.md) — Settings → Display.
  const layout = profile?.todayLayout ?? 'ledger';

  const refresh = useCallback(async () => {
    setData(await loadToday());
    // Tile hide/show — hiding is omission; re-read so Settings changes land.
    const raw = await AsyncStorage.getItem('basalt.hiddenToday');
    try {
      setHidden(new Set(raw ? (JSON.parse(raw) as string[]) : []));
    } catch {
      setHidden(new Set());
    }
  }, []);

  useEffect(() => {
    // Kick a (throttled) Health Connect sync, then load; a completed sync
    // triggers one more load so persisted rows land without a manual pull.
    void runHealthSync().then((report) => {
      if (report) void refresh();
    });
    void refresh();
  }, [refresh, todayVersion]);

  const onPull = async () => {
    setRefreshing(true);
    await runHealthSync({ force: true });
    await refresh();
    setRefreshing(false);
  };

  const waterTarget = targets?.waterMl ?? hydrationGoalMl(null, 0, []);
  const tickMl = 250;
  const totalTicks = Math.max(1, Math.ceil(waterTarget / tickMl));

  const onAddWater = async () => {
    const r = await addWater(supabase, tickMl);
    if (r.ok && data) setData({ ...data, waterMl: r.data });
  };
  const onUndoWater = async () => {
    const r = await undoLastWater(supabase);
    if (r.ok && data) setData({ ...data, waterMl: r.data });
  };

  const sections = data ? groupEntriesByMeal(data.entries) : [];
  const micros = data ? microTotals(data.entries) : [];

  useEffect(() => {
    const paths = (data?.entries ?? []).map((e) => e.photoPath).filter((p): p is string => !!p);
    if (paths.length === 0) {
      setPhotoUrls(new Map());
      return;
    }
    void signedPhotoUrls(supabase, paths).then((r) => r.ok && setPhotoUrls(r.data));
  }, [data]);

  const hero = targets && data ? heroModel(targets, data.totals, data.activeKcal) : null;
  const hideNumbers = profile?.hideNumbers ?? false;
  const heroMode = ledgerHeroMode(hero !== null, hideNumbers);

  // hydrationEnabled has no backing setting in the app yet (the spec
  // assumes one) — treated as always-on, matching Ledger's current
  // unconditional Water tile, until that setting exists.
  const tileSpecs = data
    ? todayTileSpecs({
        hero, hideNumbers, targets: targets ?? null, totals: data.totals,
        steps: data.steps, sleepHours: data.sleepHours,
        waterMl: data.waterMl, waterTargetMl: waterTarget,
        hydrationEnabled: true,
        trainingTitle: data.sessions[0]?.title ?? null,
      })
    : [];

  const eatBack = targets && data ? trainingDayTarget(targets.calories, data.activeKcal ?? 0) : null;
  const budgets =
    targets && data && !hideNumbers
      ? mealBudgets(
          eatBack?.kcal ?? targets.calories,
          data.entries.reduce((acc: Partial<Record<string, number>>, e) => {
            acc[e.mealType] = (acc[e.mealType] ?? 0) + e.calories;
            return acc;
          }, {}),
          new Date().getHours(),
        )
      : null;

  // Widget snapshot: written on every Today computation; the widget shows
  // this with its age — never a number the app didn't compute.
  useEffect(() => {
    if (!hero || !data) return;
    const snapshot = {
      remainingKcal: hero.remaining,
      over: hero.over,
      waterFilled: Math.min(totalTicks, Math.floor(data.waterMl / tickMl)),
      waterTotal: totalTicks,
      entryCount: data.entries.length,
      hideNumbers,
      at: new Date().toISOString(),
    };
    void AsyncStorage.setItem(WIDGET_SNAPSHOT_KEY, JSON.stringify(snapshot)).then(() => {
      void requestWidgetUpdate({
        widgetName: 'BasaltToday',
        renderWidget: () => <BasaltTodayWidget snapshot={parseSnapshot(JSON.stringify(snapshot))} nowMs={Date.now()} />,
      }).catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, hideNumbers]);

  if (layout === 'tiles') {
    return (
      <ScrollView
        style={[styles.scroll, { backgroundColor: theme.surfaces.bg }]}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPull} tintColor={color.mute} />}
      >
        <TileGridThemed>
          {filterTiles(tileSpecs, hidden).map((t) => (
            <Tile
              key={t.key}
              span={t.span}
              label={t.label}
              value={t.value}
              unit={t.unit}
              over={t.over}
              empty={t.empty}
              emptyMessage={t.emptyMessage}
            />
          ))}
        </TileGridThemed>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.surfaces.bg }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPull} tintColor={color.mute} />}
    >
      {/* ── Hero: energy remaining ─────────────────────────────────── */}
      <Card>
        {heroMode === 'qualitative' ? (
          <>
            <MicroLabel>Food</MicroLabel>
            <Text style={styles.heroSub}>
              {data && data.entries.length > 0
                ? `Logged — ${data.entries.length} ${data.entries.length === 1 ? 'item' : 'items'} today`
                : 'Nothing logged yet today'}
            </Text>
            <SrcNote>Numbers hidden at your request · everything is still recorded and stays in your ledger and exports · turn back on in Settings</SrcNote>
          </>
        ) : null}
        {hero && heroMode === 'numeric' ? (
          <>
            <KV label="Energy remaining" right={<Text style={styles.targetRatio}><Text style={styles.targetOf}>target</Text> {hero.targetText}</Text>} />
            <HeroNumeral value={groupInt(hero.remaining)} unit={hero.over ? 'kcal over' : 'kcal'} />
            <Text style={styles.heroSub}>{hero.subParts.join(' · ')}</Text>
            <SegmentedStack
              segments={[
                { fraction: hero.stack[0]?.fraction ?? 0, fill: color.protein },
                { fraction: hero.stack[1]?.fraction ?? 0, fill: color.carbs },
                { fraction: hero.stack[2]?.fraction ?? 0, fill: color.fat },
              ]}
            />
          </>
        ) : heroMode === 'no-targets' ? (
          <>
            <MicroLabel>Energy</MicroLabel>
            <EmptyState>
              No daily targets yet. Finish onboarding in Settings → Profile and your energy budget appears here.
            </EmptyState>
          </>
        ) : null}
      </Card>

      {/* ── Macros + caps ──────────────────────────────────────────── */}
      {targets && data && !hideNumbers && !hidden.has('macros') ? (
        <Card>
          <MacroRow name="Protein" dot={color.protein} value={data.totals.protein} target={targets.proteinG} />
          <MacroRow name="Carbohydrate" dot={color.carbs} value={data.totals.carbs} target={targets.carbsG} />
          <MacroRow name="Fat" dot={color.fat} value={data.totals.fat} target={targets.fatG} />
          <MacroRow name="Fibre" dot={color.faint} value={data.totals.fiber} target={targets.fiberG} />
          {targets.sugarCapG !== null || targets.sodiumCapMg !== null ? (
            <>
              <Rule />
              <MicroLabel faint>Caps — under is the goal</MicroLabel>
              {targets.sugarCapG !== null ? (
                <CapRow name="Added sugar" value={data.totals.sugar} cap={targets.sugarCapG} />
              ) : null}
              {targets.sodiumCapMg !== null ? (
                <CapRow name="Sodium" value={data.totals.sodiumMg / 1000} cap={targets.sodiumCapMg / 1000} decimals={1} />
              ) : null}
            </>
          ) : null}
          {budgets ? (
            <>
              <Rule />
              <MicroLabel faint>Meal budgets — suggestion, never mandate</MicroLabel>
              {budgets.rows.map((b) => (
                <ReceiptRow
                  key={b.meal}
                  name={b.meal[0]!.toUpperCase() + b.meal.slice(1)}
                  meta={b.state === 'passed' ? 'window passed — share flows forward' : undefined}
                  value={
                    b.state === 'eaten'
                      ? String(b.eatenKcal)
                      : b.suggestedKcal !== null
                        ? `~${b.suggestedKcal}`
                        : '—'
                  }
                  unit="kcal"
                  valueColor={b.state === 'eaten' ? undefined : color.faint}
                />
              ))}
              <SrcNote>{budgets.note}</SrcNote>
              {eatBack?.note ? <SrcNote>{eatBack.note}</SrcNote> : null}
            </>
          ) : null}
          <SrcNote>
            {targets.reason
              ? `Targets: ${targets.reason} Over a cap is stated plainly, never hidden — and never scolded.`
              : 'Targets from your goal + habits questionnaire · over a cap is stated plainly, never hidden — and never scolded'}
          </SrcNote>
        </Card>
      ) : null}

      {/* ── Logged receipt ─────────────────────────────────────────── */}
      {hidden.has('meals') ? null : (
      <Card>
        <ReceiptHeader
          label="Logged"
          summary={
            data && (data.entries.length > 0 || data.sessions.length > 0)
              ? hideNumbers
                ? `${data.entries.length + data.sessions.length} entries`
                : `${data.entries.length + data.sessions.length} entries · ${groupInt(data.totals.calories)} kcal`
              : undefined
          }
        />
        {data && (data.entries.length > 0 || data.sessions.length > 0) ? (
          <>
            {sections.map((s) => (
              <View key={s.meal}>
                <MealTag>{`${s.label}${s.time ? ` — ${s.time}` : ''}`}</MealTag>
                {s.entries.map((e, i) => (
                  <Pressable key={e.id} onLongPress={() => void deleteFoodEntry(supabase, e.id).then(refresh)} hitSlop={8}>
                    <ReceiptRow
                      name={e.foodName}
                      thumb={
                        e.photoPath && photoUrls.get(e.photoPath) ? (
                          <Image source={{ uri: photoUrls.get(e.photoPath)! }} style={styles.entryThumb} />
                        ) : undefined
                      }
                      meta={hideNumbers ? 'hold to remove' : `${entryMeta(e)} · hold to remove`}
                      value={hideNumbers ? '✓' : groupInt(e.calories)}
                      unit={hideNumbers ? undefined : 'kcal'}
                      valueColor={hideNumbers ? color.faint : undefined}
                      last={i === s.entries.length - 1}
                    />
                  </Pressable>
                ))}
              </View>
            ))}
            {data.sessions.map((s, i) => (
              <View key={`sess-${i}`}>
                <MealTag>{`Training — ${new Date(s.startedAt).toTimeString().slice(0, 5)}`}</MealTag>
                <ReceiptRow name={s.title} meta={s.meta} last />
              </View>
            ))}
            <SrcNote>Hold any food entry to remove it · every value from your own log</SrcNote>
          </>
        ) : (
          <EmptyState>
            Nothing logged yet today. Scan a barcode, add a meal or start a session — it all lands here.
          </EmptyState>
        )}
      </Card>
      )}

      {/* ── Micronutrients — only with source data ─────────────────── */}
      {micros.length > 0 && !hidden.has('micros') ? (
        <Card>
          <Pressable onPress={() => setMicroWallOpen(!microWallOpen)} hitSlop={8}>
            <ReceiptHeader
              label="Micronutrients"
              summary={microWallOpen ? 'every sourced nutrient · tap to fold' : `from logged foods · tap for all ${micros.length}`}
            />
          </Pressable>
          <View style={{ marginTop: 8 }}>
            {!microWallOpen
              ? micros.slice(0, 8).map((m) => <MicroRow key={m.name} name={m.name} pct={m.pct} />)
              : microDetail(data?.entries ?? []).map((m) => (
                  <View key={m.name}>
                    <MicroRow name={m.name} pct={m.pct} />
                    <Text style={styles.microMeta}>
                      {(m.amount !== null && m.unit ? `${m.amount} ${m.unit} · ` : '') +
                        `${m.fromEntries} ${m.fromEntries === 1 ? 'entry' : 'entries'} carried source data` +
                        (m.amount === null ? ' · amounts in mixed units — % only' : '')}
                    </Text>
                  </View>
                ))}
          </View>
          <SrcNote>Only nutrients with source data are shown — no estimates presented as fact · an absent nutrient means absent data, never zero</SrcNote>
        </Card>
      ) : null}

      {/* ── Tiles: steps + water ───────────────────────────────────── */}
      <TileGrid>
        {hidden.has('steps') ? null : data?.steps != null ? (
          <StatTile label="Steps" source="Health Connect" value={groupInt(data.steps)} />
        ) : (
          <EmptyTile
            label="Steps"
            message="No step source connected. Connect Health Connect in Recover to see movement here."
          />
        )}
        {hidden.has('water') ? null : (
        <View style={{ flexBasis: '47%', flexGrow: 1 }}>
          <StatTile
            label="Water"
            value={data ? groupInt(data.waterMl) : '—'}
            unit={`/ ${groupInt(waterTarget)} ml`}
          >
            <WaterTicks
              total={totalTicks}
              filled={data ? Math.min(totalTicks, Math.floor(data.waterMl / tickMl)) : 0}
              onAdd={onAddWater}
            />
            <TickCaption left="+250 tap" right="undo −250" onPressLeft={onAddWater} />
            <SrcNote>
              {profile
                ? 'Goal from the bodyweight formula: weight × 32 ml + activity + goal'
                : 'Default goal — add your weight for a personal one'}
            </SrcNote>
          </StatTile>
        </View>
        )}
      </TileGrid>
      {hidden.has('water') ? null : (
        <Text onPress={onUndoWater} style={styles.undo}>UNDO LAST WATER</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  microMeta: { fontFamily: mono, fontSize: 10.5, letterSpacing: 0.4, color: color.faint, marginTop: -2, marginBottom: 6 },
  scroll: { flex: 1, backgroundColor: color.bg },
  content: { paddingHorizontal: 16, paddingBottom: 24 },
  targetRatio: { fontFamily: mono, fontSize: 12, color: color.ink2 },
  targetOf: { color: color.faint },
  heroSub: { fontFamily: mono, fontSize: 11.5, color: color.mute, marginTop: 10 },
  entryThumb: { width: 30, height: 30, borderRadius: 7, backgroundColor: color.surface2 },
  undo: {
    fontFamily: mono, fontSize: 11, letterSpacing: 0.95, color: color.faint,
    textAlign: 'center', marginTop: 14, paddingVertical: 4,
  },
});
