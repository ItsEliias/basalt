import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  Card, EmptyState, SrcNote, ReceiptHeader, ReceiptRow, SearchBar, CTA, SubNav, ObInput,
  color, mono, groupInt, useTheme,
  ScaledText as Text,
} from '@basalt/ui';
import { RecipesTab } from './RecipesTab';
import { PlannerTab } from './PlannerTab';
import {
  validateGs1, searchByBarcode, searchByName, addFoodEntry, recordFoodUse,
  getFoodEntriesForDay, listFavorites, frequentAtHour,
  type OFFProduct, type FoodEntryInput, type FoodFavorite, type LoggedFood,
  uploadFoodPhoto,
} from '@basalt/nutrition';
import { isoDay } from '@basalt/core-data';
import type { MealType } from '@basalt/nutrition';

type AiItem = {
  food_name: string;
  meal_guess: MealType;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  portion_note: string;
};
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../state/appStore';
import {
  barcodeDisplay, offToEntryInput, qualityLine, resultMeta, dietaryConflicts,
  conflictLine, mealForHour, yesterdayMeals, type YesterdayMeal,
  labelToDraftFields, type LabelScan,
} from './model';
import { AddEntryForm, type DraftEntry } from './AddEntryForm';
import { capturePhoto, enqueuePhoto, dequeuePhoto, loadPhotoQueue, readQueuedPhotoB64 } from '../../lib/photoFood';
import { queuedLabel, type QueuedPhoto } from '../../lib/photoQueueModel';

// Log / Capture — viewfinder with on-device GS1 verification, OFF lookup,
// manual add, favorites and "frequent at this hour". Every path ends in the
// same editable-before-save form; nothing auto-commits.

type Mode = 'search' | 'barcode' | 'manual' | 'ai' | 'photo';

type ScanState =
  | { kind: 'idle' }
  | { kind: 'invalid'; code: string; reason: string }
  | { kind: 'looking'; code: string }
  | { kind: 'miss'; code: string }
  | { kind: 'hit'; code: string; product: OFFProduct };

export function LogScreen() {
  const [sub, setSub] = useState('Capture');
  return (
    <View style={{ flex: 1 }}>
      <SubNav items={['Capture', 'Recipes', 'Planner']} active={sub} onChange={setSub} />
      {sub === 'Capture' ? <CaptureTab /> : sub === 'Recipes' ? <RecipesTab /> : <PlannerTab />}
    </View>
  );
}

