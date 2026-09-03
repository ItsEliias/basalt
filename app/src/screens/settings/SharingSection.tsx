import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, EmptyState, SrcNote, ReceiptHeader, ReceiptRow, CTA, ObInput, ObChipLabel, ChipRow, ChipGroup, mono, groupInt, ScaledText as Text } from '@basalt/ui';
import {
  SHARE_DOMAINS, SHARE_PRESETS, grantLine,
  createShareGrant, listMyGrants, listSharedWithMe, revokeShareGrant, redeemShareCode,
  isoDay,
  type ShareGrant, type ShareDomain, type ShareRole,
} from '@basalt/core-data';
import { supabase } from '../../lib/supabase';
import { logShareEvent } from '../../lib/instrumentation';
import { useTheme } from '@basalt/ui';

// Sharing — read-only grants (docs/SHARING-RLS-DESIGN.md). The server's
// RLS is the whole enforcement; this UI only ever states what it stores:
// who, which domains, which state. Revoke keeps the row so both parties
// see the history.

export function SharingSection() {
  const { theme } = useTheme();
  const [mine, setMine] = useState<ShareGrant[]>([]);
  const [withMe, setWithMe] = useState<ShareGrant[]>([]);
  const [creating, setCreating] = useState(false);
  const [role, setRole] = useState<ShareRole>('coach');
  const [domains, setDomains] = useState<ShareDomain[]>(SHARE_PRESETS.coach);
  const [freshCode, setFreshCode] = useState<ShareGrant | null>(null);
  const [redeemText, setRedeemText] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [viewer, setViewer] = useState<ShareGrant | null>(null);

  const refresh = useCallback(() => {
    void listMyGrants(supabase).then((r) => r.ok && setMine(r.data));
    void listSharedWithMe(supabase).then((r) => r.ok && setWithMe(r.data));
  }, []);
  useEffect(() => refresh(), [refresh]);

  const pickRole = (r: ShareRole) => {
    setRole(r);
    if (r !== 'custom') setDomains(SHARE_PRESETS[r]);
  };

  const create = async () => {
    const res = await createShareGrant(supabase, role, domains);
    if (res.ok) {
      logShareEvent({ type: 'share_grant_created', role });
      setFreshCode(res.data);
      setCreating(false);
      refresh();
    } else {
      setMessage(res.error);
    }
  };

  const redeem = async () => {
    setMessage(null);
    const res = await redeemShareCode(supabase, redeemText);
    if (res.ok) {
      logShareEvent({ type: 'share_code_redeemed' });
      setRedeemText('');
      refresh();
    } else {
      setMessage(res.error);
    }
  };

  return (
    <Card>
      <ReceiptHeader label="Sharing" summary="read-only · nothing shared by default" />

      {/* ── Grants I created ─────────────────────────────────────────── */}
      {mine.map((g, i) => (
        <Pressable
          key={g.id}
          onLongPress={() => {
            void revokeShareGrant(supabase, g.id).then(() => {
              logShareEvent({ type: 'share_grant_revoked' });
              refresh();
            });
          }}
          hitSlop={8}
        >
          <ReceiptRow
            name={grantLine(g)}
            meta={g.revokedAt ? 'access ended the moment you revoked' : 'hold to revoke — access ends at their next refresh'}
            value=""
            last={i === mine.length - 1 && !creating && !freshCode}
          />
        </Pressable>
      ))}
      {mine.length === 0 && !creating ? (
        <EmptyState>
          Share parts of your ledger with a coach or caregiver — read-only, per-domain, revocable
          with one hold. Nothing is shared until you create a grant.
        </EmptyState>
      ) : null}

      {freshCode ? (
        <>
          <View style={[styles.codeBox, { borderColor: theme.surfaces.border }]}>
            <Text style={[styles.codeText, { color: theme.text.ink }]}>{freshCode.inviteCode}</Text>
          </View>
          <SrcNote>{`Give this code to your ${freshCode.role === 'custom' ? 'person' : freshCode.role} — single use, expires in 48 h · they enter it in their own Basalt under Sharing`}</SrcNote>
          <Pressable onPress={() => setFreshCode(null)} hitSlop={8}>
            <Text style={[styles.link, { color: theme.text.faint }]}>DONE</Text>
          </Pressable>
        </>
      ) : null}

      {creating ? (
        <>
          <ObChipLabel>Preset</ObChipLabel>
          <ChipRow
            options={['coach', 'caregiver', 'custom']}
            value={role}
            onChange={(v) => pickRole(v as ShareRole)}
          />
          <ObChipLabel>What they can see — edit freely</ObChipLabel>
          <ChipGroup
            options={SHARE_DOMAINS.map((d) => d.label)}
            values={SHARE_DOMAINS.filter((d) => domains.includes(d.key)).map((d) => d.label)}
            onToggle={(label) => {
              const key = SHARE_DOMAINS.find((d) => d.label === label)!.key;
              setDomains((ds) => (ds.includes(key) ? ds.filter((k) => k !== key) : [...ds, key]));
            }}
          />
          {domains.map((k) => {
            const d = SHARE_DOMAINS.find((x) => x.key === k)!;
            return <SrcNote key={k}>{`${d.label}: ${d.includes}`}</SrcNote>;
          })}
          <CTA label="Create the code" disabled={domains.length === 0} onPress={() => void create()} />
          <Pressable onPress={() => setCreating(false)} hitSlop={8}>
            <Text style={[styles.link, { color: theme.text.faint }]}>CANCEL</Text>
          </Pressable>
        </>
      ) : (
        <Pressable onPress={() => { setCreating(true); setFreshCode(null); }} hitSlop={8}>
          <Text style={[styles.link, { color: theme.text.faint }]}>+ NEW GRANT</Text>
        </Pressable>
      )}

      {/* ── Shared with me ───────────────────────────────────────────── */}
      {withMe.length > 0 ? (
        <>
          <ObChipLabel>Shared with you</ObChipLabel>
          {withMe.map((g, i) => (
            <Pressable key={g.id} onPress={() => { logShareEvent({ type: 'share_viewer_opened' }); setViewer(g); }} hitSlop={8}>
              <ReceiptRow
                name={`${g.role} grant · ${g.domains.join(', ')}`}
                meta={`since ${g.createdAt.slice(0, 10)} · tap to view · they can revoke at any time`}
                value="view"
                last={i === withMe.length - 1}
              />
            </Pressable>
          ))}
        </>
      ) : null}

      <View style={styles.redeemRow}>
        <ObInput
          placeholder="Enter a code you were given"
          value={redeemText}
          onChangeText={setRedeemText}
          autoCapitalize="characters"
          style={{ flex: 1 }}
        />
        <Pressable onPress={() => void redeem()} hitSlop={10} disabled={!redeemText.trim()}>
          <Text style={[styles.link, { color: theme.text.faint }]}>CLAIM</Text>
        </Pressable>
      </View>
      {message ? <SrcNote>{message}</SrcNote> : null}
      <SrcNote>Grants are read-only by construction — the server has no write path for a grantee · cycle data is never in any preset and shares only if you pick it yourself · walk routes are stripped before a coach sees walks</SrcNote>

      <SharedViewerSheet grant={viewer} onClose={() => setViewer(null)} />
    </Card>
  );
}

