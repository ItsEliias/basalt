import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CTA, ChipRow, ReceiptRow, SrcNote, mono, ScaledText as Text } from '@basalt/ui';
import {
  adaptSession, adaptSummary, getExercises,
  type AdaptChange, type AdaptMode, type Exercise,
} from '@basalt/training';
import { supabase } from '../../lib/supabase';
import { useSessionStore } from '../../state/sessionStore';
import { useTheme } from '@basalt/ui';

// Adapt Session — propose, show every change with its why, apply only on
// confirm. Exercises with logged sets are never touched (the engine
// returns them as keeps; the list says so).

const MODES: { label: string; mode: AdaptMode | 'exclude' }[] = [
  { label: 'Less time', mode: { kind: 'less_time' } },
  { label: 'No equipment', mode: { kind: 'no_equipment' } },
  { label: 'Train quietly', mode: { kind: 'quiet' } },
  { label: 'Exclude a muscle', mode: 'exclude' },
];

export function AdaptSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const session = useSessionStore();
  const [picking, setPicking] = useState<'mode' | 'muscle' | 'confirm'>('mode');
  const [proposal, setProposal] = useState<AdaptChange<Exercise>[] | null>(null);
  const [busy, setBusy] = useState(false);

  const muscles = Array.from(
    new Set(session.exercises.flatMap((e) => e.exercise.primaryMuscles)),
  );

  const reset = () => {
    setPicking('mode');
    setProposal(null);
    onClose();
  };

  const propose = async (mode: AdaptMode) => {
    setBusy(true);
    // Candidate pool: the library filtered per primary muscle in play, so
    // swaps always have relevant cover to draw from.
    const perMuscle = await Promise.all(
      muscles.map((m) => getExercises(supabase, { muscle: m, limit: 60 })),
    );
    const library = perMuscle.flatMap((r) => (r.ok ? r.data : []));
    const items = session.exercises.map((e) => ({
      id: e.sessionExerciseId,
      committedSets: e.rows.filter((r) => r.committed).length,
      plannedSets: e.rows.length,
      exercise: e.exercise,
    }));
    setProposal(adaptSession(items, mode, library));
    setPicking('confirm');
    setBusy(false);
  };

  const nameFor = (id: string) =>
    session.exercises.find((e) => e.sessionExerciseId === id)?.exercise.name ?? '';

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={reset}>
      <Pressable style={styles.dim} onPress={reset} />
      <View style={[styles.sheet, { backgroundColor: theme.surfaces.surface, borderTopColor: theme.surfaces.borderStrong }, { paddingBottom: 22 + insets.bottom }]}>
        <Text style={[styles.title, { color: theme.text.mute }]}>ADAPT SESSION</Text>

        {picking === 'mode' ? (
          <>
            {MODES.map((m) => (
              <Pressable
                key={m.label}
                disabled={busy}
                hitSlop={8}
                onPress={() => {
                  if (m.mode === 'exclude') setPicking('muscle');
                  else void propose(m.mode);
                }}
              >
                <ReceiptRow name={busy ? '…' : m.label} value="→" valueColor={theme.text.faint} />
              </Pressable>
            ))}
            <SrcNote>Proposes changes first — nothing is applied until you confirm</SrcNote>
          </>
        ) : null}

        {picking === 'muscle' ? (
          <>
            <Text style={[styles.label, { color: theme.text.mute }]}>LEAVE ALONE TODAY</Text>
            <ChipRow
              options={muscles}
              onChange={(muscle) => void propose({ kind: 'exclude_muscle', muscle })}
            />
          </>
        ) : null}

        {picking === 'confirm' && proposal ? (
          <>
            <ScrollView style={{ maxHeight: 320 }}>
              {proposal.map((c, i) => (
                <ReceiptRow
                  key={c.id}
                  name={c.action === 'swap' ? `${nameFor(c.id)} → ${c.replacement?.name}` : nameFor(c.id)}
                  meta={c.why}
                  value={c.action.toUpperCase()}
                  valueColor={c.action === 'keep' ? theme.text.faint : c.action === 'drop' ? theme.text.fat : theme.text.carbs}
                  last={i === proposal.length - 1}
                />
              ))}
            </ScrollView>
            <CTA
              label={busy ? '…' : `Apply — ${adaptSummary(proposal)}`}
              disabled={busy}
              onPress={async () => {
                setBusy(true);
                await session.applyAdapt(proposal);
                setBusy(false);
                reset();
              }}
            />
            <SrcNote>Logged sets are never touched · every change states its why</SrcNote>
          </>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: { flex: 1, backgroundColor: 'rgba(5,6,8,.6)' },
  sheet: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  title: { fontFamily: mono, fontSize: 11, letterSpacing: 1.2 },
  label: { fontFamily: mono, fontSize: 11, letterSpacing: 1.14, marginTop: 14 },
});
