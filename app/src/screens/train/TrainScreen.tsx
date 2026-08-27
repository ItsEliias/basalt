import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import {
  Card, EmptyState, SrcNote, ReceiptHeader, ReceiptRow, SearchBar, CTA, Chip, ChipRow, BodyFigure,
  ExerciseHead, PrevNote, SetsHeader, SetRow, RestTimerBar, SupersetTag, SubNav,
  GuidedTimerDisplay, GuidedTimerConfig, Stepper, TileGrid, StatTile, ObInput,
  color, mono, mmss, groupInt, useTheme,
} from '@basalt/ui';
import {
  getExercises, listRecentSessions, prevSummary, sessionVolumeKg,
  platesFor, platesText, biasOrder, suggestionText, warmupSets, regionsFor, intensityFor,
  emomConfig, TABATA_CONFIG, circuitConfig, circuitLabel, bigThree, recoveryIntensity,
  REGION_FOR_MUSCLE, type RegionRecovery, type BodyRegion,
  describe as describeGuided,
  listTemplates, deleteTemplate, duplicateTemplate, type WorkoutTemplate,
  type Exercise, type WorkoutSession, type ConditionBias,
} from '@basalt/training';
import { TemplateBuilder } from './TemplateBuilder';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../state/appStore';
import { useSessionStore, type SessionExerciseState } from '../../state/sessionStore';
import { equipmentTokens, prevCellText, exerciseMetaText, elapsedText } from './model';
import { OutdoorTab } from './OutdoorTab';
import { AdaptSheet } from './AdaptSheet';
import { timerServiceFailed } from '../../lib/timerService';
import { loadRecovery, toggleRecoveryOverride } from '../../lib/recoveryData';
import { PrShareCard, ShareSheet } from '../../components/ShareCards';
import { SessionDetailSheet } from '../../components/SessionDetailSheet';

// Train — the relational set logger. Prev values ghost as editable defaults,
// completion is a typographic state change with a quiet PR mark, rest timers
// remember per exercise, timed movements get the guided set timer.

export function TrainScreen() {
  const [sub, setSub] = useState('Session');
  if (sub === 'Outdoor') {
    return (
      <View style={{ flex: 1 }}>
        <SubNav items={['Session', 'Outdoor']} active={sub} onChange={setSub} />
        <OutdoorTab />
      </View>
    );
  }
  return (
    <View style={{ flex: 1 }}>
      <SubNav items={['Session', 'Outdoor']} active={sub} onChange={setSub} />
      <SessionTab />
    </View>
  );
}

