import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  Card, EmptyState, SrcNote, ReceiptHeader, ReceiptRow, MealTag, CTA, ChipRow,
  groupInt, color, mono,
} from '@basalt/ui';
import {
  listMealPlans, addMealPlan, deleteMealPlan, listRecipes, getRecipeDetail, logRecipeServing,
  listGroceryItems, setGroceryChecked, clearCheckedGroceries, groupByAisle, fmtQty,
  type MealPlan, type Recipe, type GroceryItem, type MealType,
} from '@basalt/nutrition';
import { isoDay } from '@basalt/core-data';
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
  const bumpToday = useAppStore((s) => s.bumpToday);
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [grocery, setGrocery] = useState<GroceryItem[]>([]);
  const [adding, setAdding] = useState(false);
  const [addDate, setAddDate] = useState(nextDays(1)[0]!.date);
  const [addSlot, setAddSlot] = useState<MealType>('dinner');

  const days = nextDays(7);

  const refresh = useCallback(async () => {
    const [p, r, g] = await Promise.all([
      listMealPlans(supabase, days[0]!.date, days[days.length - 1]!.date),
      listRecipes(supabase),
      listGroceryItems(supabase),
    ]);
    if (p.ok) setPlans(p.data);
    if (r.ok) setRecipes(r.data);
    if (g.ok) setGrocery(g.data);
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
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
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
                    <Pressable key={p.id} onPress={() => void logPlan(p)} onLongPress={() => void deleteMealPlan(supabase, p.id).then(refresh)}>
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
                <ReceiptRow name="Unplanned" meta="no meal scheduled" value="—" valueColor={color.faint} />
              )}
            </View>
          );
        })}
        {recipes.length > 0 ? (
          adding ? (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.microLabel}>DAY</Text>
              <ChipRow
                options={days.map((d) => d.label)}
                value={days.find((d) => d.date === addDate)?.label}
                onChange={(label) => setAddDate(days.find((d) => d.label === label)!.date)}
              />
              <Text style={styles.microLabel}>SLOT</Text>
              <ChipRow
                options={SLOTS.map((s) => s.label)}
                value={SLOTS.find((s) => s.key === addSlot)?.label}
                onChange={(label) => setAddSlot(SLOTS.find((s) => s.label === label)!.key)}
              />
              <Text style={styles.microLabel}>RECIPE</Text>
              {recipes.slice(0, 8).map((r) => (
                <Pressable
                  key={r.id}
                  onPress={async () => {
                    await addMealPlan(supabase, { date: addDate, mealSlot: addSlot, recipeId: r.id });
                    setAdding(false);
                    void refresh();
                  }}
                >
                  <ReceiptRow name={r.title} meta={`serves ${r.serves}`} value="plan" valueColor={color.faint} />
                </Pressable>
              ))}
              <Pressable onPress={() => setAdding(false)}>
                <Text style={styles.cancel}>CANCEL</Text>
              </Pressable>
            </View>
          ) : (
            <CTA label="Plan a meal" onPress={() => setAdding(true)} />
          )
        ) : (
          <SrcNote>Save a recipe first — planning starts from your recipes</SrcNote>
        )}
      </Card>

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
                    style={styles.checkRow}
                    onPress={async () => {
                      await setGroceryChecked(supabase, item.id, !item.checked);
                      void refresh();
                    }}
                  >
                    <View style={[styles.box, item.checked && styles.boxDone]}>
                      {item.checked ? <Text style={styles.boxTick}>✓</Text> : null}
                    </View>
                    <Text style={[styles.qty, item.checked && styles.strike]}>{fmtQty(item.qty, item.unit)}</Text>
                    <Text style={[styles.ing, item.checked && styles.strike]}>{item.name}</Text>
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
  scroll: { flex: 1, backgroundColor: color.bg },
  content: { paddingHorizontal: 16, paddingBottom: 24 },
  microLabel: { fontFamily: mono, fontSize: 9.5, letterSpacing: 1.14, color: color.mute, marginTop: 14 },
  cancel: { fontFamily: mono, fontSize: 10, letterSpacing: 1.2, color: color.faint, textAlign: 'center', paddingVertical: 12 },
  checkRow: { flexDirection: 'row', alignItems: 'baseline', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.border },
  box: { width: 14, height: 14, borderWidth: 1, borderColor: color.border2, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  boxDone: { backgroundColor: color.surface2, borderColor: color.faint },
  boxTick: { fontSize: 9, color: color.mute, lineHeight: 11 },
  qty: { fontFamily: mono, fontSize: 12, color: color.ink2, minWidth: 74, fontVariant: ['tabular-nums'] },
  ing: { fontSize: 13, color: color.ink, flexShrink: 1 },
  strike: { color: color.faint, textDecorationLine: 'line-through' },
});
