import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Card, ReceiptHeader, SrcNote, mono, useTheme, ScaledText as Text } from '@basalt/ui';
import {
  COACH_SUBLABEL, coachLocalGuard, parseCoachReply, type CoachNumbers, type CoachReply,
} from '@basalt/extras';
import { supabase } from '../lib/supabase';
import { ExtraSlot } from './ExtrasProvider';

// Pebble Coach (coach Extra, requires Pebble) — asks only when the user
// taps send; the device-side guard runs BEFORE any network call; every
// answer lists the numbers it used; the one optional action is
// Accept/Ignore and never edits data.

export function CoachCard({ numbers, onAction }: {
  numbers: CoachNumbers;
  onAction: (kind: 'open-recover' | 'open-plan' | 'open-train') => void;
}) {
  const { theme } = useTheme();
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<CoachReply | null>(null);

  const ask = async () => {
    const q = question.trim();
    if (!q || busy) return;
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
    <ExtraSlot id="coach">
    <Card>
      <ReceiptHeader label="Pebble Coach" summary="only speaks when asked" />
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
              <Pressable onPress={() => onAction(reply.action!.kind)} hitSlop={10} accessibilityRole="button">
                <Text style={[styles.actionBtn, { color: theme.text.carbs }]}>{reply.action.label.toUpperCase()}</Text>
              </Pressable>
              <Pressable onPress={() => setReply({ ...reply, action: null })} hitSlop={10} accessibilityRole="button">
                <Text style={[styles.actionBtn, { color: theme.text.faint }]}>IGNORE</Text>
              </Pressable>
            </View>
          ) : null}
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
    </Card>
    </ExtraSlot>
  );
}

const styles = StyleSheet.create({
  replyBox: { marginTop: 8, marginBottom: 4, gap: 8 },
  answer: { fontSize: 13.5, lineHeight: 20 },
  cited: { fontFamily: mono, fontSize: 10.5, letterSpacing: 0.5 },
  actionRow: { flexDirection: 'row', gap: 22 },
  actionBtn: { fontFamily: mono, fontSize: 12, letterSpacing: 1, paddingVertical: 10 },
  askRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6, marginBottom: 8 },
  input: { flex: 1, borderBottomWidth: 1, paddingVertical: 8, fontSize: 13.5 },
  send: { fontFamily: mono, fontSize: 12.5, letterSpacing: 1, paddingVertical: 12 },
});