function SessionTab() {
  const profile = useAppStore((s) => s.profile);
  const bumpToday = useAppStore((s) => s.bumpToday);
  const session = useSessionStore();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [rpeOpen, setRpeOpen] = useState(false);
  const [adaptOpen, setAdaptOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const cardYRef = useRef<Map<string, number>>(new Map());

  // Smart superset scroll: after a committed set in a superset, glide to
  // the partner exercise — the letter pair the tags promise.
  const scrollToPartner = (fromId: string) => {
    const exs = useSessionStore.getState().exercises;
    const from = exs.find((e) => e.sessionExerciseId === fromId);
    if (!from || from.supersetGroup === null) return;
    const members = exs.filter((e) => e.supersetGroup === from.supersetGroup);
    if (members.length < 2) return;
    const idx = members.findIndex((e) => e.sessionExerciseId === fromId);
    const next = members[(idx + 1) % members.length]!;
    const y = cardYRef.current.get(next.sessionExerciseId);
    if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
  };
  const [recent, setRecent] = useState<WorkoutSession[]>([]);
  const [viewSessionId, setViewSessionId] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<RegionRecovery[] | null>(null);
  const refreshRecovery = () => void loadRecovery(Date.now()).then((r) => setRecovery(r.recovery));
  const [, forceClock] = useState(0);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [builderOpen, setBuilderOpen] = useState(false);
  const refreshTemplates = () => void listTemplates(supabase).then((r) => r.ok && setTemplates(r.data));

  useEffect(() => {
    if (!session.sessionId) {
      void listRecentSessions(supabase, 8).then((r) => r.ok && setRecent(r.data));
      refreshTemplates();
    }
    refreshRecovery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.sessionId]);

  // A light 1 Hz repaint for the header clock + timers while a session runs.
  useEffect(() => {
    if (!session.sessionId) return;
    const iv = setInterval(() => forceClock((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, [session.sessionId]);

  if (builderOpen) {
    return (
      <TemplateBuilder
        onClose={() => setBuilderOpen(false)}
        onSaved={() => {
          setBuilderOpen(false);
          refreshTemplates();
        }}
      />
    );
  }

  if (!session.sessionId) {
    return (
      <>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Card>
          <ReceiptHeader label="Session" />
          <EmptyState>
            Start a session, add exercises from the 873-movement library, and every set lands in the
            ledger as its own row.
          </EmptyState>
          <CTA label={session.busy ? '…' : 'Start session'} disabled={session.busy} onPress={() => void session.start()} />
        </Card>

        <Card>
          <ReceiptHeader label="Templates" summary="start with your own plan pre-filled" />
          {templates.length > 0 ? (
            templates.map((t, i) => (
              <View key={t.id}>
                <Pressable
                  onPress={() => void session.startFromTemplate(t.id)}
                  onLongPress={() => void deleteTemplate(supabase, t.id).then(refreshTemplates)}
                  hitSlop={8}
                >
                  <ReceiptRow
                    name={t.name}
                    meta={`${t.location === 'gym' ? 'GYM' : 'HOME'} · hold to remove`}
                    value="start"
                    last={i === templates.length - 1}
                  />
                </Pressable>
                <View style={styles.pickerLinks}>
                  <Pressable
                    onPress={() => void duplicateTemplate(supabase, t.id, `${t.name} copy`).then(refreshTemplates)}
                  >
                    <Text style={styles.timedLink}>DUPLICATE →</Text>
                  </Pressable>
                </View>
              </View>
            ))
          ) : (
            <EmptyState>No templates yet — build one below to start a session with your own targets pre-filled.</EmptyState>
          )}
          <Pressable onPress={() => setBuilderOpen(true)}>
            <Text style={styles.addSet}>+ NEW TEMPLATE</Text>
          </Pressable>
        </Card>

        {recovery && recovery.length > 0 ? (
          <Card>
            <ReceiptHeader label="Recovery" summary="published heuristic · your history, not a prescription" />
            <View style={{ alignItems: 'center', marginTop: 6 }}>
              <BodyFigure intensity={recoveryIntensity(recovery)} />
            </View>
            {recovery.map((r, i) => (
              <Pressable
                key={r.region}
                onPress={() => void toggleRecoveryOverride(r.region, Date.now()).then(refreshRecovery)}
                hitSlop={8}
              >
                <ReceiptRow
                  name={r.region[0]!.toUpperCase() + r.region.slice(1)}
                  meta={`${r.hardSets72h} hard sets in 72 h · ${r.why} · tap to override`}
                  value={r.status === 'overridden' ? 'fresh — your call' : r.status}
                  valueColor={r.status === 'loaded' ? color.protein : r.status === 'fresh' || r.status === 'overridden' ? color.carbs : color.ink2}
                  last={i === recovery.length - 1}
                />
              </Pressable>
            ))}
            <SrcNote>48 h base · +6 h per 4 hard sets beyond 8 (cap +24) · short persisted night extends 20% · a lens on your sets, never a prescription</SrcNote>
          </Card>
        ) : null}

        <Card>
          <ReceiptHeader label="Recent sessions" />
          {recent.length > 0 ? (
            recent.map((s, i) => (
              <Pressable key={s.id} onPress={() => setViewSessionId(s.id)} hitSlop={8}>
                <ReceiptRow
                  name={s.notes?.trim() || 'Training session'}
                  meta={`${new Date(s.startedAt).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })} · tap for detail`}
                  value={s.endedAt ? mmss((Date.parse(s.endedAt) - Date.parse(s.startedAt)) / 1000) : '—'}
                  unit={s.endedAt ? 'duration' : 'open'}
                  last={i === recent.length - 1}
                />
              </Pressable>
            ))
          ) : (
            <EmptyState>No sessions yet. The first one starts the history every Prev column draws from.</EmptyState>
          )}
        </Card>
      </ScrollView>
      <SessionDetailSheet sessionId={viewSessionId} onClose={() => setViewSessionId(null)} />
    </>
    );
  }

  return (
    <>
      <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <Pressable onPress={() => setAdaptOpen(true)} disabled={session.exercises.length === 0}>
            <Text style={[styles.addSet, session.exercises.length === 0 && { opacity: 0.4 }]}>ADAPT</Text>
          </Pressable>
          <Text style={styles.elapsed}>
            {session.startedAt ? `${elapsedText(session.startedAt, new Date())} ELAPSED` : ''}
          </Text>
        </View>

        {session.exercises.map((ex, i) => (
          <View
            key={ex.sessionExerciseId}
            onLayout={(e) => cardYRef.current.set(ex.sessionExerciseId, e.nativeEvent.layout.y)}
          >
            <ExerciseCard ex={ex} index={i} all={session.exercises} onCommitted={scrollToPartner} />
          </View>
        ))}

        {session.exercises.length === 0 ? (
          <Card>
            <EmptyState>Empty session so far — add the first exercise.</EmptyState>
          </Card>
        ) : null}

        <CTA label="Add exercise" onPress={() => setPickerOpen(true)} />

        {(() => {
          const sets = session.exercises.flatMap((e) =>
            e.rows.filter((r) => r.committed).map((r) => ({
              weightKg: r.kg.trim() === '' ? null : parseFloat(r.kg.replace(',', '.')),
              reps: r.reps.trim() === '' ? null : parseInt(r.reps, 10),
            })),
          );
          const volume = sets.reduce((s, x) => s + (x.weightKg ?? 0) * (x.reps ?? 0), 0);
          return volume > 0 ? (
            <TileGrid>
              <StatTile label="Session volume" value={groupInt(volume)} unit="kg" />
              <StatTile label="Sets logged" value={String(sets.length)} />
            </TileGrid>
          ) : null;
        })()}

        <CTA label={session.busy ? '…' : 'End session'} disabled={session.busy} onPress={() => setRpeOpen(true)} />
        {session.error ? <Text style={styles.error}>{session.error}</Text> : null}
      </ScrollView>

      <KeepAwakeWhileTraining />
      <AdaptSheet open={adaptOpen} onClose={() => setAdaptOpen(false)} />
      <RpeSheet
        open={rpeOpen}
        busy={session.busy}
        onClose={() => setRpeOpen(false)}
        onFinish={(rpe) => {
          setRpeOpen(false);
          void session.finish(rpe).then(bumpToday);
        }}
      />
      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        loadedRegions={new Set((recovery ?? []).filter((r) => r.status === 'loaded').map((r) => r.region))}
        myEquipment={equipmentTokens(profile?.equipment ?? [])}
        hasEquipmentProfile={(profile?.equipment ?? []).length > 0 && profile?.trainLocation !== 'gym'}
        onPick={(exercise, timed) => {
          setPickerOpen(false);
          void useSessionStore.getState().addExercise(exercise, timed);
        }}
      />
    </>
  );
}

function ExerciseCard({ ex, index, all, onCommitted }: { ex: SessionExerciseState; index: number; all: SessionExerciseState[]; onCommitted?: (id: string) => void }) {
  const session = useSessionStore();
  const restHere = session.rest?.sessionExerciseId === ex.sessionExerciseId;
  const [commentFor, setCommentFor] = useState<number | null>(null);
  const [platesOpen, setPlatesOpen] = useState(false);
  const [prsOpen, setPrsOpen] = useState(false);

  const supersetLabel = (() => {
    if (ex.supersetGroup === null) return null;
    const members = all.filter((e) => e.supersetGroup === ex.supersetGroup);
    const pos = members.findIndex((e) => e.sessionExerciseId === ex.sessionExerciseId) + 1;
    const letter = String.fromCharCode(64 + Math.min(26, ex.supersetGroup));
    return `Superset · ${letter}${pos}`;
  })();

  if (ex.timed && ex.guided) {
    const d = describeGuided(ex.guided);
    return (
      <Card>
        <ExerciseHead name={ex.exercise.name} meta={`Timed · ${exerciseMetaText(ex.exercise.primaryMuscles, ex.exercise.equipment)}`} />
        <GuidedTimerConfig
          parts={[
            { value: `${ex.guided.config.workS} s`, label: 'work' },
            { value: `${ex.guided.config.restS} s`, label: 'rest' },
            { value: `${ex.guided.config.sets}`, label: 'sets' },
            { value: `${ex.guided.config.leadInS} s`, label: 'lead-in' },
          ]}
        />
        {(ex.guided.phase === 'idle' || ex.guided.phase === 'finished') ? (
          <ChipRow
            options={['Custom', 'EMOM', 'Tabata', 'Circuit']}
            value={ex.timerMode === 'custom' ? 'Custom' : ex.timerMode === 'emom' ? 'EMOM' : ex.timerMode === 'tabata' ? 'Tabata' : 'Circuit'}
            onChange={(label) => {
              const id = ex.sessionExerciseId;
              if (label === 'Custom') session.setTimerMode(id, 'custom', { leadInS: 5, workS: 50, restS: 20, sets: 4 });
              if (label === 'EMOM') session.setTimerMode(id, 'emom', emomConfig(40, 10));
              if (label === 'Tabata') session.setTimerMode(id, 'tabata', TABATA_CONFIG);
              if (label === 'Circuit') session.setTimerMode(id, 'circuit', circuitConfig(4, 3, 45, 15), 4);
            }}
          />
        ) : null}
        {(ex.guided.phase === 'idle' || ex.guided.phase === 'finished') ? (
          <View style={styles.cfgRow}>
            <Stepper
              value={`${ex.guided.config.workS}s work`}
              onMinus={() => {
                const w = Math.max(5, ex.guided!.config.workS - 5);
                session.guidedConfigure(ex.sessionExerciseId, ex.timerMode === 'emom' ? { workS: w, restS: 60 - w } : { workS: w });
              }}
              onPlus={() => {
                const w = ex.timerMode === 'emom' ? Math.min(55, ex.guided!.config.workS + 5) : ex.guided!.config.workS + 5;
                session.guidedConfigure(ex.sessionExerciseId, ex.timerMode === 'emom' ? { workS: w, restS: 60 - w } : { workS: w });
              }}
            />
            <Stepper value={`${ex.guided.config.sets} sets`} onMinus={() => session.guidedConfigure(ex.sessionExerciseId, { sets: Math.max(1, ex.guided!.config.sets - 1) })} onPlus={() => session.guidedConfigure(ex.sessionExerciseId, { sets: ex.guided!.config.sets + 1 })} />
          </View>
        ) : null}
        <GuidedTimerDisplay
          seconds={ex.guided.phase === 'finished' ? '✓' : String(d.seconds)}
          phaseLabel={ex.timerMode === 'circuit' ? `${d.label.split(' — ')[0]} — ${circuitLabel(ex.guided, ex.stations)}` : d.label}
          tone={d.tone}
          progress={d.progress}
          setsDone={ex.guided.setsDone}
          setsTotal={ex.guided.config.sets}
          currentSet={ex.guided.phase === 'idle' || ex.guided.phase === 'finished' ? -1 : ex.guided.setIndex}
        />
        <CTA
          label={ex.guided.phase === 'idle' ? 'GO' : ex.guided.phase === 'finished' ? 'Go again' : 'Stop'}
          onPress={() => session.guidedToggle(ex.sessionExerciseId)}
        />
        <SrcNote center>
          {timerServiceFailed()
            ? 'Haptics on phase change · sets auto-logged as duration · timer service unavailable — runs only while the app is open'
            : 'Haptics on phase change · sets auto-logged as duration · keeps running with the screen off (quiet ongoing notification)'}
        </SrcNote>
      </Card>
    );
  }

  return (
    <Card>
      {supersetLabel ? <SupersetTag label={supersetLabel} /> : null}
      <ExerciseHead name={ex.exercise.name} meta={exerciseMetaText(ex.exercise.primaryMuscles, ex.exercise.equipment)} />
      {ex.suggestion ? (
        <Text style={styles.suggestion}>
          {suggestionText(ex.suggestion)}
          {ex.suggestion.kind !== 'first_time' ? ' · a suggestion, never a mandate' : ''}
        </Text>
      ) : null}
      {index > 0 ? (
        <Pressable onPress={() => void session.toggleSupersetWithPrevious(ex.sessionExerciseId)}>
          <Text style={styles.linkAction}>
            {ex.supersetGroup !== null && ex.supersetGroup === all[index - 1]?.supersetGroup
              ? 'UNLINK SUPERSET'
              : '⟂ LINK WITH PREVIOUS (SUPERSET)'}
          </Text>
        </Pressable>
      ) : null}
      {ex.target ? (
        <PrevNote>
          {`Target · ${ex.target.sets} × ${ex.target.reps ?? '?'} reps${ex.target.weightKg ? ` @ ${ex.target.weightKg} kg` : ''} · from your template`}
        </PrevNote>
      ) : null}
      {ex.prevSets.length > 0 && ex.prevPerformedAt ? (
        <PrevNote>
          {`Last session · ${prevSummary(ex.prevSets) ?? '—'} · ${new Date(ex.prevPerformedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`}
        </PrevNote>
      ) : null}
      <SetsHeader columns={['Set', 'Prev', 'kg', 'Reps', 'RIR']} />
      {ex.rows.map((row, i) => (
        <SetRow
          key={row.setNumber}
          setNumber={String(row.setNumber)}
          prev={prevCellText(ex.prevSets, i)}
          kg={row.kg}
          reps={row.reps}
          rir={row.rir}
          ghost={!row.committed}
          pr={row.isPr}
          hasComment={row.comment.trim() !== ''}
          onPressSet={() => setCommentFor(i)}
          onChangeKg={(kg) => session.updateRow(ex.sessionExerciseId, i, { kg, committed: false })}
          onChangeReps={(reps) => session.updateRow(ex.sessionExerciseId, i, { reps, committed: false })}
          onChangeRir={(rir) => session.updateRow(ex.sessionExerciseId, i, { rir, committed: false })}
          onCommit={() => {
            void session.commitRow(ex.sessionExerciseId, i).then(() => onCommitted?.(ex.sessionExerciseId));
          }}
        />
      ))}
      <View style={styles.rowActions}>
        <Pressable onPress={() => session.addRow(ex.sessionExerciseId)}>
          <Text style={styles.addSet}>+ ADD SET</Text>
        </Pressable>
        <Pressable onPress={() => setPlatesOpen(true)}>
          <Text style={styles.addSet}>PLATES</Text>
        </Pressable>
        {ex.repPrs.length > 0 ? (
          <Pressable onPress={() => setPrsOpen(true)}>
            <Text style={styles.addSet}>PRS</Text>
          </Pressable>
        ) : null}
      </View>
      {restHere && session.rest ? (
        <RestTimerBar time={mmss(session.rest.remaining)} onSkip={session.skipRest} />
      ) : null}
      {ex.rows.some((r) => r.committed) ? (
        <View style={styles.fbRow}>
          <Text style={styles.fbLabel}>THIS FELT</Text>
          {(['too_easy', 'right', 'too_hard'] as const).map((f) => (
            <Pressable key={f} onPress={() => void session.giveFeedback(ex.sessionExerciseId, f)}>
              <Text style={[styles.fbChip, ex.feedback === f && styles.fbChipOn]}>
                {f === 'too_easy' ? 'TOO EASY' : f === 'right' ? 'RIGHT' : 'TOO HARD'}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <CommentSheet
        open={commentFor !== null}
        initial={commentFor !== null ? ex.rows[commentFor]?.comment ?? '' : ''}
        setNumber={commentFor !== null ? ex.rows[commentFor]?.setNumber ?? 0 : 0}
        onClose={() => setCommentFor(null)}
        onSave={(text) => {
          if (commentFor === null) return;
          session.updateRow(ex.sessionExerciseId, commentFor, { comment: text });
          const row = ex.rows[commentFor];
          if (row?.committed) void session.commitRow(ex.sessionExerciseId, commentFor);
          setCommentFor(null);
        }}
      />
      <PlatesSheet
        open={platesOpen}
        onClose={() => setPlatesOpen(false)}
        targetKgText={[...ex.rows].reverse().find((r) => r.kg.trim() !== '')?.kg ?? ''}
      />
      <PrsSheet open={prsOpen} onClose={() => setPrsOpen(false)} ex={ex} />
    </Card>
  );
}

function CommentSheet({ open, initial, setNumber, onClose, onSave }: {
  open: boolean; initial: string; setNumber: number; onClose: () => void; onSave: (t: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState(initial);
  useEffect(() => setText(initial), [initial, open]);
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.dim} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: 22 + insets.bottom }]}>
        <Text style={styles.sheetTitle}>SET {setNumber} · NOTE</Text>
        <ObInput
          placeholder="Machine seat 4 · felt heavy · grip cue…"
          value={text}
          onChangeText={setText}
          autoFocus
        />
        <CTA label="Save note" onPress={() => onSave(text)} />
      </View>
    </Modal>
  );
}

function ExerciseDetailSheet({ exercise, onClose, onPick }: {
  exercise: Exercise | null;
  onClose: () => void;
  onPick: (e: Exercise, timed: boolean) => void;
}) {
  const insets = useSafeAreaInsets();
  if (!exercise) return null;
  const emphasis = regionsFor(exercise);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.dim} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: 22 + insets.bottom }]}>
        <Text style={styles.sheetTitle}>{exercise.name.toUpperCase()}</Text>
        <View style={styles.detailRow}>
          <BodyFigure intensity={intensityFor(emphasis)} />
          <View style={{ flex: 1 }}>
            <Text style={styles.detailMeta}>
              {[
                exercise.primaryMuscles.length > 0 ? `Primary · ${exercise.primaryMuscles.join(', ')}` : null,
                exercise.secondaryMuscles.length > 0 ? `Secondary · ${exercise.secondaryMuscles.join(', ')}` : null,
                exercise.equipment ? `Equipment · ${exercise.equipment}` : null,
                exercise.difficulty ? `Level · ${exercise.difficulty}` : null,
              ].filter(Boolean).join('\n')}
            </Text>
            <View style={styles.mediaSlot}>
              <Text style={styles.mediaSlotText}>MEDIA — LICENSED GIF PACK PENDING</Text>
            </View>
          </View>
        </View>
        {exercise.instructions.length > 0 ? (
          <Text style={styles.detailInstructions} numberOfLines={6}>
            {exercise.instructions.slice(0, 3).join(' ')}
          </Text>
        ) : null}
        <CTA label="Add to session" onPress={() => { onClose(); onPick(exercise, false); }} />
        <Pressable onPress={() => { onClose(); onPick(exercise, true); }}>
          <Text style={styles.addAsTimed}>ADD AS TIMED (PLANK-STYLE) →</Text>
        </Pressable>
        <SrcNote>Primary solid · secondary faded · muscle data from free-exercise-db</SrcNote>
      </View>
    </Modal>
  );
}

function PrsSheet({ open, onClose, ex }: { open: boolean; onClose: () => void; ex: SessionExerciseState }) {
  const insets = useSafeAreaInsets();
  const [sharing, setSharing] = useState(false);
  if (sharing) {
    return (
      <ShareSheet open onClose={() => setSharing(false)} filename="basalt-prs.png">
        <PrShareCard exerciseName={ex.exercise.name} repPrs={ex.repPrs} bestE1rm={ex.historyBestE1rm} />
      </ShareSheet>
    );
  }
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.dim} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: 22 + insets.bottom }]}>
        <Text style={styles.sheetTitle}>REP PRS — {ex.exercise.name.toUpperCase()}</Text>
        {ex.repPrs.map((pr, i) => (
          <ReceiptRow
            key={pr.reps}
            name={`${pr.reps} ${pr.reps === 1 ? 'rep' : 'reps'}`}
            meta={new Date(pr.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
            value={String(pr.weightKg)}
            unit="kg"
            last={i === ex.repPrs.length - 1}
          />
        ))}
        <Pressable onPress={() => setSharing(true)}>
          <Text style={styles.addSet}>SHARE AS IMAGE →</Text>
        </Pressable>
        <SrcNote>Best real weight at each rep count · from your working sets only · untrained rep counts don't appear</SrcNote>
      </View>
    </Modal>
  );
}

