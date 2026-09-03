import { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import Svg, { Circle, Path } from 'react-native-svg';
import { CTA, SrcNote, mono, mmss, paceText, groupInt } from '@basalt/ui';
import { projectRoute, type RepPr, type WalkRow } from '@basalt/training';
import type { WeekReview } from '@basalt/analytics';
import { useTheme } from '@basalt/ui';

// Shareable summary cards — the editorial style, rendered off the real
// ledger and captured as an image for the share sheet. One small BASALT
// wordmark, no watermark spam, and the route is drawn as pure geometry
// (your GPS line, no tiles) so the image needs no tile attribution.

export function ShareSheet({ open, onClose, filename, children }: {
  open: boolean;
  onClose: () => void;
  filename: string;
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const cardRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const share = async () => {
    setBusy(true);
    setError(null);
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      await Sharing.shareAsync(uri.startsWith('file://') ? uri : `file://${uri}`, {
        mimeType: 'image/png',
        dialogTitle: filename,
      });
    } catch (e: any) {
      setError(e?.message ?? 'Could not render the card.');
    }
    setBusy(false);
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.dim} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: theme.surfaces.surface, borderTopColor: theme.surfaces.borderStrong }, { paddingBottom: 22 + insets.bottom }]}>
        <View ref={cardRef} collapsable={false} style={[styles.card, { backgroundColor: theme.surfaces.bg, borderColor: theme.surfaces.borderStrong }]}>
          {children}
        </View>
        <CTA label={busy ? '…' : 'Share as image'} disabled={busy} onPress={() => void share()} />
        {error ? <SrcNote>{error}</SrcNote> : (
          <SrcNote>Rendered from your ledger · shared only where you send it</SrcNote>
        )}
      </View>
    </Modal>
  );
}

function CardHead({ kind }: { kind: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.head}>
      <Text style={[styles.wordmark, { color: theme.text.ink }]}>BASALT</Text>
      <Text style={[styles.kind, { color: theme.text.faint }]}>{kind}</Text>
    </View>
  );
}

// ─── Walk ───────────────────────────────────────────────────────────────────

const ROUTE_W = 300;
const ROUTE_H = 170;

export function WalkShareCard({ walk }: { walk: WalkRow }) {
  const { theme } = useTheme();
  const projected = walk.route ? projectRoute(walk.route, { widthPx: ROUTE_W, heightPx: ROUTE_H, padPx: 14 }) : null;
  const d = projected && projected.points.length > 1
    ? projected.points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
    : null;
  return (
    <View>
      <CardHead kind="WALK" />
      <Text style={[styles.big, { color: theme.text.ink }]}>
        {(walk.distanceM / 1000).toFixed(2)}
        <Text style={[styles.bigUnit, { color: theme.text.mute }]}> km</Text>
      </Text>
      <Text style={[styles.statLine, { color: theme.text.ink2 }]}>
        {[
          mmss(walk.durationS),
          walk.avgPaceSecPerKm ? `${paceText(walk.avgPaceSecPerKm)} /km` : null,
          walk.elevationGainM !== null ? `+${walk.elevationGainM} m` : null,
        ].filter(Boolean).join('   ·   ')}
      </Text>
      {d ? (
        <View style={styles.routeBox}>
          <Svg width="100%" height={ROUTE_H} viewBox={`0 0 ${ROUTE_W} ${ROUTE_H}`}>
            <Path d={d} fill="none" stroke={theme.fill.carbs} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
            {projected!.start ? (
              <Circle cx={projected!.start[0]} cy={projected!.start[1]} r={5} fill={theme.surfaces.bg} stroke={theme.fill.carbs} strokeWidth={2} />
            ) : null}
            {projected!.end ? (
              <Circle cx={projected!.end[0]} cy={projected!.end[1]} r={6} fill={theme.fill.carbs} stroke={theme.surfaces.bg} strokeWidth={2.5} />
            ) : null}
          </Svg>
          {projected!.scaleBar ? (
            <Text style={[styles.scale, { color: theme.text.faint, borderBottomColor: theme.fill.faint }, { borderBottomWidth: 1, width: projected!.scaleBar.px }]}>
              {projected!.scaleBar.label}
            </Text>
          ) : null}
        </View>
      ) : null}
      <Text style={[styles.foot, { color: theme.text.faint }]}>
        {new Date(walk.startedAt).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}
        {' · GPS ROUTE, NO TILES · FROM MY OWN LEDGER'}
      </Text>
    </View>
  );
}

