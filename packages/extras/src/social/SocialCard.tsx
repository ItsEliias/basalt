import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { CTA, KV, ReceiptHeader, ReceiptRow, SrcNote, mono, useTheme, ScaledText as Text } from '@basalt/ui';
import {
  CHALLENGE_KIND_LABELS, SOCIAL_SHARED_COLUMNS_NOTE, isValidInviteCode,
  leaderboard, type ChallengeKind, type LeaderboardEntry, type MemberRow, type ProgressRow,
} from './model';

// Friends & challenges — the host loads/writes; this renders and asks.
// Every number on the board is an aggregate its owner's device published.

export type SocialChallenge = {
  id: string;
  kind: ChallengeKind;
  startsOn: string;
  endsOn: string;
  members: MemberRow[];
  progress: ProgressRow[];
};

export function SocialCard({
  selfId, friendCount, myInviteCode, challenges, busy,
  onCreateInvite, onRedeem, onCreateChallenge,
}: {
  selfId: string;
  friendCount: number;
  myInviteCode: string | null;
  challenges: SocialChallenge[];
  busy?: boolean;
  onCreateInvite: () => void;
  onRedeem: (code: string) => void;
  onCreateChallenge: (kind: ChallengeKind) => void;
}) {
  const { theme } = useTheme();
  const [codeInput, setCodeInput] = useState('');
  return (
    <View>
      <ReceiptHeader label="Friends" summary={`${friendCount} connected`} />
      {myInviteCode ? (
        <KV label="Your invite code — one use, 7 days" right={myInviteCode} />
      ) : (
        <CTA label={busy ? '…' : 'Create an invite code'} disabled={!!busy} onPress={onCreateInvite} />
      )}
      <View style={styles.redeemRow}>
        <TextInput
          value={codeInput}
          onChangeText={(t) => setCodeInput(t.toUpperCase())}
          placeholder="Enter a friend's code"
          placeholderTextColor={theme.text.faint}
          autoCapitalize="characters"
          style={[styles.codeInput, { borderColor: theme.surfaces.borderStrong, color: theme.text.ink }]}
        />
        <Pressable
          onPress={() => { onRedeem(codeInput.trim()); setCodeInput(''); }}
          disabled={!isValidInviteCode(codeInput.trim()) || !!busy}
          hitSlop={10}
          accessibilityRole="button"
        >
          <Text style={[styles.redeemBtn, { color: isValidInviteCode(codeInput.trim()) ? theme.text.accent : theme.text.faint }]}>
            ADD
          </Text>
        </Pressable>
      </View>

      <ReceiptHeader label="Challenges" summary="friends only" />
      {challenges.length === 0 ? (
        <Text style={[styles.empty, { color: theme.text.faint }]}>
          No challenge running. Start one — friends join with a tap.
        </Text>
      ) : (
        challenges.map((c) => {
          const board: LeaderboardEntry[] = leaderboard(c.members, c.progress, selfId);
          return (
            <View key={c.id} style={styles.challenge}>
              <KV label={`${CHALLENGE_KIND_LABELS[c.kind]} · ${c.startsOn} → ${c.endsOn}`} right={`${c.members.length} in`} />
              {board.map((e, i) => (
                <ReceiptRow
                  key={e.userId}
                  name={`${i + 1} · ${e.displayName}${e.isSelf ? ' (you)' : ''}`}
                  value={String(Math.round(e.total))}
                  last={i === board.length - 1}
                />
              ))}
            </View>
          );
        })
      )}
      <View style={styles.newRow}>
        {(Object.keys(CHALLENGE_KIND_LABELS) as ChallengeKind[]).map((k) => (
          <Pressable key={k} onPress={() => onCreateChallenge(k)} disabled={!!busy} hitSlop={8}
            style={[styles.kindChip, { borderColor: theme.surfaces.borderStrong }]} accessibilityRole="button">
            <Text style={[styles.kindText, { color: theme.text.ink2 }]}>+ {CHALLENGE_KIND_LABELS[k]}</Text>
          </Pressable>
        ))}
      </View>
      <SrcNote>{SOCIAL_SHARED_COLUMNS_NOTE}</SrcNote>
    </View>
  );
}

const styles = StyleSheet.create({
  redeemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 8 },
  codeInput: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontFamily: mono, fontSize: 13, letterSpacing: 2 },
  redeemBtn: { fontFamily: mono, fontSize: 12.5, letterSpacing: 1 },
  empty: { fontSize: 12.5, lineHeight: 17, paddingVertical: 6 },
  challenge: { marginBottom: 8 },
  newRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 10 },
  kindChip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  kindText: { fontSize: 12.5 },
});