function PlatesSheet({ open, onClose, targetKgText }: {
  open: boolean; onClose: () => void; targetKgText: string;
}) {
  const insets = useSafeAreaInsets();
  const [kgText, setKgText] = useState(targetKgText);
  const [barKg, setBarKg] = useState(20);
  useEffect(() => { if (open) setKgText(targetKgText); }, [open, targetKgText]);
  const target = parseFloat(kgText.replace(',', '.'));
  const breakdown = isFinite(target) ? platesFor(target, { barKg }) : null;
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.dim} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: 22 + insets.bottom }]}>
        <Text style={styles.sheetTitle}>PLATE CALCULATOR</Text>
        <ObInput placeholder="Target (kg)" keyboardType="decimal-pad" value={kgText} onChangeText={setKgText} />
        <ChipRow options={['20 kg bar', '15 kg bar']} value={`${barKg} kg bar`} onChange={(v) => setBarKg(parseInt(v, 10))} />
        {breakdown ? (
          <>
            <Text style={styles.platesLine}>{platesText(breakdown)}</Text>
            {breakdown.residualKg !== 0 ? (
              <Text style={styles.platesResidual}>
                {`loads ${breakdown.achievableKg} kg — ${Math.abs(breakdown.residualKg)} kg short of ${breakdown.requestedKg}`}
              </Text>
            ) : null}
          </>
        ) : kgText.trim() !== '' ? (
          <Text style={styles.platesResidual}>below bar weight — nothing to load</Text>
        ) : null}
        {breakdown && isFinite(target) && target > barKg ? (
          <>
            <Text style={styles.warmupTitle}>WARM-UP RAMP</Text>
            {warmupSets(target, barKg).map((w) => (
              <Text key={w.label} style={styles.warmupLine}>
                {`${w.kg} kg × ${w.reps}`}
                <Text style={styles.warmupPct}>{`  ·  ${w.label}`}</Text>
              </Text>
            ))}
          </>
        ) : null}
        <SrcNote>Per-side loading · plates 25 / 20 / 15 / 10 / 5 / 2.5 / 1.25 kg · ramp: bar ×10 · 55% ×5 · 70% ×3 · 85% ×1</SrcNote>
      </View>
    </Modal>
  );
}