// ─── Session rep-PR ─────────────────────────────────────────────────────────

export function PrShareCard({ exerciseName, repPrs, bestE1rm }: {
  exerciseName: string;
  repPrs: RepPr[];
  bestE1rm: number | null;
}) {
  const { theme } = useTheme();
  const top = [...repPrs].sort((a, b) => b.weightKg - a.weightKg).slice(0, 4);
  return (
    <View>
      <CardHead kind="REP PRS" />
      <Text style={[styles.title, { color: theme.text.ink }]}>{exerciseName}</Text>
      {top.map((pr) => (
        <View key={pr.reps} style={[styles.prRow, { borderBottomColor: theme.surfaces.border }]}>
          <Text style={[styles.prReps, { color: theme.text.mute }]}>{`${pr.reps} ${pr.reps === 1 ? 'REP' : 'REPS'}`}</Text>
          <Text style={[styles.prKg, { color: theme.text.ink }]}>
            {pr.weightKg}
            <Text style={[styles.bigUnit, { color: theme.text.mute }]}> kg</Text>
          </Text>
        </View>
      ))}
      <Text style={[styles.foot, { color: theme.text.faint }]}>
        {bestE1rm !== null ? `BEST E1RM ${bestE1rm} KG (EPLEY, PUBLISHED FORMULA) · ` : ''}
        FROM MY OWN SETS
      </Text>
    </View>
  );
}

// ─── Week in review ─────────────────────────────────────────────────────────

export function WeekShareCard({ review }: { review: WeekReview }) {
  const { theme } = useTheme();
  return (
    <View>
      <CardHead kind="WEEK IN REVIEW" />
      <Text style={[styles.kind, { color: theme.text.faint }]}>{review.rangeLabel.toUpperCase()}</Text>
      {review.lede ? <Text style={[styles.lede, { color: theme.text.ink }]}>{review.lede}</Text> : null}
      <View style={styles.wstatRow}>
        {review.stats.map((s) => (
          <View key={s.k}>
            <Text style={[styles.wstatK, { color: theme.text.faint }]}>{s.k.toUpperCase()}</Text>
            <Text style={[styles.wstatV, { color: theme.text.ink }]}>{s.v}</Text>
          </View>
        ))}
      </View>
      <Text style={[styles.foot, { color: theme.text.faint }]}>WRITTEN FROM MY DATA · ONE GAP NAMED · NO CHEERLEADING</Text>
    </View>
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
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 20,
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  wordmark: { fontFamily: mono, fontSize: 11, letterSpacing: 2.4 },
  kind: { fontFamily: mono, fontSize: 11, letterSpacing: 1.14 },
  big: { fontFamily: mono, fontSize: 44, fontVariant: ['tabular-nums'], letterSpacing: -1 },
  bigUnit: { fontSize: 15, letterSpacing: 0 },
  statLine: { fontFamily: mono, fontSize: 12, marginTop: 6, fontVariant: ['tabular-nums'] },
  routeBox: { marginTop: 14, backgroundColor: '#101216', borderRadius: 12, overflow: 'hidden', paddingBottom: 8 },
  scale: {
    fontFamily: mono, fontSize: 11,
    alignSelf: 'flex-end', textAlign: 'center', marginRight: 12, paddingBottom: 2,
  },
  title: { fontSize: 17, fontWeight: '600', marginBottom: 10 },
  prRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
    paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  prReps: { fontFamily: mono, fontSize: 11, letterSpacing: 1.14 },
  prKg: { fontFamily: mono, fontSize: 20, fontVariant: ['tabular-nums'] },
  lede: { fontSize: 13.5, lineHeight: 20, marginTop: 10 },
  wstatRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 14 },
  wstatK: { fontFamily: mono, fontSize: 11, letterSpacing: 0.9, marginBottom: 2 },
  wstatV: { fontFamily: mono, fontSize: 16, fontVariant: ['tabular-nums'] },
  foot: { fontFamily: mono, fontSize: 10.5, letterSpacing: 0.85, marginTop: 16, lineHeight: 13 },
});
