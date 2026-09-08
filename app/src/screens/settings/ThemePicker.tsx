import { useEffect, useRef, useState } from 'react';
import { FlatList, Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Card, KV, HeroNumeral, HeroRings, HeroDial, RingKey, MacroRow, CapRow, SegmentedStack,
  ThemeProvider, useTheme, THEMES, THEME_IDS, type ThemeId, groupInt, mono,
  GroundGlow, ScaledText as Text,
} from '@basalt/ui';
import { getDailyTotals, getFoodEntriesForDay } from '@basalt/nutrition';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../state/appStore';
import { loadExpressiveFonts } from '../../lib/expressiveFonts';
import { logThemeLayoutEvent } from '../../lib/instrumentation';
import {
  initialPicker, selectTheme, confirmTheme, isTicked, strapFor, usesLine,
  rowAccessibilityLabel, previewDataFrom, previewPlan, SAMPLE_PREVIEW,
  previewCacheKey, type PickerState, type PreviewData,
} from './themePickerModel';

// Settings › Appearance › Theme — every theme as a LIVE preview of the Today
// screen in the user's own numbers (the labelled sample when today is empty),
// tap to stage, green tick, Confirm applies. Nothing restyles until Confirm.
// The same list powers the onboarding step (sample data, no confirm bar).

// react-native-view-shot is a native module — absent until the next native
// build. The picker works without it (previews stay live); with it, each
// preview is captured once and reused as a bitmap on later visits.
let captureRefFn: ((ref: unknown, opts: object) => Promise<string>) | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  captureRefFn = require('react-native-view-shot').captureRef;
} catch {
  captureRefFn = null;
}

/** In-memory preview bitmap cache; keyed by theme + the numbers shown. */
const shotCache = new Map<string, string>();

// V4.1 follow-up: 60×118 at 0.19 was too small to judge a theme by.
const FRAME_W = 94;
const FRAME_H = 192;
const PREVIEW_W = 304;
const PREVIEW_H = 620;
const SCALE = 0.31;

