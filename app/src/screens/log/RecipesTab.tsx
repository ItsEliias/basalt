import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  Card, EmptyState, SrcNote, ReceiptHeader, ReceiptRow, SearchBar, CTA, Stepper,
  ChipRow, ObInput, ObChipLabel, NewRow, approxValue, groupInt,
  color, mono, useTheme,
  ScaledText as Text,
} from '@basalt/ui';
import {
  importRecipeFromUrl, draftFromImport, saveRecipe, listRecipes, getRecipeDetail, deleteRecipe,
  confirmRecipeMacros, logRecipeServing, addToGroceryList, ingredientConflicts,
  scaleQty, fmtQty, signedRecipePhotoUrls,
  type Recipe, type RecipeDetail, type SaveRecipeInput, type MealType,
  isSocialRecipeUrl, parseQtyText, type SocialRecipeResponse,
} from '@basalt/nutrition';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../state/appStore';

// Recipes — persisted, scalable, conflict-flagged, loggable. Imports follow
// capture → editable suggestion → confirm; imported macros wear ~ until
// confirmed.

export function RecipesTab() {
  const { theme } = useTheme();
  const profile = useAppStore((s) => s.profile);
  const bumpToday = useAppStore((s) => s.bumpToday);
  const dietaryFlags = profile?.dietaryFlags ?? [];

  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [recipesFailed, setRecipesFailed] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<Map<string, string>>(new Map());
  const [detailPhotoUrl, setDetailPhotoUrl] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [draft, setDraft] = useState<SaveRecipeInput | null>(null);
  const [detail, setDetail] = useState<RecipeDetail | null>(null);
  const [serves, setServes] = useState(1);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [groceryNote, setGroceryNote] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setRecipesFailed(false);
    void listRecipes(supabase).then((r) => (r.ok ? setRecipes(r.data) : setRecipesFailed(true)));
  }, []);
  useEffect(() => refresh(), [refresh]);

  useEffect(() => {
    const paths = (recipes ?? []).map((r) => r.coverPath).filter((p): p is string => !!p);
    if (paths.length === 0) {
      setPhotoUrls(new Map());
      return;
    }
    void signedRecipePhotoUrls(supabase, paths).then((r) => r.ok && setPhotoUrls(r.data));
  }, [recipes]);

  const runImport = async () => {
    const url = importUrl.trim();
    if (!url) return;
    setImporting(true);
    setImportError(null);

    // Social links go through the Edge Function (caption → structured
    // draft); ordinary recipe sites keep the on-device JSON-LD importer.
    if (isSocialRecipeUrl(url)) {
      const { data, error } = await supabase.functions.invoke('social-recipe-import', { body: { url } });
      setImporting(false);
      if (error) {
        let message = error.message ?? 'Import failed.';
        try {
          const ctx = (error as any).context;
          if (ctx && typeof ctx.json === 'function') {
            const body = await ctx.json();
            if (body?.error) message = body.error;
          }
        } catch { /* keep generic */ }
        setImportError(message);
        return;
      }
      const social = data as SocialRecipeResponse & { source_url: string };
      setDraft({
        title: social.title,
        serves: Math.max(1, Math.round(social.serves)),
        totalTimeMin: social.total_time_min,
        sourceUrl: social.source_url,
        source: 'social',
        caloriesPerServe: Math.round(social.calories_per_serve),
        proteinPerServe: Math.round(social.protein_per_serve * 10) / 10,
        carbsPerServe: Math.round(social.carbs_per_serve * 10) / 10,
        fatPerServe: Math.round(social.fat_per_serve * 10) / 10,
        macrosConfirmed: false,
        sourceImageUrl: social.cover_image_url,
        ingredients: social.ingredients.map((i) => ({
          qty: parseQtyText(i.quantity),
          unit: i.unit || null,
          name: i.name,
        })),
        steps: social.steps,
      });
      setImportUrl('');
      return;
    }

    const imp = await importRecipeFromUrl(url);
    setImporting(false);
    if (imp.error) {
      setImportError(imp.error);
      return;
    }
    setDraft(draftFromImport(imp));
    setImportUrl('');
  };

  const openDetail = async (id: string) => {
    const d = await getRecipeDetail(supabase, id);
    if (d.ok) {
      setDetail(d.data);
      setServes(d.data.serves);
      setChecked(new Set());
      setGroceryNote(null);
      setDetailPhotoUrl(null);
      if (d.data.coverPath) {
        void signedRecipePhotoUrls(supabase, [d.data.coverPath]).then(
          (r) => r.ok && setDetailPhotoUrl(r.data.get(d.data.coverPath!) ?? null),
        );
      }
    }
  };

  // ── Import draft editor ─────────────────────────────────────────────
  if (draft) {
    return (
      <ScrollView style={[styles.scroll, { backgroundColor: theme.surfaces.bg }]} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card>
          <ReceiptHeader label="Imported — edit before save" summary="~ until you confirm macros" />
          {draft.sourceImageUrl ? (
            <Image source={{ uri: draft.sourceImageUrl }} style={styles.draftCover} />
          ) : null}
          <ObInput placeholder="Title" value={draft.title} onChangeText={(title) => setDraft({ ...draft, title })} />
          <ObChipLabel>{`Serves ${draft.serves} · per-serve macros (from the source, unconfirmed)`}</ObChipLabel>
          <View style={styles.macroRow}>
            <NumField label="~kcal" value={draft.caloriesPerServe} onChange={(v) => setDraft({ ...draft, caloriesPerServe: v })} />
            <NumField label="~P g" value={draft.proteinPerServe} onChange={(v) => setDraft({ ...draft, proteinPerServe: v })} />
            <NumField label="~C g" value={draft.carbsPerServe} onChange={(v) => setDraft({ ...draft, carbsPerServe: v })} />
            <NumField label="~F g" value={draft.fatPerServe} onChange={(v) => setDraft({ ...draft, fatPerServe: v })} />
          </View>
          <SrcNote>
            {[
              `${draft.ingredients.length} ingredients · ${draft.steps.length} steps pulled from ${draft.sourceUrl ?? 'the source'}`,
              draft.sourceImageUrl ? 'cover downloads into your own storage on save' : null,
              'everything editable after save',
            ].filter(Boolean).join(' · ')}
          </SrcNote>
          <CTA label="Save recipe" onPress={async () => {
            const saved = await saveRecipe(supabase, draft);
            if (saved.ok) {
              setDraft(null);
              refresh();
            }
          }} />
          <Pressable onPress={() => setDraft(null)}>
            <Text style={styles.cancel}>DISCARD IMPORT</Text>
          </Pressable>
        </Card>
      </ScrollView>
    );
  }

  // ── Detail view ─────────────────────────────────────────────────────
  if (detail) {
    const conflicts = ingredientConflicts(detail.ingredients.map((i) => i.name), dietaryFlags);
    const uncheckedCount = detail.ingredients.length - checked.size;
    return (
      <ScrollView style={[styles.scroll, { backgroundColor: theme.surfaces.bg }]} contentContainerStyle={styles.content}>
        <Pressable onPress={() => setDetail(null)}>
          <Text style={styles.back}>← RECIPES</Text>
        </Pressable>
        <Card>
          {detailPhotoUrl ? <Image source={{ uri: detailPhotoUrl }} style={styles.detailCover} /> : null}
          <View style={styles.detailHead}>
            <Text style={styles.detailTitle}>{detail.title}</Text>
            {detail.totalTimeMin ? <Text style={styles.detailMeta}>{`${detail.totalTimeMin} MIN`}</Text> : null}
          </View>
          {conflicts.length > 0 ? (
            <Text style={styles.conflict}>
              {conflicts.map((c) => `${c.ingredient} — ${c.flag}`).join(' · ').toUpperCase()}
            </Text>
          ) : null}
          <View style={styles.servesRow}>
            <Text style={styles.microLabel}>MAKES</Text>
            <Stepper
              value={`${serves} serves`}
              onMinus={() => setServes((s) => Math.max(1, s - 1))}
              onPlus={() => setServes((s) => Math.min(16, s + 1))}
            />
          </View>
          <View style={styles.perServe}>
            <Text style={styles.microLabel}>PER SERVE</Text>
            <Text style={styles.perServeText}>
              {`${approxValue(detail.caloriesPerServe, detail.macrosConfirmed)} kcal · P ${Math.round(detail.proteinPerServe)} · C ${Math.round(detail.carbsPerServe)} · F ${Math.round(detail.fatPerServe)}`}
            </Text>
          </View>
          {!detail.macrosConfirmed ? (
            <CTA label="Confirm macros — drop the ~" onPress={async () => {
              const r = await confirmRecipeMacros(supabase, detail.id);
              if (r.ok) setDetail({ ...detail, macrosConfirmed: true });
            }} />
          ) : null}
          <SrcNote>
            {detail.sourceUrl
              ? `Source · ${detail.sourceUrl.replace(/^https?:\/\//, '').split('/')[0]} · macros ${detail.macrosConfirmed ? 'confirmed by you' : 'from the source, unconfirmed (~)'}`
              : 'Source · your recipe · macros editable'}
          </SrcNote>
        </Card>

        <Card>
          <ReceiptHeader label="Ingredients" summary="tap to check off what you have" />
          {detail.ingredients.map((ing, i) => {
            const done = checked.has(i);
            const scaled = scaleQty(ing.qty, detail.serves, serves);
            return (
              <Pressable
                key={ing.id}
                style={styles.checkRow}
                onPress={() => {
                  const next = new Set(checked);
                  if (done) next.delete(i); else next.add(i);
                  setChecked(next);
                }}
              >
                <View style={[styles.box, done && styles.boxDone]}>{done ? <Text style={styles.boxTick}>✓</Text> : null}</View>
                <Text style={[styles.qty, done && styles.strike]}>{fmtQty(scaled, ing.unit)}</Text>
                <Text style={[styles.ing, done && styles.strike]}>{ing.name}</Text>
              </Pressable>
            );
          })}
          <CTA
            label={uncheckedCount > 0 ? `Add ${uncheckedCount} to grocery list` : 'All ingredients on hand'}
            disabled={uncheckedCount === 0}
            onPress={async () => {
              const items = detail.ingredients
                .filter((_, i) => !checked.has(i))
                .map((ing) => ({ name: ing.name, qty: scaleQty(ing.qty, detail.serves, serves), unit: ing.unit }));
              const r = await addToGroceryList(supabase, items);
              if (r.ok) setGroceryNote(`${r.data.addedCount} added · ${r.data.mergedCount} consolidated into existing items`);
            }}
          />
          {groceryNote ? <SrcNote>{groceryNote}</SrcNote> : null}
        </Card>

        {detail.steps.length > 0 ? (
          <Card>
            <ReceiptHeader label="Method" summary={`${detail.steps.length} steps`} />
            {detail.steps.map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <Text style={styles.stepNum}>{String(i + 1).padStart(2, '0')}</Text>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </Card>
        ) : null}

        <Card>
          <ReceiptHeader label="Log a serving" summary="into today's diary" />
          <ChipRow
            options={['Breakfast', 'Lunch', 'Dinner', 'Snacks']}
            onChange={async (label) => {
              const meal = label.toLowerCase() as MealType;
              const r = await logRecipeServing(supabase, detail, meal, 1);
              if (r.ok) bumpToday();
            }}
          />
          <SrcNote>Logs one serve with the recipe's per-serve macros through the one food write path</SrcNote>
        </Card>
      </ScrollView>
    );
  }

  // ── List view ───────────────────────────────────────────────────────
  const filtered = (recipes ?? []).filter((r) => r.title.toLowerCase().includes(query.toLowerCase()));
  return (
    <ScrollView style={[styles.scroll, { backgroundColor: theme.surfaces.bg }]} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <SearchBar placeholder={`Search ${recipes?.length ?? 0} saved recipes…`} value={query} onChangeText={setQuery} />
      <View style={styles.importRow}>
        <ObInput
          placeholder="Paste a recipe URL — or a TikTok / Instagram / YouTube link"
          autoCapitalize="none"
          value={importUrl}
          onChangeText={setImportUrl}
          style={{ flex: 1 }}
        />
      </View>
      <CTA label={importing ? 'Importing…' : 'Import from URL'} disabled={importing || !importUrl.trim()} onPress={() => void runImport()} />
      {importError ? <Text style={styles.conflict}>{importError.toUpperCase()}</Text> : null}
      <SrcNote>JSON-LD import · TikTok/Instagram/YouTube links go through an AI-structured draft, source link kept · everything editable before save</SrcNote>

      <Card>
        <ReceiptHeader label="Saved recipes" summary={filtered.length > 0 ? 'per serve · scalable' : undefined} />
        {recipesFailed ? (
          <Pressable onPress={refresh} hitSlop={8}>
            <EmptyState>Couldn't load your recipes — tap to retry.</EmptyState>
          </Pressable>
        ) : recipes === null ? (
          <EmptyState>Loading…</EmptyState>
        ) : filtered.length > 0 ? (
          filtered.map((r, i) => {
            return (
              <Pressable
                key={r.id}
                onPress={() => void openDetail(r.id)}
                onLongPress={() => void deleteRecipe(supabase, r.id).then(refresh)}
                hitSlop={8}
              >
                <ReceiptRow
                  name={r.title}
                  thumb={
                    r.coverPath && photoUrls.get(r.coverPath) ? (
                      <Image source={{ uri: photoUrls.get(r.coverPath)! }} style={styles.rowThumb} />
                    ) : undefined
                  }
                  meta={[
                    `P ${Math.round(r.proteinPerServe)} · C ${Math.round(r.carbsPerServe)} · F ${Math.round(r.fatPerServe)}`,
                    `serves ${r.serves}`,
                    r.totalTimeMin ? `${r.totalTimeMin} min` : null,
                    r.source === 'jsonld' ? 'imported' : null,
                    'hold to remove',
                  ].filter(Boolean).join(' · ')}
                  value={approxValue(r.caloriesPerServe, r.macrosConfirmed)}
                  unit="kcal"
                  last={i === filtered.length - 1}
                />
              </Pressable>
            );
          })
        ) : (
          <EmptyState>
            No recipes yet. Import one from a URL above, and it lands here scalable, conflict-checked
            and loggable.
          </EmptyState>
        )}
      </Card>
      <SrcNote>Imports keep their source link · dietary conflicts flagged per-ingredient, never hidden</SrcNote>
    </ScrollView>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.numLabel}>{label.toUpperCase()}</Text>
      <ObInput
        keyboardType="decimal-pad"
        value={value ? String(value) : ''}
        onChangeText={(t) => {
          const n = parseFloat(t.replace(',', '.'));
          onChange(isFinite(n) ? n : 0);
        }}
        placeholder="0"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: color.bg },
  content: { paddingHorizontal: 16, paddingBottom: 24 },
  importRow: { flexDirection: 'row' },
  back: { fontFamily: mono, fontSize: 11, letterSpacing: 1.2, color: color.mute, paddingTop: 12, paddingHorizontal: 4 },
  detailHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 },
  detailTitle: { fontSize: 15, fontWeight: '600', letterSpacing: -0.15, color: color.ink, flexShrink: 1 },
  detailMeta: { fontFamily: mono, fontSize: 11.5, color: color.faint, letterSpacing: 0.6 },
  conflict: { fontFamily: mono, fontSize: 11, color: color.fat, marginTop: 10, letterSpacing: 0.38, lineHeight: 15 },
  servesRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  perServe: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 14 },
  perServeText: { fontFamily: mono, fontSize: 12, color: color.ink2, fontVariant: ['tabular-nums'] },
  microLabel: { fontFamily: mono, fontSize: 11, fontWeight: '600', letterSpacing: 1.2, color: color.mute },
  checkRow: { flexDirection: 'row', alignItems: 'baseline', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.border },
  box: { width: 14, height: 14, borderWidth: 1, borderColor: color.border2, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  boxDone: { backgroundColor: color.surface2, borderColor: color.faint },
  boxTick: { fontSize: 11, color: color.mute, lineHeight: 11 },
  qty: { fontFamily: mono, fontSize: 12, color: color.ink2, minWidth: 74, fontVariant: ['tabular-nums'] },
  ing: { fontSize: 14, color: color.ink, flexShrink: 1 },
  strike: { color: color.faint, textDecorationLine: 'line-through' },
  stepRow: { flexDirection: 'row', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.border },
  stepNum: { fontFamily: mono, fontSize: 11, color: color.faint, position: 'relative', top: 3 },
  stepText: { fontSize: 14, lineHeight: 21, color: color.ink2, flexShrink: 1 },
  macroRow: { flexDirection: 'row', gap: 8 },
  rowThumb: { width: 30, height: 30, borderRadius: 7, backgroundColor: color.surface2 },
  draftCover: { width: '100%', height: 160, borderRadius: 10, backgroundColor: color.surface2, marginTop: 12 },
  detailCover: { width: '100%', height: 180, borderRadius: 10, backgroundColor: color.surface2, marginBottom: 12 },
  numLabel: { fontFamily: mono, fontSize: 11, letterSpacing: 0.9, color: color.faint, marginTop: 12, marginBottom: -4 },
  cancel: { fontFamily: mono, fontSize: 11, letterSpacing: 1.2, color: color.faint, textAlign: 'center', paddingVertical: 12 },
});
