import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Breathe, Card, SpringPop, SrcNote, mono, useTheme, BlinkingPebble, PebbleSlot, type PebbleAction, type PebbleProposal, ScaledText as Text } from '@basalt/ui';
import {
  COACH_SUBLABEL, coachLocalGuard, parseCoachReply, type CoachNumbers, type CoachReply,
} from '@basalt/extras';
import { checkCrisis } from '@basalt/core-data';
import { supabase } from '../lib/supabase';
import { ExtraSlot, useExtra } from './ExtrasProvider';
import { CrisisSheet } from './CrisisSheet';

// V4.1 §5 — Pebble lives ON Today when the Pebble Extra is on: the mascot,
// the current proposal bubble if there is one (unchanged behaviour), and an
// Ask field — the Phase-6 Pebble Coach moved to where people are. Same
// engine, same law: answers are built only from the user's own numbers and
// list which numbers were used; propose-never-edit; the medical / dosing /
// disordered-eating hard limits and the crisis detector apply to this field
// exactly as they do to the journal. Coach off → one line pointing at
// Extras, nothing else (Coach still requires Pebble in the registry).

export const SUGGESTED_QUESTIONS = [
  "How's my week going?",
  'What should I eat for dinner to hit protein?',
  'Am I ready to train today?',
  'Why is my target 2,300?',
];

export function PebbleTodayCard({ proposal, onAction, mascot, numbers, onCoachAction }: {
  proposal: PebbleProposal | null;
  onAction: (proposal: PebbleProposal, action: PebbleAction) => void;
  mascot?: React.ReactNode;
  numbers: CoachNumbers;
  onCoachAction: (kind: 'open-recover' | 'open-plan' | 'open-train') => void;
}) {
  const { theme } = useTheme();
  const coachOn = useExtra('coach');
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<CoachReply | null>(null);
  const [crisisOpen, setCrisisOpen] = useState(false);

  const ask = async (text?: string) => {
    const q = (text ?? question).trim();
    if (!q || busy) return;
    // The crisis path runs FIRST — before the coach's own guards, before
    // any network call. On a hit, coaching stops here.
    if (checkCrisis(q)) {
      setCrisisOpen(true);
      setQuestion('');
      return;
    }
    const guard = coachLocalGuard(q);
    if (guard) {
      setReply({ answer: guard.reply, citedNumbers: [], action: null });
      setQuestion('');
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('pebble-coach', {
        body: { question: q, numbers },
      });
      const parsed = error ? null : parseCoachReply(data);
      setReply(
        parsed ?? {
          answer: `The coach could not answer: ${data?.error ?? error?.message ?? 'no reply'}.`,
          citedNumbers: [],
          action: null,
        },
      );
      setQuestion('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <ExtraSlot id="pebble">
        <Card>
          {proposal ? (
            <SpringPop popKey={proposal.id}>
              <PebbleSlot proposal={proposal} onAction={onAction} mascot={mascot} />
            </SpringPop>
          ) : (
            <View style={styles.idleRow}>
              <Breathe>{mascot ?? <BlinkingPebble size={44} />}</Breathe>
              <Text style={[styles.idleText, { color: theme.text.faint }]}>
                {coachOn ? 'Nothing to propose right now — ask me something instead.' : 'Nothing to propose right now.'}
              </Text>
            </View>
          )}
          {coachOn ? (
            <>
              {reply ? (
                <View style={styles.replyBox}>
                  <Text style={[styles.answer, { color: theme.text.ink2 }]}>{reply.answer}</Text>
                  {reply.citedNumbers.length > 0 ? (
                    <Text style={[styles.cited, { color: theme.text.faint }]}>
                      {`NUMBERS USED · ${reply.citedNumbers.join(' · ')}`}
                    </Text>
                  ) : null}
                  {reply.action ? (
                    <View style={styles.actionRow}>
                      <Pressable onPress={() => onCoachAction(reply.action!.kind)} hitSlop={10} accessibilityRole="button">
                        <Text style={[styles.actionBtn, { color: theme.text.carbs }]}>{reply.action.label.toUpperCase()}</Text>
                      </Pressable>
                      <Pressable onPress={() => setReply({ ...reply, action: null })} hitSlop={10} accessibilityRole="button">
                        <Text style={[styles.actionBtn, { color: theme.text.faint }]}>IGNORE</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              ) : null}
              {!reply && !question ? (
                <View style={styles.chipWrap}>
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <Pressable
                      key={q}
                      onPress={() => void ask(q)}
                      disabled={busy}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={`Ask: ${q}`}
                      style={[styles.qChip, { borderColor: theme.surfaces.borderStrong, borderRadius: theme.shape.radius.sm }]}
                    >
                      <Text style={[styles.qChipText, { color: theme.text.mute }]}>{q}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              <View style={styles.askRow}>
                <TextInput
                  value={question}
                  onChangeText={setQuestion}
                  placeholder="Ask about your numbers"
                  placeholderTextColor={theme.text.faint}
                  style={[styles.input, { color: theme.text.ink, borderColor: theme.surfaces.border }]}
                  onSubmitEditing={() => void ask()}
                  returnKeyType="send"
                  accessibilityLabel="Ask the coach"
                />
                <Pressable onPress={() => void ask()} disabled={busy} hitSlop={10} accessibilityRole="button" accessibilityLabel="Send">
                  <Text style={[styles.send, { color: busy ? theme.text.faint : theme.text.carbs }]}>{busy ? '…' : 'ASK'}</Text>
                </Pressable>
              </View>
              <SrcNote>{COACH_SUBLABEL}</SrcNote>
            </>
          ) : (
            <SrcNote>Turn on Pebble Coach in Extras to ask questions</SrcNote>
          )}
        </Card>
      </ExtraSlot>
      {/* The crisis screen lives OUTSIDE the gate — no Extra may wrap it. */}
      <CrisisSheet open={crisisOpen} onClose={() => setCrisisOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  idleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  idleText: { flex: 1, fontSize: 12, lineHeight: 17 },
  replyBox: { marginTop: 8, marginBottom: 4, gap: 8 },
  answer: { fontSize: 13.5, lineHeight: 20 },
  cited: { fontFamily: mono, fontSize: 10.5, letterSpacing: 0.5 },
  actionRow: { flexDirection: 'row', gap: 22 },
  actionBtn: { fontFamily: mono, fontSize: 12, letterSpacing: 1, paddingVertical: 10 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  qChip: { borderWidth: StyleSheet.hairlineWidth, paddingVertical: 7, paddingHorizontal: 11, minHeight: 34, justifyContent: 'center' },
  qChipText: { fontSize: 11.5 },
  askRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6, marginBottom: 8 },
  input: { flex: 1, borderBottomWidth: 1, paddingVertical: 8, fontSize: 13.5 },
  send: { fontFamily: mono, fontSize: 12.5, letterSpacing: 1, paddingVertical: 12 },
});