function RpeSheet({ open, busy, onClose, onFinish }: {
  open: boolean; busy: boolean; onClose: () => void; onFinish: (rpe: number | null) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.dim} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: 22 + insets.bottom }]}>
        <Text style={styles.sheetTitle}>HOW HARD WAS THE SESSION? · RPE</Text>
        <ChipRow
          options={['6', '7', '8', '9', '10']}
          onChange={(v) => onFinish(parseInt(v, 10))}
        />
        <Pressable onPress={() => onFinish(null)} disabled={busy}>
          <Text style={styles.skipRpe}>SKIP — END WITHOUT A RATING</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function KeepAwakeWhileTraining() {
  // Mounted only during an active session: the screen stays awake so the
  // timers are visible. Screen-off continuation is the foreground
  // service's job (timerService.ts); wall-clock catch-up in the store
  // covers anything the OS still throttles.
  useKeepAwake();
  return null;
}

export function ExercisePicker({
  open, onClose, onPick, myEquipment, hasEquipmentProfile, loadedRegions,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (e: Exercise, timed: boolean) => void;
  myEquipment: string[];
  hasEquipmentProfile: boolean;
  loadedRegions?: Set<BodyRegion>;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const conditions = useAppStore((s) => s.profile?.conditions ?? []);
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);
  const [mineOnly, setMineOnly] = useState(false);
  const [results, setResults] = useState<(Exercise & { bias: ConditionBias })[]>([]);
  const [detailFor, setDetailFor] = useState<Exercise | null>(null);

  const MUSCLES = ['chest', 'shoulders', 'quadriceps', 'hamstrings', 'lats', 'middle back', 'biceps', 'triceps', 'abdominals', 'glutes', 'calves'];

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      void getExercises(supabase, {
        search: query || undefined,
        muscle: muscle ?? undefined,
        equipment: mineOnly ? myEquipment : undefined,
        limit: 40,
      }).then((r) => r.ok && setResults(biasOrder(r.data, conditions)));
    }, 200);
    return () => clearTimeout(t);
  }, [open, query, muscle, mineOnly, myEquipment, conditions]);

  const biasedCount = results.filter((e) => e.bias.down).length;

  return (
    <Modal visible={open} animationType="fade" onRequestClose={onClose}>
      <View style={[styles.picker, { backgroundColor: theme.surfaces.bg, paddingTop: insets.top + 12, paddingBottom: insets.bottom }]}>
        <View style={styles.pickerHead}>
          <Text style={styles.pickerTitle}>Library</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={styles.pickerClose}>CLOSE</Text>
          </Pressable>
        </View>
        <View style={{ paddingHorizontal: 16 }}>
          <SearchBar placeholder="Search 873 movements…" value={query} onChangeText={setQuery} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.chips}>
          {hasEquipmentProfile ? (
            <Chip label="My equipment" on={mineOnly} accent={color.carbs} onPress={() => setMineOnly(!mineOnly)} />
          ) : null}
          {MUSCLES.map((m) => (
            <Chip key={m} label={m} on={muscle === m} onPress={() => setMuscle(muscle === m ? null : m)} />
          ))}
        </ScrollView>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          {results.map((e, i) => (
            <Pressable key={e.id} onPress={() => setDetailFor(e)} hitSlop={8}>
              <ReceiptRow
                name={e.name}
                meta={
                  (loadedRegions && e.primaryMuscles.some((m) => loadedRegions.has(REGION_FOR_MUSCLE[m.toLowerCase()]!)) ? '· trained recently ' : '') +
                  (e.bias.down
                    ? `${[...e.primaryMuscles, e.equipment ?? ''].filter(Boolean).join(' · ')} · listed lower — ${e.bias.reason} (you noted ${e.bias.condition?.toLowerCase()})`
                    : [...e.primaryMuscles, e.equipment ?? '', e.difficulty ?? ''].filter(Boolean).join(' · '))
                }
                value="→"
                last={i === results.length - 1}
              />
            </Pressable>
          ))}
          {results.length === 0 ? (
            <EmptyState>No movements match those filters.</EmptyState>
          ) : null}
        </ScrollView>
        <ExerciseDetailSheet exercise={detailFor} onClose={() => setDetailFor(null)} onPick={onPick} />
        <SrcNote center>
          {biasedCount > 0
            ? `Source · free-exercise-db · ${biasedCount} listed lower for your noted conditions — nothing is hidden, published rules`
            : 'Source · free-exercise-db · 873 movements'}
        </SrcNote>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: color.bg },
  content: { paddingHorizontal: 16, paddingBottom: 24 },
  elapsed: { fontFamily: mono, fontSize: 11, letterSpacing: 1.2, color: color.faint, textAlign: 'right', marginTop: 10 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addSet: { fontFamily: mono, fontSize: 11, letterSpacing: 1.2, color: color.mute, paddingVertical: 10 },
  rowActions: { flexDirection: 'row', justifyContent: 'space-between' },
  linkAction: { fontFamily: mono, fontSize: 11, letterSpacing: 0.85, color: color.faint, paddingTop: 8 },
  suggestion: { fontFamily: mono, fontSize: 11, letterSpacing: 0.38, color: color.mute, lineHeight: 15, marginTop: 6 },
  fbRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  fbLabel: { fontFamily: mono, fontSize: 11, letterSpacing: 0.85, color: color.faint },
  fbChip: {
    fontFamily: mono, fontSize: 11, letterSpacing: 0.7, color: color.mute,
    borderWidth: StyleSheet.hairlineWidth, borderColor: color.border2, borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 5, overflow: 'hidden',
  },
  fbChipOn: { color: color.ink, borderColor: color.ink2 },
  warmupTitle: { fontFamily: mono, fontSize: 11, letterSpacing: 0.85, color: color.faint, marginTop: 16 },
  warmupLine: { fontFamily: mono, fontSize: 14, color: color.ink, marginTop: 6, fontVariant: ['tabular-nums'] },
  warmupPct: { fontSize: 11, color: color.faint },
  pickerLinks: { flexDirection: 'row', justifyContent: 'space-between' },
  detailRow: { flexDirection: 'row', gap: 18, alignItems: 'flex-start', marginTop: 14 },
  detailMeta: { fontFamily: mono, fontSize: 11.5, color: color.ink2, lineHeight: 17, letterSpacing: 0.3 },
  detailInstructions: { fontSize: 12.5, color: color.mute, lineHeight: 18, marginTop: 12 },
  mediaSlot: {
    borderWidth: StyleSheet.hairlineWidth, borderColor: color.border2, borderStyle: 'dashed',
    borderRadius: 10, padding: 12, marginTop: 12, alignItems: 'center',
  },
  mediaSlotText: { fontFamily: mono, fontSize: 11, letterSpacing: 0.8, color: color.faint },
  dim: { flex: 1, backgroundColor: 'rgba(5,6,8,.6)' },
  sheet: {
    backgroundColor: color.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border2,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  sheetTitle: { fontFamily: mono, fontSize: 11, letterSpacing: 1.2, color: color.mute },
  platesLine: { fontFamily: mono, fontSize: 14, color: color.ink, marginTop: 14 },
  platesResidual: { fontFamily: mono, fontSize: 11, color: color.fat, marginTop: 8 },
  skipRpe: { fontFamily: mono, fontSize: 11, letterSpacing: 1.2, color: color.faint, textAlign: 'center', paddingVertical: 14 },
  error: { fontSize: 12.5, color: color.fat, marginTop: 10 },
  cfgRow: { flexDirection: 'row', gap: 10, marginTop: 12, justifyContent: 'center' },
  picker: { flex: 1, backgroundColor: color.bg, paddingHorizontal: 0 },
  pickerHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 16 },
  pickerTitle: { fontSize: 21, fontWeight: '650' as any, letterSpacing: -0.21, color: color.ink },
  pickerClose: { fontFamily: mono, fontSize: 11, letterSpacing: 1.2, color: color.faint },
  chips: { gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  timedLink: { fontFamily: mono, fontSize: 10.5, letterSpacing: 0.85, color: color.faint, paddingBottom: 8, marginTop: -4 },
  addAsTimed: { fontFamily: mono, fontSize: 11, letterSpacing: 0.9, color: color.mute, textAlign: 'center', paddingVertical: 12 },
});