function CaptureTab() {
  const { theme } = useTheme();
  const profile = useAppStore((s) => s.profile);
  const bumpToday = useAppStore((s) => s.bumpToday);
  const [mode, setMode] = useState<Mode>('barcode');
  const [permission, requestPermission] = useCameraPermissions();
  const [scan, setScan] = useState<ScanState>({ kind: 'idle' });
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OFFProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [draft, setDraft] = useState<DraftEntry | null>(null);
  const [favorites, setFavorites] = useState<FoodFavorite[]>([]);
  const [frequent, setFrequent] = useState<{ foodName: string; count: number; calories: number }[]>([]);
  const [yesterday, setYesterday] = useState<YesterdayMeal[]>([]);
  const [aiText, setAiText] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiItems, setAiItems] = useState<AiItem[] | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState<string | null>(null);
  const [photoQueue, setPhotoQueue] = useState<QueuedPhoto[]>([]);
  useEffect(() => {
    void loadPhotoQueue().then(setPhotoQueue);
  }, []);
  const lastScanRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });

  const dietaryFlags = profile?.dietaryFlags ?? [];

  const refreshLists = useCallback(async () => {
    const favs = await listFavorites(supabase, 12);
    if (favs.ok) setFavorites(favs.data);

    // Frequent at this hour — ranked over the last 60 days of entries.
    const since = new Date();
    since.setDate(since.getDate() - 60);
    const logged: LoggedFood[] = [];
    // Walk recent days' entries via the day query (bounded: favorites cover
    // most re-logs; this powers the hour ranking from actual history).
    const { data } = await supabase
      .from('basalt_food_entries')
      .select('food_name, created_at, calories')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(400);
    (data ?? []).forEach((r: any) =>
      logged.push({ foodName: r.food_name, createdAt: r.created_at, calories: Number(r.calories ?? 0) }),
    );
    setFrequent(frequentAtHour(logged, new Date().getHours()).slice(0, 3));

    const yd = new Date();
    yd.setDate(yd.getDate() - 1);
    const yEntries = await getFoodEntriesForDay(supabase, isoDay(yd));
    setYesterday(yesterdayMeals(yEntries.ok ? yEntries.data : []));
  }, []);

  useEffect(() => {
    void refreshLists();
  }, [refreshLists]);

  useEffect(() => {
    if (mode === 'barcode' && permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [mode, permission, requestPermission]);

  const onBarcode = async (code: string) => {
    // Debounce repeat fires of the same code while the sheet is open.
    const now = Date.now();
    if (draft || (lastScanRef.current.code === code && now - lastScanRef.current.at < 3000)) return;
    lastScanRef.current = { code, at: now };

    const check = validateGs1(code);
    if (!check.valid) {
      setScan({ kind: 'invalid', code, reason: check.reason ?? 'Check digit failed.' });
      return;
    }
    setScan({ kind: 'looking', code });
    const product = await searchByBarcode(code);
    if (!product) {
      setScan({ kind: 'miss', code });
      return;
    }
    setScan({ kind: 'hit', code, product });
  };

  const openDraftFromProduct = (p: OFFProduct) => {
    const conflicts = dietaryConflicts(p.allergens, dietaryFlags);
    setDraft({
      ...offToEntryInput(p, mealForHour(new Date().getHours())),
      conflictNote: conflictLine(conflicts),
      sourceNote: 'Source · Open Food Facts · editable before save',
    });
  };

  const openManualDraft = () => {
    setDraft({
      mealType: mealForHour(new Date().getHours()),
      foodName: '', calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0,
      source: 'manual',
      sourceNote: 'Manual entry · your numbers, your log',
    });
  };

  const runAiEstimate = async () => {
    if (!aiText.trim()) return;
    setAiBusy(true);
    setAiError(null);
    setAiItems(null);
    const { data, error } = await supabase.functions.invoke('ai-quick-add', {
      body: { description: aiText.trim() },
    });
    setAiBusy(false);
    if (error) {
      // Surface the function's honest message (e.g. "not configured yet").
      let message = error.message ?? 'AI request failed.';
      try {
        const ctx = (error as any).context;
        if (ctx && typeof ctx.json === 'function') {
          const body = await ctx.json();
          if (body?.error) message = body.error;
        }
      } catch { /* keep the generic message */ }
      setAiError(message);
      return;
    }
    setAiItems((data?.items ?? []) as AiItem[]);
    setAiNote(data?.note ?? null);
  };

  const estimatePhotoB64 = async (b64: string, mode2: 'meal' | 'label', afterOk?: () => void) => {
    setAiError(null);
    const { data, error } = await supabase.functions.invoke('ai-photo-food', {
      body: { imageB64: b64, mode: mode2 },
    });
    setPhotoBusy(null);
    if (error) {
      let message = error.message ?? 'AI request failed.';
      try {
        const ctx = (error as any).context;
        if (ctx && typeof ctx.json === 'function') {
          const body = await ctx.json();
          if (body?.error) message = body.error;
        }
      } catch { /* keep generic */ }
      setAiError(message);
      return;
    }
    afterOk?.();
    if (mode2 === 'meal') {
      setAiItems((data?.items ?? []) as AiItem[]);
      setAiNote(data?.note ?? null);
      return;
    }
    if (!data?.food_name) {
      setAiError(data?.note ?? 'No nutrition panel found in that photo.');
      return;
    }
    setDraft({
      ...labelToDraftFields(data as LabelScan, new Date().getHours()),
      sourceNote: `~ transcribed from a label photo · ${data.note || 'check against the pack'} · saving also files it in favourites as your custom food`,
    });
  };

  const runPhoto = async (from: 'camera' | 'gallery', mode2: 'meal' | 'label') => {
    const shot = await capturePhoto(from);
    if (!shot) return;
    setPhotoBusy(mode2);
    await estimatePhotoB64(shot.b64, mode2);
  };

  const stashPhoto = async () => {
    const shot = await capturePhoto('camera');
    if (!shot) return;
    setPhotoQueue(await enqueuePhoto(shot.uri));
  };

  const openDraftFromAi = (item: AiItem) => {
    setDraft({
      mealType: item.meal_guess,
      foodName: item.food_name,
      calories: Math.round(item.calories),
      protein: Math.round(item.protein_g * 10) / 10,
      carbs: Math.round(item.carbs_g * 10) / 10,
      fat: Math.round(item.fat_g * 10) / 10,
      fiber: Math.round(item.fiber_g * 10) / 10,
      sugar: Math.round(item.sugar_g * 10) / 10,
      sodiumMg: Math.round(item.sodium_mg),
      source: 'quick_add',
      sourceNote: `AI estimate (~) · ${item.portion_note} · every value editable — nothing commits until you save`,
    });
  };

  const saveEntry = async (entry: FoodEntryInput, photoB64: string | null = null) => {
    let photoPath = entry.photoPath;
    if (photoB64) {
      const up = await uploadFoodPhoto(supabase, photoB64, Date.now(), Math.random().toString(36).slice(2, 8));
      if (up.ok) photoPath = up.data; // upload failure logs the entry photo-less, honestly
    }
    const r = await addFoodEntry(supabase, { ...entry, photoPath });
    if (r.ok) {
      void recordFoodUse(supabase, entry);
      setDraft(null);
      setScan({ kind: 'idle' });
      bumpToday();
      void refreshLists();
    }
  };

  const relogFavorite = async (f: FoodFavorite) => {
    await saveEntry({
      mealType: mealForHour(new Date().getHours()),
      foodName: f.foodName,
      brand: f.brand ?? undefined,
      calories: f.calories, protein: f.protein, carbs: f.carbs, fat: f.fat,
      fiber: f.fiber, sugar: f.sugar, sodiumMg: f.sodiumMg, saturatedFat: f.saturatedFat,
      servingSize: f.servingSize, servingUnit: f.servingUnit, quantity: f.quantity,
      barcode: f.barcode ?? undefined,
      source: 'search',
    });
  };

  const copyYesterdayMeal = async (meal: MealType) => {
    const yd = new Date();
    yd.setDate(yd.getDate() - 1);
    const yEntries = await getFoodEntriesForDay(supabase, isoDay(yd));
    if (!yEntries.ok) return;
    for (const e of yEntries.data.filter((x) => x.mealType === meal)) {
      await addFoodEntry(supabase, {
        mealType: e.mealType, foodName: e.foodName, brand: e.brand ?? undefined,
        calories: e.calories, protein: e.protein, carbs: e.carbs, fat: e.fat,
        fiber: e.fiber, sugar: e.sugar, sodiumMg: e.sodiumMg, saturatedFat: e.saturatedFat,
        servingSize: e.servingSize, servingUnit: e.servingUnit, quantity: e.quantity,
        barcode: e.barcode ?? undefined, source: e.source === 'barcode' ? 'barcode' : 'manual',
        micros: e.micros ?? undefined,
      });
    }
    bumpToday();
    void refreshLists();
  };

  const runSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setResults(await searchByName(query.trim()));
    setSearching(false);
  };

  return (
    <ScrollView style={[styles.scroll, { backgroundColor: theme.surfaces.bg }]} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* ── Mode row + viewfinder ──────────────────────────────────── */}
      <View style={styles.vf}>
        <View style={styles.modes}>
          {(['search', 'barcode', 'photo', 'ai', 'manual'] as Mode[]).map((m) => (
            <Pressable key={m} onPress={() => setMode(m)}>
              <Text style={[styles.mode, mode === m && styles.modeOn]}>{m.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>

        {mode === 'barcode' ? (
          permission?.granted ? (
            <View style={styles.cameraWrap}>
              <CameraView
                style={StyleSheet.absoluteFill}
                barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a'] }}
                onBarcodeScanned={({ data }) => void onBarcode(data)}
              />
              <View pointerEvents="none" style={styles.reticle}>
                <View style={[styles.corner, styles.cTL]} />
                <View style={[styles.corner, styles.cTR]} />
                <View style={[styles.corner, styles.cBL]} />
                <View style={[styles.corner, styles.cBR]} />
              </View>
              <Text style={styles.hint}>EAN-13 · GS1 CHECK-DIGIT VERIFIED ON DEVICE</Text>
            </View>
          ) : (
            <View style={styles.cameraDenied}>
              <EmptyState>
                Camera access is off, so there is no scanner here. Grant camera permission in system
                settings, or use Search and Manual — they do everything the scanner does.
              </EmptyState>
            </View>
          )
        ) : null}

        {mode === 'search' ? (
          <View style={{ paddingBottom: 8 }}>
            <SearchBar placeholder="Search Open Food Facts…" value={query} onChangeText={setQuery} />
            <CTA label={searching ? '…' : 'Search'} onPress={runSearch} disabled={searching || !query.trim()} />
          </View>
        ) : null}

        {mode === 'manual' ? (
          <View style={{ paddingBottom: 8 }}>
            <CTA label="New manual entry" onPress={openManualDraft} />
            <SrcNote>Your numbers, your log — no database required</SrcNote>
          </View>
        ) : null}

        {mode === 'photo' ? (
          <View style={{ paddingBottom: 8 }}>
            <CTA label={photoBusy === 'meal' ? 'Estimating…' : 'Photograph a meal'} disabled={photoBusy !== null} onPress={() => void runPhoto('camera', 'meal')} />
            <CTA label={photoBusy === 'label' ? 'Reading…' : 'Scan a nutrition label'} disabled={photoBusy !== null} onPress={() => void runPhoto('camera', 'label')} />
            <View style={styles.photoMinor}>
              <Pressable onPress={() => void runPhoto('gallery', 'meal')} disabled={photoBusy !== null}>
                <Text style={styles.photoMinorLink}>FROM GALLERY</Text>
              </Pressable>
              <Pressable onPress={() => void stashPhoto()} disabled={photoBusy !== null}>
                <Text style={styles.photoMinorLink}>PHOTO NOW, LOG LATER</Text>
              </Pressable>
            </View>
            {photoQueue.length > 0 ? (
              <View style={{ marginTop: 6 }}>
                {photoQueue.map((q) => (
                  <View key={q.id} style={styles.queueRow}>
                    <Text style={styles.queueLabel}>{queuedLabel(q.takenAt, new Date()).toUpperCase()}</Text>
                    <Pressable
                      disabled={photoBusy !== null}
                      onPress={async () => {
                        setPhotoBusy('meal');
                        const b64 = await readQueuedPhotoB64(q.uri);
                        await estimatePhotoB64(b64, 'meal', () => {
                          void dequeuePhoto(q.id).then(setPhotoQueue);
                        });
                      }}
                    >
                      <Text style={styles.photoMinorLink}>ESTIMATE</Text>
                    </Pressable>
                    <Pressable onPress={() => void dequeuePhoto(q.id).then(setPhotoQueue)}>
                      <Text style={styles.photoMinorLink}>REMOVE</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
            <SrcNote>Your photo is sent to Anthropic (Claude) to estimate — only the image, never your ledger, name or email · downscaled on-device first · estimates wear ~ until you confirm · queued photos stay on this phone until you estimate them</SrcNote>
          </View>
        ) : null}

        {mode === 'ai' ? (
          <View style={{ paddingBottom: 8 }}>
            <ObInput
              placeholder={'Describe it — "2 eggs, rye toast and a long black"'}
              value={aiText}
              onChangeText={setAiText}
              multiline
            />
            <CTA label={aiBusy ? 'Estimating…' : 'Estimate with AI'} disabled={aiBusy || !aiText.trim()} onPress={() => void runAiEstimate()} />
            <SrcNote>Your description is sent to Anthropic (Claude) to estimate — only the text above, never your ledger, name or email · estimates wear ~ until you confirm · no AI key ever ships in this app · your keyboard's mic dictates straight into the box</SrcNote>
          </View>
        ) : null}
      </View>

      {/* ── Scan result ────────────────────────────────────────────── */}
      {scan.kind !== 'idle' ? (
        <Card>
          <ReceiptHeader
            label="Result"
            summary={barcodeDisplay(scan.code, scan.kind === 'hit' || scan.kind === 'looking' || scan.kind === 'miss')}
          />
          {scan.kind === 'invalid' ? (
            <EmptyState>{`Not a valid barcode — ${scan.reason} Re-aim and try again.`}</EmptyState>
          ) : scan.kind === 'looking' ? (
            <EmptyState>Checking Open Food Facts…</EmptyState>
          ) : scan.kind === 'miss' ? (
            <>
              <EmptyState>
                Valid barcode, but Open Food Facts has no entry for it. Add it manually — your numbers
                are just as real.
              </EmptyState>
              <CTA label="Add manually" onPress={openManualDraft} />
            </>
          ) : (
            <>
              <View style={styles.resultRow}>
                <View style={{ flexShrink: 1 }}>
                  <Text style={styles.resultName}>{scan.product.name}</Text>
                  <Text style={styles.resultMeta}>{resultMeta(scan.product)}</Text>
                  {(() => {
                    const line = conflictLine(dietaryConflicts(scan.product.allergens, dietaryFlags));
                    return line ? <Text style={styles.conflict}>{line.toUpperCase()}</Text> : null;
                  })()}
                </View>
                <Pressable style={styles.addBtn} onPress={() => openDraftFromProduct(scan.product)}>
                  <Text style={styles.addBtnText}>ADD</Text>
                </Pressable>
              </View>
              {(() => {
                const q = qualityLine(scan.product);
                return q ? (
                  <View style={styles.qualityRow}>
                    <Text style={styles.qualityLabel}>QUALITY</Text>
                    <Text style={styles.qualityText}>{q}</Text>
                  </View>
                ) : null;
              })()}
              <SrcNote>Source · Open Food Facts · editable before save · conflicts flagged, never hidden</SrcNote>
            </>
          )}
        </Card>
      ) : null}

      {/* ── AI suggestions ─────────────────────────────────────────── */}
      {mode === 'ai' && (aiItems !== null || aiError) ? (
        <Card>
          <ReceiptHeader label="Suggestion — editable, unconfirmed" summary={aiItems ? `${aiItems.length} ${aiItems.length === 1 ? 'item' : 'items'}` : undefined} />
          {aiError ? (
            <EmptyState>{aiError}</EmptyState>
          ) : aiItems && aiItems.length > 0 ? (
            <>
              {aiItems.map((item, i) => (
                <Pressable key={i} onPress={() => openDraftFromAi(item)} hitSlop={8}>
                  <ReceiptRow
                    name={item.food_name}
                    meta={`~P ${Math.round(item.protein_g)} · ~C ${Math.round(item.carbs_g)} · ~F ${Math.round(item.fat_g)} · ${item.portion_note}`}
                    value={`~${Math.round(item.calories)}`}
                    unit="kcal"
                    last={i === aiItems.length - 1}
                  />
                </Pressable>
              ))}
              {aiNote ? <SrcNote>{`Uncertainty · ${aiNote}`}</SrcNote> : null}
              <SrcNote>AI-estimated via Edge Function · tap an item to edit and confirm · nothing auto-commits</SrcNote>
            </>
          ) : (
            <EmptyState>No foods recognized in that description — try naming the items.</EmptyState>
          )}
        </Card>
      ) : null}

      {/* ── Search results ─────────────────────────────────────────── */}
      {mode === 'search' && results.length > 0 ? (
        <Card>
          <ReceiptHeader label="Results" summary={`${results.length} from Open Food Facts`} />
          {results.slice(0, 10).map((p, i) => (
            <Pressable key={p.id + i} onPress={() => openDraftFromProduct(p)} hitSlop={8}>
              <ReceiptRow
                name={p.name}
                meta={resultMeta(p)}
                metaAccent={dietaryConflicts(p.allergens, dietaryFlags).length > 0 ? color.fat : undefined}
                value={groupInt(p.calories)}
                unit="kcal"
                last={i === Math.min(results.length, 10) - 1}
              />
            </Pressable>
          ))}
        </Card>
      ) : null}

      {/* ── Frequent at this hour ──────────────────────────────────── */}
      {frequent.length > 0 ? (
        <Card>
          <ReceiptHeader label="Frequent at this hour" summary="from your history" />
          {frequent.map((f, i) => {
            const fav = favorites.find((x) => x.foodName === f.foodName);
            return (
              <Pressable key={f.foodName} onPress={() => fav && void relogFavorite(fav)} disabled={!fav} hitSlop={8}>
                <ReceiptRow
                  name={f.foodName}
                  meta={`logged ${f.count}× around now${fav ? ' · tap to re-log' : ''}`}
                  value={groupInt(f.calories)}
                  unit="kcal"
                  last={i === frequent.length - 1}
                />
              </Pressable>
            );
          })}
        </Card>
      ) : null}

      {/* ── Copy yesterday ─────────────────────────────────────────── */}
      {yesterday.length > 0 ? (
        <Card>
          <ReceiptHeader label="Yesterday" summary="tap a meal to copy it to today" />
          {yesterday.map((m, i) => (
            <Pressable key={m.meal} onPress={() => void copyYesterdayMeal(m.meal)} hitSlop={8}>
              <ReceiptRow
                name={`Copy yesterday's ${m.label.toLowerCase()}`}
                meta={`${m.count} ${m.count === 1 ? 'entry' : 'entries'}`}
                value={groupInt(m.calories)}
                unit="kcal"
                last={i === yesterday.length - 1}
              />
            </Pressable>
          ))}
        </Card>
      ) : null}

      {/* ── Favorites ──────────────────────────────────────────────── */}
      <Card>
        <ReceiptHeader label="Favorites" summary={favorites.length > 0 ? '1-tap re-log' : undefined} />
        {favorites.length > 0 ? (
          favorites.map((f, i) => (
            <Pressable key={f.id} onPress={() => void relogFavorite(f)} hitSlop={8}>
              <ReceiptRow
                name={f.foodName}
                meta={`logged ${f.useCount}×${f.brand ? ` · ${f.brand}` : ''}`}
                value={groupInt(f.calories)}
                unit="kcal"
                last={i === favorites.length - 1}
              />
            </Pressable>
          ))
        ) : (
          <EmptyState>
            Foods you log build a favorites list here automatically — the second log is one tap.
          </EmptyState>
        )}
      </Card>

      <AddEntryForm draft={draft} onCancel={() => setDraft(null)} onSave={saveEntry} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  photoMinor: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: 2 },
  photoMinorLink: { fontFamily: mono, fontSize: 11, letterSpacing: 0.85, color: color.faint, paddingVertical: 8 },
  queueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.border, paddingVertical: 2 },
  queueLabel: { fontFamily: mono, fontSize: 11.5, color: color.ink2, letterSpacing: 0.4 },
  scroll: { flex: 1, backgroundColor: color.bg },
  content: { paddingHorizontal: 16, paddingBottom: 24 },
  vf: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 12,
    backgroundColor: '#101216',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    paddingHorizontal: 12,
  },
  modes: { flexDirection: 'row', justifyContent: 'center', gap: 18, paddingTop: 12, paddingBottom: 8 },
  mode: { fontFamily: mono, fontSize: 11, letterSpacing: 1.24, color: color.faint, paddingBottom: 3 },
  modeOn: { color: color.ink, borderBottomWidth: 1, borderBottomColor: color.ink },
  cameraWrap: { height: 260, borderRadius: 10, overflow: 'hidden', marginBottom: 12, justifyContent: 'flex-end' },
  cameraDenied: { paddingBottom: 12 },
  reticle: {
    position: 'absolute', alignSelf: 'center', top: '50%', marginTop: -71,
    width: 230, height: 142,
  },
  corner: { position: 'absolute', width: 18, height: 18, borderColor: '#E8EAEE' },
  cTL: { left: 0, top: 0, borderLeftWidth: 1.5, borderTopWidth: 1.5 },
  cTR: { right: 0, top: 0, borderRightWidth: 1.5, borderTopWidth: 1.5 },
  cBL: { left: 0, bottom: 0, borderLeftWidth: 1.5, borderBottomWidth: 1.5 },
  cBR: { right: 0, bottom: 0, borderRightWidth: 1.5, borderBottomWidth: 1.5 },
  hint: {
    fontFamily: mono, fontSize: 11, letterSpacing: 1.33, color: color.mute,
    textAlign: 'center', paddingBottom: 14,
  },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingVertical: 11 },
  resultName: { fontSize: 14, fontWeight: '500', color: color.ink },
  resultMeta: { fontFamily: mono, fontSize: 11.5, color: color.faint, marginTop: 3 },
  conflict: { fontFamily: mono, fontSize: 11, color: color.fat, marginTop: 4, letterSpacing: 0.38 },
  addBtn: {
    borderWidth: StyleSheet.hairlineWidth, borderColor: color.border2, borderRadius: 8,
    paddingVertical: 6, paddingHorizontal: 12, flexShrink: 0,
  },
  addBtnText: { fontFamily: mono, fontSize: 11, color: color.ink2 },
  qualityRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
    paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.border,
  },
  qualityLabel: { fontFamily: mono, fontSize: 11, fontWeight: '600', letterSpacing: 1.2, color: color.faint },
  qualityText: { fontFamily: mono, fontSize: 12, color: color.ink2 },
});
