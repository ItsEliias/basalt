import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Card, EmptyState, SrcNote, ReceiptHeader, ObInput,
  color, mono, ScaledText as Text,
} from '@basalt/ui';
import {
  getMyPair, createPair, joinPair, endPair, loadCoop,
  COOP_DOT_RULE, type Pair, type CoopReport,
} from '@basalt/analytics';
import { supabase } from '../../lib/supabase';

// 1-v-1 co-op — showing up, side by side. Dots are the only thing that
// crosses (engine-pinned: no comparisons, no points, no cheerleading).

export function CoopCard() {
  const [pair, setPair] = useState<Pair | null | undefined>(undefined);
  const [report, setReport] = useState<CoopReport | null>(null);
  const [claimText, setClaimText] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [openSetup, setOpenSetup] = useState(false);

  const refresh = useCallback(() => {
    void getMyPair(supabase).then((r) => {
      if (!r.ok) return;
      setPair(r.data);
      if (r.data && r.data.bId) {
        void loadCoop(supabase, r.data).then((c) => c.ok && setReport(c.data));
      }
    });
  }, []);
  useEffect(() => refresh(), [refresh]);

  if (pair === undefined) return null;

  const dotRow = (kind: 'mine' | 'theirs') =>
    report
      ? report.days.map((d) => {
          const v = d[kind];
          return v === null ? '·' : v ? '●' : '○';
        }).join(' ')
      : '';

  return (
    <Card>
      <ReceiptHeader label="One friend" summary={pair && pair.bId ? 'dots only — nothing else crosses' : undefined} />

      {pair === null && !openSetup ? (
        <Pressable onPress={() => setOpenSetup(true)} hitSlop={8}>
          <EmptyState>
            Pair with exactly one person and share consistency dots — a boolean per day, computed on
            your own phone. No feed, no numbers, no comparison. Tap to set up.
          </EmptyState>
        </Pressable>
      ) : null}

      {pair === null && openSetup ? (
        <>
          <Pressable
            onPress={() => {
              void createPair(supabase).then((r) => {
                if (r.ok) refresh();
                else setMessage(r.error);
              });
            }}
            hitSlop={8}
          >
            <Text style={styles.link}>CREATE A CODE FOR YOUR PERSON</Text>
          </Pressable>
          <View style={styles.claimRow}>
            <ObInput
              placeholder="Or enter their code"
              value={claimText}
              onChangeText={setClaimText}
              autoCapitalize="characters"
              style={{ flex: 1 }}
            />
            <Pressable
              onPress={() => {
                void joinPair(supabase, claimText).then((r) => {
                  if (r.ok) { setClaimText(''); refresh(); }
                  else setMessage(r.error);
                });
              }}
              hitSlop={10}
              disabled={!claimText.trim()}
            >
              <Text style={styles.link}>JOIN</Text>
            </Pressable>
          </View>
        </>
      ) : null}

      {pair && !pair.bId ? (
        <>
          <View style={styles.codeBox}>
            <Text style={styles.codeText}>{pair.inviteCode}</Text>
          </View>
          <SrcNote>Waiting for your person — single use, expires in 48 h · hold below to cancel</SrcNote>
        </>
      ) : null}

      {pair && pair.bId && report ? (
        <>
          <View style={styles.dotBlock}>
            <Text style={styles.dotLabel}>YOU</Text>
            <Text style={styles.dots}>{dotRow('mine')}</Text>
            <Text style={styles.dotLabel}>THEM</Text>
            <Text style={styles.dots}>{dotRow('theirs')}</Text>
          </View>
          <SrcNote>{`${report.mineLine} · ${report.theirsLine} — last 14 days, oldest left`}</SrcNote>
          <SrcNote>{COOP_DOT_RULE}</SrcNote>
          <SrcNote>{report.srcnote}</SrcNote>
        </>
      ) : null}

      {pair ? (
        <Pressable
          onLongPress={() => void endPair(supabase, pair.id).then(() => { setReport(null); setOpenSetup(false); refresh(); })}
          hitSlop={8}
        >
          <Text style={styles.link}>HOLD TO END THE PAIR — DOTS STOP CROSSING IMMEDIATELY</Text>
        </Pressable>
      ) : null}
      {message ? <SrcNote>{message}</SrcNote> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  link: { fontFamily: mono, fontSize: 10.5, letterSpacing: 0.85, color: color.faint, textAlign: 'center', paddingVertical: 10 },
  claimRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  codeBox: { borderWidth: StyleSheet.hairlineWidth, borderColor: color.border, borderRadius: 8, paddingVertical: 14, marginTop: 8, alignItems: 'center' },
  codeText: { fontFamily: mono, fontSize: 22, letterSpacing: 6, color: color.ink },
  dotBlock: { paddingVertical: 8, gap: 2 },
  dotLabel: { fontFamily: mono, fontSize: 10.5, letterSpacing: 1.2, color: color.faint },
  dots: { fontFamily: mono, fontSize: 13, letterSpacing: 2, color: color.ink, marginBottom: 6 },
});
