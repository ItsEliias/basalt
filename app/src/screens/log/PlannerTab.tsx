import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Card, EmptyState, SrcNote, ReceiptHeader, ReceiptRow, MealTag, CTA, ChipRow, groupInt, mono, useTheme, ScaledText as Text } from '@basalt/ui';
import {
  listMealPlans, addMealPlan, deleteMealPlan, listRecipes, getRecipeDetail, logRecipeServing,
  listGroceryItems, setGroceryChecked, clearCheckedGroceries, groupByAisle, fmtQty,
  loadPlanOutcomes, OUTCOME_TEXT,
  type MealPlan, type Recipe, type GroceryItem, type MealType, type ReconciledPlan,
} from '@basalt/nutrition';
import { isoDay, todayISO } from '@basalt/core-data';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../state/appStore';

// Planner — this week's planned meals (loggable in one tap) and the
// aisle-grouped, quantity-consolidated grocery list.

const SLOTS: { key: MealType; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snacks', label: 'Snacks' },
];

function nextDays(n: number): { date: string; label: string }[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      date: isoDay(d),
      label:
        i === 0
          ? `${d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric' })} · Today`
          : d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric' }),
    };
  });
}

export function PlannerTab() {
  const { theme } = useTheme();
  const bumpToday = useAppStore((s) => s.bumpToday);
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [grocery, setGrocery] = useState<GroceryItem[]>([]);
  const [reconciled, setReconciled] = useState<ReconciledPlan[]>([]);
  const [adding, setAdding] = useState(false);
  const [addDate, setAddDate] = useState(nextDays(1)[0]!.date);
  const [addSlot, setAddSlot] = useState<MealType>('dinner');

  const days = nextDays(7);

  const refresh = useCallback(async () => {
    const today = todayISO();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 6);
    const [p, r, g, rec] = await Promise.all([
      listMealPlans(supabase, days[0]!.date, days[days.length - 1]!.date),
      listRecipes(supabase),
      listGroceryItems(supabase),
      loadPlanOutcomes(supabase, isoDay(weekAgo), today, today),
    ]);
    if (p.ok) setPlans(p.data);
    if (r.ok) setRecipes(r.data);
    if (g.ok) setGrocery(g.data);
    if (rec.ok) setReconciled(rec.data.filter((x) => x.outcome !== 'pending'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const recipeFor = (id: string | null) => recipes.find((r) => r.id === id);

  const logPlan = async (plan: MealPlan) => {
    const recipe = recipeFor(plan.recipeId);
    if (!recipe) return;
    const full = await getRecipeDetail(supabase, recipe.id);
    const r = await logRecipeServing(supabase, full.ok ? full.data : recipe, plan.mealSlot, plan.serves);
    if (r.ok) bumpToday();
  };

  const checkedCount = grocery.filter((g) => g.checked).length;

  return (
    <ScrollView style={[styles.scroll, { backgroundColor: theme.surfaces.bg }]} contentContainerStyle={styles.content}>
      {/* ── This week ──────────────────────────────────────────────── */}
      <Card>
        <ReceiptHeader
          label="This week"
          summary={`${days[0]!.label.split(' · ')[0]} → ${days[days.length - 1]!.label}`}
        />
        {days.map((day) => {
          const dayPlans = plans.filter((p) => p.date === day.date);
          if (dayPlans.length === 0 && day.date !== days[0]!.date) return null;
          return (
            <View key={day.date}>
              <MealTag>{day.label}</MealTag>
              {dayPlans.length > 0 ? (
                dayPlans.map((p) => {
                  const recipe = recipeFor(p.recipeId);
                  return (
                    <Pressable key={p.id} onPress={() => void logPlan(p)} onLongPress={() => void deleteMealPlan(supabase, p.id).then(refresh)} hitSlop={8}>
                      <ReceiptRow
                        name={recipe?.title ?? p.note ?? 'Planned meal'}
                        meta={`${p.mealSlot} · ×${p.serves} ${p.serves === 1 ? 'serve' : 'serves'} · tap to log · hold to remove`}
                        value={recipe ? groupInt(recipe.caloriesPerServe * p.serves) : undefined}
                        unit={recipe ? 'kcal' : undefined}
                      />
                    </Pressable>
                  );
                })
              ) : (
                <ReceiptRow name="Unplanned" meta="no meal scheduled" value="—" valueColor={theme.text.faint} />
              )}
            </View>
          );
        })}
        {recipes.length > 0 ? (
          adding ? (
            <View style={{ marginTop: 12 }}>
              <Text style={[styles.microLabel, { color: theme.text.mute }]}>DAY</Text>
              <ChipRow
                options={days.map((d) => d.label)}
                value={days.find((d) => d.date === addDate)?.label}
                onChange={(label) => setAddDate(days.find((d) => d.label === label)!.date)}
              />
              <Text style={[styles.microLabel, { color: theme.text.mute }]}>SLOT</Text>
              <ChipRow
                options={SLOTS.map((s) => s.label)}
                value={SLOTS.find((s) => s.key === addSlot)?.label}
                onChange={(label) => setAddSlot(SLOTS.find((s) => s.label === label)!.key)}
              />
              <Text style={[styles.microLabel, { color: theme.text.mute }]}>RECIPE</Text>
              {recipes.slice(0, 8).map((r) => (
                <Pressable
                  key={r.id}
                  onPress={async () => {
                    await addMealPlan(supabase, { date: addDate, mealSlot: addSlot, recipeId: r.id });
                    setAdding(false);
                    void refresh();
                  }}
                  hitSlop={8}
                >
                  <ReceiptRow name={r.title} meta={`serves ${r.serves}`} value="plan" valueColor={theme.text.faint} />
                </Pressable>
              ))}
              <Pressable onPress={() => setAdding(false)}>
                <Text style={[styles.cancel, { color: theme.text.faint }]}>CANCEL</Text>
              </Pressable>
            </View>
          ) : (
            <CTA label="Plan a meal" onPress={() => setAdding(true)} />
          )
        ) : (
          <SrcNote>Save a recipe first — planning starts from your recipes</SrcNote>
        )}
      </Card>

      {/* ── Planned vs eaten — trailing week, facts only ───────────── */}
      {reconciled.length > 0 ? (
        <Card>
          <ReceiptHeader label="Planned vs eaten" summary="last 7 days" />
          {reconciled.map((p, i) => (
            <ReceiptRow
              key={p.id}
              name={p.recipeTitle ?? p.note ?? 'Planned meal'}
              meta={`${new Date(`${p.date}T00:00:00`).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric' })} · ${p.mealSlot}`}
              value={OUTCOME_TEXT[p.outcome]}
              valueColor={p.outcome === 'as_planned' ? theme.text.carbs : p.outcome === 'not_logged' ? theme.text.faint : theme.text.ink2}
              last={i === reconciled.length - 1}
            />
          ))}
          <SrcNote>Reconciled from the diary · a swap is a fact, not a fault · today stays pending until it's over</SrcNote>
        </Card>
      ) : null}

      {/* ── Grocery list ───────────────────────────────────────────── */}
      <Card>
        <ReceiptHeader
          label="Grocery list"
          summary={grocery.length > 0 ? `${grocery.length} items · ${checkedCount} checked` : undefined}
        />
        {grocery.length > 0 ? (
          <>
            {groupByAisle(grocery).map((group) => (
              <View key={group.aisle}>
                <MealTag>{group.aisle}</MealTag>
                {group.items.map((item) => (
                  <Pressable
                    key={item.id}
                    style={[styles.checkRow, { borderBottomColor: theme.surfaces.border }]}
                    onPress={async () => {
                      await setGroceryChecked(supabase, item.id, !item.checked);
                      void refresh();
                    }}
                  >
                    <View style={[styles.box, { borderColor: theme.surfaces.borderStrong }, item.checked && { backgroundColor: theme.surfaces.surface2, borderColor: theme.fill.faint }]}>
                      {item.checked ? <Text style={[styles.boxTick, { color: theme.text.mute }]}>✓</Text> : null}
                    </View>
                    <Text style={[styles.qty, { color: theme.text.ink2 }, item.checked && [styles.strike, { color: theme.text.faint }]]}>{fmtQty(item.qty, item.unit)}</Text>
                    <Text style={[styles.ing, { color: theme.text.ink }, item.checked && [styles.strike, { color: theme.text.faint }]]}>{item.name}</Text>
                  </Pressable>
                ))}
              </View>
            ))}
            {checkedCount > 0 ? (
              <CTA label={`Clear ${checkedCount} checked`} onPress={async () => {
                await clearCheckedGroceries(supabase);
                void refresh();
              }} />
            ) : null}
            <SrcNote>Quantities consolidated across recipes · units normalised · grouped by aisle · tap to check off in-store</SrcNote>
          </>
        ) : (
          <EmptyState>
            Empty list. Open a recipe, check off what you already have, and add the rest here.
          </EmptyState>
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 24 },
  microLabel: { fontFamily: mono, fontSize: 11, letterSpacing: 1.14, marginTop: 14 },
  cancel: { fontFamily: mono, fontSize: 11, letterSpacing: 1.2, textAlign: 'center', paddingVertical: 12 },
  checkRow: { flexDirection: 'row', alignItems: 'baseline', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  box: { width: 14, height: 14, borderWidth: 1, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  boxTick: { fontSize: 11, lineHeight: 11 },
  qty: { fontFamily: mono, fontSize: 12, minWidth: 74, fontVariant: ['tabular-nums'] },
  ing: { fontSize: 14, flexShrink: 1 },
  strike: { textDecorationLine: 'line-through' },
});
