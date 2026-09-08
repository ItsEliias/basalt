import { useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { CTA, EmptyState, KV, SrcNote, mono, useTheme, ScaledText as Text } from '@basalt/ui';
import {
  addToPlate, removeFromPlate, setFactor, stepFactor, factorFromDrag,
  plateTotals, plateEntries, itemRadius, factorText,
  type PlateEntry, type PlateFood, type PlateItem, PLATE_MAX_ITEMS,
} from './model';

// The plate — drag a food's circle up/down to size its portion (the +/−
// steppers do the same in accessible 0.25 steps). Numbers update live and
// commit as ordinary entries via the callback the host screen provides;
// this package never talks to the service layer itself.

const PLATE_R = 150;
const SLOTS: [number, number][] = [
  [0, -0.42], [0.4, -0.12], [-0.4, -0.12], [0.22, 0.34], [-0.22, 0.34], [0, 0.05],
];

function PlateItemCircle({ item, index, onFactor }: {
  item: PlateItem;
  index: number;
  onFactor: (key: string, factor: number) => void;
}) {
  const { theme } = useTheme();
  const startFactor = useRef(item.factor);
  const factorRef = useRef(item.factor);
  factorRef.current = item.factor;
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { startFactor.current = factorRef.current; },
      onPanResponderMove: (_e, g) => onFactor(item.food.key, factorFromDrag(startFactor.current, g.dy)),
    }),
  ).current;
  const [sx, sy] = SLOTS[index] ?? [0, 0];
  const r = itemRadius(item.factor);
  return (
    <View
      {...pan.panHandlers}
      style={[
        styles.item,
        {
          left: PLATE_R + sx * 2 * PLATE_R - r,
          top: PLATE_R + sy * 2 * PLATE_R - r,
          width: r * 2,
          height: r * 2,
          borderRadius: r,
          backgroundColor: theme.surfaces.surface2,
          borderColor: theme.fill.accent,
        },
      ]}
      accessibilityRole="adjustable"
      accessibilityLabel={`${item.food.foodName}, portion ×${factorText(item.factor)}`}
    >
      <Text style={[styles.itemName, { color: theme.text.ink }]} numberOfLines={2} allowFontScaling={false}>
        {item.food.foodName}
      </Text>
      <Text style={[styles.itemFactor, { color: theme.text.mute }]} allowFontScaling={false}>
        ×{factorText(item.factor)}
      </Text>
    </View>
  );
}

