import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, ReceiptHeader, ReceiptRow, ExerciseHead, EmptyState, color, mono, mmss, ScaledText as Text } from '@basalt/ui';
import { getSessionDetail, type SessionDetail } from '@basalt/training';
import { supabase } from '../lib/supabase';

// Read-only drill-down for a past session — the "Recent sessions" rows on
// Train had no way to see what was actually trained; this closes that gap
// with the same sheet pattern WeightSheet/QuickLogSheet already use, not a
// new navigation stack.

export function SessionDetailSheet({ sessionId, onClose }: { sessionId: string | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sessionId) { setDetail(null); return; }
    setLoading(true);
    void getSessionDetail(supabase, sessionId).then((r) => {
      setLoading(false);
      if (r.ok) setDetail(r.data);
    });
  }, [sessionId]);

  const open = sessionId !== null;
  const s = detail?.session;
  const durationLabel = s?.endedAt ? mmss((Date.parse(s.endedAt) - Date.parse(s.startedAt)) / 1000) : null;

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.dim} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: 22 + insets.bottom, maxHeight: '82%' }]}>
        <View style={styles.grab} />
        {s ? (
          <View style={styles.head}>
            <Text style={styles.date}>
              {new Date(s.startedAt).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' })}
            </Text>
            <Text style={styles.meta}>
              {new Date(s.startedAt).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}
              {durationLabel ? ` · ${durationLabel} duration` : ' · in progress'}
              {s.sessionRpe != null ? ` · RPE ${s.sessionRpe}` : ''}
            </Text>
            {s.notes?.trim() ? <Text style={styles.notes}>{s.notes}</Text> : null}
          </View>
        ) : null}
        <ScrollView style={{ marginTop: 4 }} showsVerticalScrollIndicator={false}>
          {loading ? (
            <Text style={styles.loading}>Reading the session…</Text>
          ) : detail && detail.exercises.length > 0 ? (
            detail.exercises.map((ex) => (
              <Card key={ex.id} style={{ marginBottom: 12 }}>
                <ExerciseHead name={ex.exerciseName} meta={`${ex.sets.length} set${ex.sets.length === 1 ? '' : 's'}`} />
                {ex.sets.map((set, i) => (
                  <ReceiptRow
                    key={set.id}
                    name={`Set ${set.setNumber}`}
                    meta={set.rir != null ? `RIR ${set.rir}` : set.rpe != null ? `RPE ${set.rpe}` : undefined}
                    value={
                      set.weightKg != null
                        ? `${set.weightKg} kg × ${set.reps ?? '—'}`
                        : set.durationS != null
                          ? mmss(set.durationS)
                          : `${set.reps ?? '—'} reps`
                    }
                    last={i === ex.sets.length - 1}
                  />
                ))}
              </Card>
            ))
          ) : (
            <EmptyState>No exercises recorded for this session.</EmptyState>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: { flex: 1, backgroundColor: 'rgba(5,6,8,.6)' },
  sheet: {
    backgroundColor: color.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border2,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  grab: { width: 34, height: 3, borderRadius: 2, backgroundColor: color.border2, alignSelf: 'center', marginTop: 4, marginBottom: 14 },
  head: { marginBottom: 8 },
  date: { fontSize: 18, fontWeight: '650' as any, color: color.ink },
  meta: { fontFamily: mono, fontSize: 12, color: color.faint, marginTop: 4 },
  notes: { fontSize: 13.5, color: color.ink2, marginTop: 8 },
  loading: { fontFamily: mono, fontSize: 12, color: color.faint, paddingVertical: 20, textAlign: 'center' },
});