// ── The read-only viewer — same receipt language, other ledger ────────

type ViewerData = {
  sessions28d?: number;
  lastSession?: string | null;
  walks?: { day: string; km: number }[];
  kcal7d?: { day: string; kcal: number }[];
  lastWeight?: { day: string; kg: number } | null;
  lastSleepMin?: number | null;
  checkin?: { day: string; mood: number | null } | null;
};

function SharedViewerSheet({ grant, onClose }: { grant: ShareGrant | null; onClose: () => void }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<ViewerData | null>(null);

  useEffect(() => {
    if (!grant) return;
    setData(null);
    const owner = grant.ownerId;
    const since28 = new Date();
    since28.setDate(since28.getDate() - 28);
    void (async () => {
      const d: ViewerData = {};
      if (grant.domains.includes('training')) {
        const r = await supabase
          .from('basalt_workout_sessions')
          .select('started_at')
          .eq('user_id', owner)
          .gte('started_at', since28.toISOString())
          .order('started_at', { ascending: false });
        d.sessions28d = (r.data ?? []).length;
        d.lastSession = r.data?.[0]?.started_at?.slice(0, 10) ?? null;
      }
      if (grant.domains.includes('activity')) {
        const r = await supabase
          .from('basalt_walks_shared')
          .select('started_at, distance_m')
          .eq('user_id', owner)
          .order('started_at', { ascending: false })
          .limit(5);
        d.walks = (r.data ?? []).map((w: any) => ({
          day: String(w.started_at).slice(0, 10),
          km: Number(w.distance_m ?? 0) / 1000,
        }));
      }
      if (grant.domains.includes('nutrition')) {
        const r = await supabase
          .from('basalt_daily_logs')
          .select('date, calories_eaten')
          .eq('user_id', owner)
          .order('date', { ascending: false })
          .limit(7);
        d.kcal7d = (r.data ?? []).map((x: any) => ({ day: x.date, kcal: Number(x.calories_eaten ?? 0) }));
      }
      if (grant.domains.includes('body')) {
        const r = await supabase
          .from('basalt_weight_entries')
          .select('measured_at, weight_kg')
          .eq('user_id', owner)
          .order('measured_at', { ascending: false })
          .limit(1);
        const row: any = r.data?.[0];
        d.lastWeight = row ? { day: String(row.measured_at).slice(0, 10), kg: Number(row.weight_kg) } : null;
      }
      if (grant.domains.includes('sleep')) {
        const r = await supabase
          .from('basalt_sleep_sessions')
          .select('bedtime, waketime')
          .eq('user_id', owner)
          .order('date', { ascending: false })
          .limit(1);
        const row: any = r.data?.[0];
        d.lastSleepMin = row?.bedtime && row?.waketime
          ? Math.max(0, Math.round((Date.parse(row.waketime) - Date.parse(row.bedtime)) / 60000))
          : null;
      }
      if (grant.domains.includes('vitals')) {
        const r = await supabase
          .from('basalt_checkins')
          .select('date, mood')
          .eq('user_id', owner)
          .order('date', { ascending: false })
          .limit(1);
        const row: any = r.data?.[0];
        d.checkin = row ? { day: row.date, mood: row.mood === null ? null : Number(row.mood) } : null;
      }
      setData(d);
    })();
  }, [grant]);

  const mmh = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;

  return (
    <Modal visible={grant !== null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.dim} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: theme.surfaces.surface }, { paddingBottom: 16 + insets.bottom }]}>
        <View style={[styles.grab, { backgroundColor: theme.surfaces.border }]} />
        <ScrollView style={{ maxHeight: 560 }}>
          <ReceiptHeader label="Shared with you" summary={grant ? grant.domains.join(' · ') : undefined} />
          {data === null ? <EmptyState>Loading…</EmptyState> : (
            <>
              {data.sessions28d !== undefined ? (
                <ReceiptRow name="Training" meta={data.lastSession ? `last session ${data.lastSession}` : 'no sessions in 28 days'} value={String(data.sessions28d)} unit="in 28d" />
              ) : null}
              {data.walks ? (
                data.walks.length > 0 ? data.walks.map((w, i) => (
                  <ReceiptRow key={`${w.day}-${i}`} name={`Walk · ${w.day}`} meta="route not shared" value={w.km.toFixed(2)} unit="km" />
                )) : <ReceiptRow name="Walks" meta="none recorded" value="0" unit="" />
              ) : null}
              {data.kcal7d ? (
                data.kcal7d.length > 0 ? data.kcal7d.map((k) => (
                  <ReceiptRow key={k.day} name={`Energy · ${k.day}`} value={groupInt(k.kcal)} unit="kcal" />
                )) : <ReceiptRow name="Nutrition" meta="no logged days" value="—" unit="" />
              ) : null}
              {data.lastWeight !== undefined ? (
                <ReceiptRow name="Last weigh-in" meta={data.lastWeight ? data.lastWeight.day : 'none yet'} value={data.lastWeight ? data.lastWeight.kg.toFixed(1) : '—'} unit={data.lastWeight ? 'kg' : ''} />
              ) : null}
              {data.lastSleepMin !== undefined ? (
                <ReceiptRow name="Last night" meta="duration only — stages are never shared" value={data.lastSleepMin !== null ? mmh(data.lastSleepMin) : '—'} unit={data.lastSleepMin !== null ? 'h' : ''} />
              ) : null}
              {data.checkin !== undefined ? (
                <ReceiptRow name="Last check-in" meta={data.checkin ? data.checkin.day : 'none yet'} value={data.checkin?.mood !== null && data.checkin ? String(data.checkin.mood) : '—'} unit={data.checkin?.mood !== null && data.checkin ? '/ 5' : ''} last />
              ) : null}
            </>
          )}
          <SrcNote>{`Read-only · shared ${grant ? grant.createdAt.slice(0, 10) : ''} · the owner can revoke at any time — your access ends at the next refresh · as of ${isoDay(new Date())}`}</SrcNote>
          <CTA label="Close" onPress={onClose} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  link: { fontFamily: mono, fontSize: 11, letterSpacing: 0.9, paddingVertical: 10, textAlign: 'center' },
  codeBox: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, paddingVertical: 14, marginTop: 8, alignItems: 'center' },
  codeText: { fontFamily: mono, fontSize: 22, letterSpacing: 6 },
  redeemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  dim: { flex: 1, backgroundColor: 'rgba(5,6,8,.6)' },
  sheet: { borderTopLeftRadius: 14, borderTopRightRadius: 14, paddingHorizontal: 16, paddingTop: 8 },
  grab: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: 8 },
});