export function PlateBuilder({ recentFoods, onCommit, busy }: {
  /** The user's recent/favorite foods, host-loaded. */
  recentFoods: PlateFood[];
  /** Commits the scaled entries through the ordinary write path. */
  onCommit: (entries: PlateEntry[]) => void;
  busy?: boolean;
}) {
  const { theme } = useTheme();
  const [items, setItems] = useState<PlateItem[]>([]);
  const totals = plateTotals(items);
  const onFactor = (key: string, f: number) => setItems((it) => setFactor(it, key, f));

  if (recentFoods.length === 0) {
    return <EmptyState>No recent foods yet — the plate builds from what you’ve logged before. Log a few meals any other way first.</EmptyState>;
  }

  return (
    <View>
      <View style={styles.plateWrap}>
        <Svg width={PLATE_R * 2} height={PLATE_R * 2}>
          <Circle cx={PLATE_R} cy={PLATE_R} r={PLATE_R - 2} stroke={theme.surfaces.borderStrong} strokeWidth={2} fill={theme.surfaces.surface} />
          <Circle cx={PLATE_R} cy={PLATE_R} r={PLATE_R - 26} stroke={theme.surfaces.border} strokeWidth={1} fill="none" />
        </Svg>
        {items.map((item, i) => (
          <PlateItemCircle key={item.food.key} item={item} index={i} onFactor={onFactor} />
        ))}
      </View>

      {items.map((item) => (
        <View key={item.food.key} style={[styles.row, { borderTopColor: theme.surfaces.border }]}>
          <Text style={[styles.rowName, { color: theme.text.ink }]} numberOfLines={1}>{item.food.foodName}</Text>
          <Pressable hitSlop={14} onPress={() => setItems((it) => stepFactor(it, item.food.key, -1))} accessibilityRole="button" accessibilityLabel={`Smaller ${item.food.foodName}`}>
            <Text style={[styles.step, { color: theme.text.accent }]}>−</Text>
          </Pressable>
          <Text style={[styles.rowVal, { color: theme.text.ink2 }]}>
            ×{factorText(item.factor)} · {Math.round(item.food.calories * item.factor)} kcal
          </Text>
          <Pressable hitSlop={14} onPress={() => setItems((it) => stepFactor(it, item.food.key, 1))} accessibilityRole="button" accessibilityLabel={`Bigger ${item.food.foodName}`}>
            <Text style={[styles.step, { color: theme.text.accent }]}>+</Text>
          </Pressable>
          <Pressable hitSlop={14} onPress={() => setItems((it) => removeFromPlate(it, item.food.key))} accessibilityRole="button" accessibilityLabel={`Remove ${item.food.foodName}`}>
            <Text style={[styles.step, { color: theme.text.faint }]}>✕</Text>
          </Pressable>
        </View>
      ))}

      <Text style={[styles.pickerLabel, { color: theme.text.mute }]}>RECENT FOODS — TAP TO ADD ({items.length}/{PLATE_MAX_ITEMS})</Text>
      <View style={styles.pickerWrap}>
        {recentFoods.slice(0, 12).map((f) => {
          const onPlate = items.some((i) => i.food.key === f.key);
          return (
            <Pressable
              key={f.key}
              onPress={() => setItems((it) => addToPlate(it, f))}
              disabled={onPlate || items.length >= PLATE_MAX_ITEMS}
              hitSlop={8}
              style={[
                styles.chip,
                { borderColor: theme.surfaces.borderStrong, backgroundColor: onPlate ? theme.surfaces.surface2 : 'transparent', opacity: onPlate ? 0.55 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Add ${f.foodName} to the plate`}
            >
              <Text style={[styles.chipText, { color: theme.text.ink2 }]} numberOfLines={1}>{f.foodName}</Text>
            </Pressable>
          );
        })}
      </View>

      {items.length > 0 ? (
        <>
          <KV label="Plate total" right={`${totals.calories} kcal · P ${totals.protein} · C ${totals.carbs} · F ${totals.fat}`} />
          <CTA
            label={busy ? 'Logging…' : `Log ${items.length} ${items.length === 1 ? 'entry' : 'entries'}`}
            disabled={!!busy}
            onPress={() => onCommit(plateEntries(items))}
          />
        </>
      ) : null}
      <SrcNote>Portions scale your own saved foods · every item commits as an ordinary entry, editable like any other · drag a circle or use − / +</SrcNote>
    </View>
  );
}

const styles = StyleSheet.create({
  plateWrap: { width: PLATE_R * 2, height: PLATE_R * 2, alignSelf: 'center', marginVertical: 10 },
  item: { position: 'absolute', borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', padding: 4 },
  itemName: { fontSize: 11, textAlign: 'center', lineHeight: 13 },
  itemFactor: { fontFamily: mono, fontSize: 10.5, marginTop: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  rowName: { flex: 1, fontSize: 14 },
  rowVal: { fontFamily: mono, fontSize: 12.5, minWidth: 118, textAlign: 'center' },
  step: { fontSize: 20, fontWeight: '600', paddingHorizontal: 6 },
  pickerLabel: { fontFamily: mono, fontSize: 11, letterSpacing: 1.32, marginTop: 14, marginBottom: 8 },
  pickerWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, maxWidth: 180 },
  chipText: { fontSize: 12.5 },
});
