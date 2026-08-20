import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Card, EmptyState, SrcNote, ReceiptHeader, ReceiptRow, SearchBar, CTA, Chip,
  ExerciseHead, PrevNote, SetsHeader, SetRow, RestTimerBar,
  GuidedTimerDisplay, GuidedTimerConfig, Stepper, TileGrid, StatTile,
  color, mono, mmss, groupInt,
} from '@basalt/ui';
import {
  getExercises, listRecentSessions, prevSummary, sessionVolumeKg, bestE1rm,
  describe as describeGuided,
  type Exercise, type WorkoutSession,
} from '@basalt/training';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../state/appStore';
import { useSessionStore, type SessionExerciseState } from '../../state/sessionStore';
import { equipmentTokens, prevCellText, exerciseMetaText, elapsedText } from './model';

// Train — the relational set logger. Prev values ghost as editable defaults,
// completion is a typographic state change with a quiet PR mark, rest timers
// remember per exercise, timed movements get the guided set timer.

export function TrainScreen() {
  const profile = useAppStore((s) => s.profile);
  const bumpToday = useAppStore((s) => s.bumpToday);
  const session = useSessionStore();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [recent, setRecent] = useState<WorkoutSession[]>([]);
  const [, forceClock] = useState(0);

  useEffect(() => {
    if (!session.sessionId) {
      void listRecentSessions(supabase, 8).then((r) => r.ok && setRecent(r.data));
    }
  }, [session.sessionId]);

  // A light 1 Hz repaint for the header clock + timers while a session runs.
  useEffect(() => {
    if (!session.sessionId) return;
    const iv = setInterval(() => forceClock((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, [session.sessionId]);

  if (!session.sessionId) {
    return (
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
          <ReceiptHeader label="Recent sessions" />
          {recent.length > 0 ? (
            recent.map((s, i) => (
              <ReceiptRow
                key={s.id}
                name={s.notes?.trim() || 'Training session'}
                meta={new Date(s.startedAt).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
                value={s.endedAt ? mmss((Date.parse(s.endedAt) - Date.parse(s.startedAt)) / 1000) : '—'}
                unit={s.endedAt ? 'duration' : 'open'}
                last={i === recent.length - 1}
              />
            ))
          ) : (
            <EmptyState>No sessions yet. The first one starts the history every Prev column draws from.</EmptyState>
          )}
        </Card>
      </ScrollView>
    );
  }

  return (
    <>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.elapsed}>
          {session.startedAt ? `${elapsedText(session.startedAt, new Date())} ELAPSED` : ''}
        </Text>

        {session.exercises.map((ex) => (
          <ExerciseCard key={ex.sessionExerciseId} ex={ex} />
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

        <CTA label={session.busy ? '…' : 'End session'} disabled={session.busy} onPress={() => { void session.finish(null).then(bumpToday); }} />
        {session.error ? <Text style={styles.error}>{session.error}</Text> : null}
      </ScrollView>

      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
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

function ExerciseCard({ ex }: { ex: SessionExerciseState }) {
  const session = useSessionStore();
  const restHere = session.rest?.sessionExerciseId === ex.sessionExerciseId;

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
          <View style={styles.cfgRow}>
            <Stepper value={`${ex.guided.config.workS}s work`} onMinus={() => session.guidedConfigure(ex.sessionExerciseId, { workS: Math.max(5, ex.guided!.config.workS - 5) })} onPlus={() => session.guidedConfigure(ex.sessionExerciseId, { workS: ex.guided!.config.workS + 5 })} />
            <Stepper value={`${ex.guided.config.sets} sets`} onMinus={() => session.guidedConfigure(ex.sessionExerciseId, { sets: Math.max(1, ex.guided!.config.sets - 1) })} onPlus={() => session.guidedConfigure(ex.sessionExerciseId, { sets: ex.guided!.config.sets + 1 })} />
          </View>
        ) : null}
        <GuidedTimerDisplay
          seconds={ex.guided.phase === 'finished' ? '✓' : String(d.seconds)}
          phaseLabel={d.label}
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
        <SrcNote center>Haptics on phase change · sets auto-logged as duration · keep the screen on for now</SrcNote>
      </Card>
    );
  }

  return (
    <Card>
      <ExerciseHead name={ex.exercise.name} meta={exerciseMetaText(ex.exercise.primaryMuscles, ex.exercise.equipment)} />
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
          onChangeKg={(kg) => session.updateRow(ex.sessionExerciseId, i, { kg, committed: false })}
          onChangeReps={(reps) => session.updateRow(ex.sessionExerciseId, i, { reps, committed: false })}
          onChangeRir={(rir) => session.updateRow(ex.sessionExerciseId, i, { rir, committed: false })}
          onCommit={() => void session.commitRow(ex.sessionExerciseId, i)}
        />
      ))}
      <Pressable onPress={() => session.addRow(ex.sessionExerciseId)}>
        <Text style={styles.addSet}>+ ADD SET</Text>
      </Pressable>
      {restHere && session.rest ? (
        <RestTimerBar time={mmss(session.rest.remaining)} onSkip={session.skipRest} />
      ) : null}
    </Card>
  );
}

function ExercisePicker({
  open, onClose, onPick, myEquipment, hasEquipmentProfile,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (e: Exercise, timed: boolean) => void;
  myEquipment: string[];
  hasEquipmentProfile: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);
  const [mineOnly, setMineOnly] = useState(false);
  const [results, setResults] = useState<Exercise[]>([]);

  const MUSCLES = ['chest', 'shoulders', 'quadriceps', 'hamstrings', 'lats', 'middle back', 'biceps', 'triceps', 'abdominals', 'glutes', 'calves'];

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      void getExercises(supabase, {
        search: query || undefined,
        muscle: muscle ?? undefined,
        equipment: mineOnly ? myEquipment : undefined,
        limit: 40,
      }).then((r) => r.ok && setResults(r.data));
    }, 200);
    return () => clearTimeout(t);
  }, [open, query, muscle, mineOnly, myEquipment]);

  return (
    <Modal visible={open} animationType="fade" onRequestClose={onClose}>
      <View style={[styles.picker, { paddingTop: insets.top + 12, paddingBottom: insets.bottom }]}>
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
            <View key={e.id}>
              <Pressable onPress={() => onPick(e, false)}>
                <ReceiptRow
                  name={e.name}
                  meta={[...e.primaryMuscles, e.equipment ?? '', e.difficulty ?? ''].filter(Boolean).join(' · ')}
                  value="add"
                  last={i === results.length - 1}
                />
              </Pressable>
              <Pressable onPress={() => onPick(e, true)}>
                <Text style={styles.timedLink}>ADD AS TIMED (PLANK-STYLE) →</Text>
              </Pressable>
            </View>
          ))}
          {results.length === 0 ? (
            <EmptyState>No movements match those filters.</EmptyState>
          ) : null}
        </ScrollView>
        <SrcNote center>Source · free-exercise-db · 873 movements</SrcNote>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: color.bg },
  content: { paddingHorizontal: 16, paddingBottom: 24 },
  elapsed: { fontFamily: mono, fontSize: 10, letterSpacing: 1.2, color: color.faint, textAlign: 'right', marginTop: 10 },
  addSet: { fontFamily: mono, fontSize: 10, letterSpacing: 1.2, color: color.mute, paddingVertical: 10 },
  error: { fontSize: 12.5, color: color.fat, marginTop: 10 },
  cfgRow: { flexDirection: 'row', gap: 10, marginTop: 12, justifyContent: 'center' },
  picker: { flex: 1, backgroundColor: color.bg, paddingHorizontal: 0 },
  pickerHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 16 },
  pickerTitle: { fontSize: 21, fontWeight: '650' as any, letterSpacing: -0.21, color: color.ink },
  pickerClose: { fontFamily: mono, fontSize: 10, letterSpacing: 1.2, color: color.faint },
  chips: { gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  timedLink: { fontFamily: mono, fontSize: 8.5, letterSpacing: 0.85, color: color.faint, paddingBottom: 8, marginTop: -4 },
});