/** The miniature Today — real components, real tokens, provided data. */
export function TodayMiniPreview({ id, data }: { id: ThemeId; data: PreviewData }) {
  const { theme } = useTheme();
  const { meter, energyFrac, proteinFrac, carbsFrac, heroLabel } = previewPlan(id, data);
  return (
    <View style={[styles.previewRoot, { backgroundColor: theme.surfaces.bg }]}>
      {/* Depth's signature ambient ground — without it the preview reads
          as a generic dark theme. A no-op for themes without groundGlow. */}
      <GroundGlow />
      <View style={styles.previewHead}>
        <Text style={[styles.previewTitle, { color: theme.text.ink }]} allowFontScaling={false}>Today</Text>
        <Text style={[styles.previewDate, { color: theme.text.faint }]} allowFontScaling={false}>
          {data.sample ? 'sample' : 'today'}
        </Text>
      </View>
      <Card lead>
        {meter === 'ring' ? (
          <View style={styles.previewRingRow}>
            <HeroRings
              size={104}
              rings={[
                { fraction: energyFrac, fill: theme.fill.accent },
                { fraction: proteinFrac, fill: theme.fill.protein },
                { fraction: carbsFrac, fill: theme.fill.carbs },
              ]}
              centerValue={groupInt(data.remaining)}
              centerLabel={heroLabel}
            />
            <RingKey
              items={[
                { fill: theme.fill.protein, name: 'P', value: `${data.protein.value}/${data.protein.target}` },
                { fill: theme.fill.carbs, name: 'C', value: `${data.carbs.value}/${data.carbs.target}` },
              ]}
            />
          </View>
        ) : meter === 'dial' ? (
          <HeroDial
            size={116}
            fraction={energyFrac}
            value={groupInt(data.remaining)}
            label={heroLabel}
          />
        ) : (
          <>
            <KV label="Energy remaining" right={groupInt(data.target)} />
            <HeroNumeral value={groupInt(data.remaining)} unit={heroLabel} />
            <SegmentedStack
              segments={[
                { fraction: proteinFrac * 0.33, fill: theme.fill.protein },
                { fraction: carbsFrac * 0.33, fill: theme.fill.carbs },
                { fraction: 0.15, fill: theme.fill.fat },
              ]}
            />
          </>
        )}
      </Card>
      <Card>
        <MacroRow name="Protein" dot={theme.fill.protein} value={data.protein.value} target={data.protein.target} />
        <MacroRow name="Carbs" dot={theme.fill.carbs} value={data.carbs.value} target={data.carbs.target} />
        <CapRow name="Fat" value={data.fat.value} cap={data.fat.cap} />
      </Card>
      <Card>
        {data.rows.map((r) => (
          <View key={r.name} style={styles.previewRow}>
            <Text style={[styles.previewRowName, { color: theme.text.ink }]} allowFontScaling={false}>{r.name}</Text>
            <Text style={[styles.previewRowVal, { color: theme.text.ink }]} allowFontScaling={false}>{r.kcal}</Text>
          </View>
        ))}
      </Card>
      <View style={styles.previewNav}>
        {['Today', 'Log', 'Train', 'Rest'].map((l, i) => (
          <Text
            key={l}
            allowFontScaling={false}
            style={[styles.previewNavItem, { color: i === 0 ? theme.text.accent : theme.text.faint }]}
          >
            {theme.typography.labelCase === 'upper' ? l.toUpperCase() : l}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** One row: framed live preview + name/strap/description/uses + tick. */
function ThemeRow({
  id, current, state, data, onPress,
}: {
  id: ThemeId;
  current: ThemeId;
  state: PickerState;
  data: PreviewData;
  onPress: () => void;
}) {
  const { theme, density, textScale } = useTheme();
  const t = THEMES[id];
  const ticked = isTicked(state, id);
  const frameRef = useRef<View>(null);
  const key = `${previewCacheKey(id, data)}@${FRAME_W}`;  // size-busting: stale small bitmaps must not survive a frame resize
  const [shotUri, setShotUri] = useState<string | null>(shotCache.get(key) ?? null);

  // Capture once after first live render; later visits show the bitmap.
  useEffect(() => {
    if (shotUri || !captureRefFn) return;
    const timer = setTimeout(() => {
      void captureRefFn!(frameRef.current, { format: 'png', result: 'tmpfile', width: FRAME_W * 2, height: FRAME_H * 2 })
        .then((uri) => {
          shotCache.set(key, uri);
          setShotUri(uri);
        })
        .catch(() => { /* keep the live preview */ });
    }, 700);
    return () => clearTimeout(timer);
  }, [key, shotUri]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={rowAccessibilityLabel(id, state, current)}
      style={[
        styles.row,
        { backgroundColor: theme.surfaces.surface, borderColor: theme.surfaces.border, borderRadius: theme.shape.radius.md },
        ticked && { borderColor: theme.fill.accent, borderWidth: 1.5 },
      ]}
    >
      <View ref={frameRef} collapsable={false} style={styles.frame}>
        {shotUri ? (
          <Image source={{ uri: shotUri }} style={styles.frameImage} />
        ) : (
          <View pointerEvents="none" style={styles.frameScaler}>
            <ThemeProvider theme={t} density={density} textScale={textScale}>
              <TodayMiniPreview id={id} data={data} />
            </ThemeProvider>
          </View>
        )}
      </View>
      <View style={styles.info}>
        <Text style={[styles.name, { color: theme.text.ink }]}>{t.name}</Text>
        <Text style={[styles.strap, { color: theme.text.faint }]}>
          {strapFor(id)}{id === current ? ' · current' : ''}
        </Text>
        <Text style={[styles.desc, { color: theme.text.ink2 }]}>{t.description}</Text>
        {usesLine(id) ? <Text style={[styles.uses, { color: theme.text.faint }]}>{usesLine(id)}</Text> : null}
      </View>
      <View
        style={[
          styles.tick,
          { borderColor: theme.surfaces.borderStrong },
          ticked && { backgroundColor: theme.fill.mark, borderColor: theme.fill.mark },
        ]}
      >
        {ticked ? <Text style={[styles.tickGlyph, { color: theme.fill.markOn }]} allowFontScaling={false}>✓</Text> : null}
      </View>
    </Pressable>
  );
}

/**
 * The picker list — shared by the Settings modal and the onboarding step.
 * Selection state lives with the caller so both flows own their semantics.
 */
export function ThemePickerList({
  current, state, onSelect, data,
}: {
  current: ThemeId;
  state: PickerState;
  onSelect: (id: ThemeId) => void;
  data: PreviewData;
}) {
  return (
    <FlatList
      data={[...THEME_IDS]}
      keyExtractor={(id) => id}
      initialNumToRender={3}
      windowSize={5}
      renderItem={({ item }) => (
        <ThemeRow id={item} current={current} state={state} data={data} onPress={() => onSelect(item)} />
      )}
      contentContainerStyle={styles.listContent}
    />
  );
}

/** Settings entry point — full-screen modal with the staged-confirm flow. */
export function ThemePickerModal({
  open, onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const profile = useAppStore((s) => s.profile);
  const targets = useAppStore((s) => s.targets);
  const refreshCore = useAppStore((s) => s.refreshCore);
  const current: ThemeId = (profile?.theme as ThemeId) ?? 'minimal';
  const [state, setState] = useState<PickerState>(initialPicker);
  const [data, setData] = useState<PreviewData>(SAMPLE_PREVIEW);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setState(initialPicker);
      return;
    }
    // The previews' typefaces, warmed once; rows re-render as fonts land.
    for (const id of THEME_IDS) void loadExpressiveFonts(id);
    void (async () => {
      const [totals, entries] = await Promise.all([
        getDailyTotals(supabase),
        getFoodEntriesForDay(supabase),
      ]);
      if (!totals.ok || !targets) return; // sample stays
      setData(previewDataFrom({
        calories: totals.data.calories,
        targetCalories: targets.calories,
        protein: totals.data.protein, proteinTarget: targets.proteinG,
        carbs: totals.data.carbs, carbsTarget: targets.carbsG,
        fat: totals.data.fat, fatTarget: targets.fatG,
        entries: entries.ok ? entries.data.map((e) => ({ name: e.foodName, kcal: e.calories })) : [],
      }));
    })();
  }, [open, targets]);

  const staged = confirmTheme(state);

  const confirm = async () => {
    if (!staged || busy) return;
    setBusy(true);
    logThemeLayoutEvent({ type: 'theme_selected', theme: staged, previous: current });
    const { saveProfile } = await import('@basalt/core-data');
    await saveProfile(supabase, { theme: staged });
    await refreshCore();
    setBusy(false);
    onClose();
  };

  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.screen, { backgroundColor: theme.surfaces.bg, paddingTop: insets.top + 8 }]}>
        <View style={styles.head}>
          <Pressable onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="button" accessibilityLabel="Back to settings, discards selection">
            <Text style={[styles.back, { color: theme.text.mute }]}>‹ Settings</Text>
          </Pressable>
          <Text style={[styles.headTitle, { color: theme.text.ink }]}>Theme</Text>
        </View>
        <Text style={[styles.sub, { color: theme.text.faint }]}>
          {data.sample
            ? 'Previews use sample numbers — log a day and they use yours. Nothing changes until you confirm.'
            : 'Previews use your own numbers from today. Nothing changes until you confirm.'}
        </Text>
        <ThemePickerList
          current={current}
          state={state}
          data={data}
          onSelect={(id) => setState((s) => selectTheme(s, id, current))}
        />
        {staged ? (
          <View
            accessibilityLiveRegion="polite"
            accessibilityLabel={`${THEMES[staged].name} selected. Confirm to apply.`}
            style={[styles.bar, { backgroundColor: theme.surfaces.surface, borderColor: theme.surfaces.border, paddingBottom: 10 + insets.bottom }]}
          >
            <Text style={[styles.barText, { color: theme.text.ink2 }]}>
              {THEMES[staged].name} selected
            </Text>
            <Pressable
              onPress={() => void confirm()}
              disabled={busy}
              accessibilityRole="button"
              style={[styles.confirmBtn, { backgroundColor: theme.fill.mark, borderRadius: theme.shape.radius.sm }, busy && { opacity: 0.5 }]}
            >
              <Text style={[styles.confirmText, { color: theme.fill.markOn }]}>{busy ? '…' : 'Confirm'}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingBottom: 4 },
  back: { fontFamily: mono, fontSize: 13 },
  headTitle: { fontSize: 18, fontWeight: '600' },
  sub: { fontFamily: mono, fontSize: 10.5, lineHeight: 15, paddingHorizontal: 16, paddingVertical: 8 },
  listContent: { paddingHorizontal: 12, paddingBottom: 24, gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderWidth: 1,
    minHeight: FRAME_H + 16,
  },
  frame: { width: FRAME_W, height: FRAME_H, borderRadius: 5, overflow: 'hidden', backgroundColor: '#000' },
  frameImage: { width: FRAME_W, height: FRAME_H },
  frameScaler: {
    width: PREVIEW_W,
    height: PREVIEW_H,
    transform: [
      { translateX: -(PREVIEW_W * (1 - SCALE)) / 2 },
      { translateY: -(PREVIEW_H * (1 - SCALE)) / 2 },
      { scale: SCALE },
    ],
  },
  info: { flex: 1, minWidth: 0 },
  name: { fontSize: 13.5, fontWeight: '600' },
  strap: { fontFamily: mono, fontSize: 10.5, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 1 },
  desc: { fontSize: 11, lineHeight: 15, marginTop: 3 },
  uses: { fontSize: 10.5, marginTop: 3 },
  tick: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  tickGlyph: { fontSize: 13, fontWeight: '700' },
  bar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 10,
  },
  barText: { fontSize: 13 },
  confirmBtn: { paddingVertical: 11, paddingHorizontal: 20, minHeight: 44, justifyContent: 'center' },
  confirmText: { fontSize: 13, fontWeight: '700' },

  // ── miniature Today ────────────────────────────────────────────────────
  previewRoot: { flex: 1, paddingHorizontal: 14, paddingTop: 12, gap: 10 },
  previewHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 },
  previewTitle: { fontSize: 20, fontWeight: '600' },
  previewDate: { fontFamily: mono, fontSize: 11 },
  previewRingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7 },
  previewRowName: { fontSize: 13 },
  previewRowVal: { fontSize: 13, fontWeight: '600' },
  previewNav: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 'auto', paddingVertical: 12 },
  previewNavItem: { fontSize: 11, fontWeight: '600' },
});
