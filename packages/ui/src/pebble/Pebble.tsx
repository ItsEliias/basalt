import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '../theme';
import { ScaledText as Text } from '../components/scaledText';

// Pebble — Basalt's mascot, an SVG basalt pebble (path from
// docs/basalt-picker.html). Two expressions only: neutral and blink.
//
// THE LAW, enforced in code, not copy: Pebble renders only when a proposal
// with an action exists. PebbleSlot takes a proposal — never free text —
// and returns null without one. Pebble never comments on how you did;
// every message is a proposal with an action, and all of them dismiss.

export type PebbleActionKind = 'open-log' | 'open-train' | 'open-recover' | 'dismiss';

export type PebbleAction = {
  label: string;
  kind: PebbleActionKind;
};

/** A proposal with an action. There is no free-text path into Pebble. */
export type PebbleProposal = {
  /** Stable id; a dismissal keys on it for the rest of the day. */
  id: string;
  kind: 'progression' | 'macro-shortfall' | 'readiness-swap' | 'sleep-debt' | 'stress-swap' | 'missed-session';
  text: string;
  /** Exactly two: the action, and the way out. */
  actions: readonly [PebbleAction, PebbleAction];
};

export function Pebble({ size = 40, expression = 'neutral' }: {
  size?: number;
  expression?: 'neutral' | 'blink';
}) {
  const blink = expression === 'blink';
  return (
    <Svg viewBox="0 0 80 64" width={size} height={(size * 64) / 80} aria-label="Pebble, the Basalt mascot">
      <Path d="M12 40 C8 18 30 6 46 8 C66 10 76 26 72 42 C68 58 50 62 36 60 C22 58 14 52 12 40Z" fill="#3F4756" />
      <Path d="M22 22 C30 14 44 12 56 16" stroke="#59627A" strokeWidth={3} fill="none" strokeLinecap="round" />
      {blink ? (
        <>
          <Path d="M27 32 C30 34 34 34 37 32" stroke="#FFF" strokeWidth={2.5} fill="none" strokeLinecap="round" />
          <Path d="M47 32 C50 34 54 34 57 32" stroke="#FFF" strokeWidth={2.5} fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <Circle cx={32} cy={32} r={5} fill="#FFF" />
          <Circle cx={52} cy={32} r={5} fill="#FFF" />
          <Circle cx={33.5} cy={33} r={2.4} fill="#111" />
          <Circle cx={53.5} cy={33} r={2.4} fill="#111" />
        </>
      )}
      <Path d="M36 44 C40 48 46 48 50 44" stroke="#111" strokeWidth={2.5} fill="none" strokeLinecap="round" />
      <Circle cx={24} cy={40} r={3.5} fill="#FF9AAE" opacity={0.8} />
      <Circle cx={60} cy={40} r={3.5} fill="#FF9AAE" opacity={0.8} />
    </Svg>
  );
}

/** Blinks every few seconds; otherwise neutral. The only two expressions. */
export function BlinkingPebble({ size }: { size: number }) {
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    let closeTimer: ReturnType<typeof setTimeout>;
    const timer = setInterval(() => {
      setBlink(true);
      closeTimer = setTimeout(() => setBlink(false), 160);
    }, 4200);
    return () => { clearInterval(timer); clearTimeout(closeTimer); };
  }, []);
  return <Pebble size={size} expression={blink ? 'blink' : 'neutral'} />;
}

/**
 * The one place Pebble is allowed to appear in the app. No proposal, no
 * Pebble — this returns null, it does not render an idle mascot.
 */
export function PebbleSlot({ proposal, onAction, mascot }: {
  proposal: PebbleProposal | null;
  onAction: (proposal: PebbleProposal, action: PebbleAction) => void;
  /** Optional mascot override (the growth Extra passes a staged pebble). */
  mascot?: ReactNode;
}) {
  const { theme } = useTheme();
  if (!proposal) return null;
  return (
    <View style={styles.row} accessibilityRole="alert" accessibilityLabel={`Pebble proposes: ${proposal.text}`}>
      {mascot ?? <BlinkingPebble size={44} />}
      <View
        style={[
          styles.bubble,
          { backgroundColor: theme.surfaces.surface, borderColor: theme.surfaces.border, borderRadius: theme.shape.radius.md },
        ]}
      >
        <Text style={[styles.text, { color: theme.text.ink }]}>{proposal.text}</Text>
        <View style={styles.actions}>
          {proposal.actions.map((a) => (
            <Pressable
              key={a.label}
              onPress={() => onAction(proposal, a)}
              hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={a.label}
            >
              <Text style={[styles.action, { color: a.kind === 'dismiss' ? theme.text.faint : theme.text.accent }]}>
                {a.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  bubble: { flex: 1, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  text: { fontSize: 12.5, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 18, marginTop: 8 },
  action: { fontSize: 12.5, fontWeight: '600' },
});
