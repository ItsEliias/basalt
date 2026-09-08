import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { KV, ReceiptHeader, ReceiptRow, SrcNote, useMotion, useTheme, ScaledText as Text } from '@basalt/ui';
import { freezeStreak, STREAK_RULES, FREEZES_PER_WEEK } from '../streaks/model';
import {
  badges, levelFor, totalXp, xpBreakdown, LEVEL_RULE, XP_RULES,
  type BadgeInputs,
} from '../xp/model';

// The motivation surfaces — cards a host screen renders inside ExtraSlots.
// Every number on them traces to a published rule the card itself shows.

export function StreaksCard({ logging, training, sleep, today }: {
  logging: ReadonlySet<string>;
  training: ReadonlySet<string>;
  sleep: ReadonlySet<string>;
  today?: Date;
}) {
  const rows = [
    { name: 'Logging', s: freezeStreak(logging, today) },
    { name: 'Training', s: freezeStreak(training, today) },
    { name: 'Sleep logged', s: freezeStreak(sleep, today) },
  ];
  const used = Math.max(...rows.map((r) => r.s.freezesUsedThisWeek));
  return (
    <View>
      <ReceiptHeader label="Streaks" summary={`${FREEZES_PER_WEEK - used} freeze${FREEZES_PER_WEEK - used === 1 ? '' : 's'} left this week`} />
      {rows.map((r, i) => (
        <ReceiptRow
          key={r.name}
          name={r.name}
          meta={r.s.frozenDays.length > 0
            ? `longest ${r.s.longest} · ${r.s.frozenDays.length} frozen day${r.s.frozenDays.length === 1 ? '' : 's'} in this run`
            : `longest ${r.s.longest}`}
          value={String(r.s.current)}
          unit="days"
          last={i === rows.length - 1}
        />
      ))}
      <SrcNote>{STREAK_RULES.join(' · ')}</SrcNote>
    </View>
  );
}

export function XpCard({ inputs }: { inputs: BadgeInputs }) {
  const { theme } = useTheme();
  const xp = totalXp(inputs);
  const lvl = levelFor(xp);
  const all = badges(inputs);
  return (
    <View>
      <ReceiptHeader label={`Level ${lvl.level}`} summary={`${xp.toLocaleString()} XP`} />
      <View style={[styles.bar, { backgroundColor: theme.surfaces.surface2 }]}>
        <View style={[styles.fill, { backgroundColor: theme.fill.accent, width: `${Math.min(100, (lvl.into / lvl.span) * 100)}%` }]} />
      </View>
      <Text style={[styles.toNext, { color: theme.text.faint }]}>
        {lvl.into.toLocaleString()} / {lvl.span.toLocaleString()} into level {lvl.level} · {LEVEL_RULE}
      </Text>
      {xpBreakdown(inputs).map((r) => (
        <KV key={r.label} label={`${r.label} × ${r.count}`} right={`${r.xp.toLocaleString()} XP`} />
      ))}
      <ReceiptHeader label="Badges" summary={`${all.filter((b) => b.earned).length} of ${all.length}`} />
      {all.map((b, i) => (
        <ReceiptRow key={b.id} name={b.title} meta={b.how} value={b.earned ? '●' : '○'} last={i === all.length - 1} />
      ))}
      <SrcNote>{XP_RULES.join(' · ')} · badges only for the milestones above, no surprises</SrcNote>
    </View>
  );
}

// ── Confetti — PRs only, by construction of the host contract ───────────

const PIECES = 22;

export function ConfettiBurst({ onDone }: { onDone?: () => void }) {
  const { theme } = useTheme();
  const progress = useRef(new Animated.Value(0)).current;
  const [pieces] = useState(() =>
    Array.from({ length: PIECES }, (_, i) => ({
      x: (i / PIECES) * 2 - 1 + (Math.random() - 0.5) * 0.4,
      spin: Math.random() * 720 - 360,
      fall: 220 + Math.random() * 160,
      size: 5 + Math.random() * 4,
      color: [theme.fill.protein, theme.fill.carbs, theme.fill.recovery, theme.fill.accent][i % 4]!,
    })),
  );
  // V4.1 §5b: the 400 ms law applies here too — the burst is quick, and
  // reduced motion skips it entirely (the words already said "done").
  const { ms, reduced } = useMotion();
  useEffect(() => {
    if (reduced) { onDone?.(); return; }
    Animated.timing(progress, {
      toValue: 1, duration: ms('slow'), easing: Easing.out(Easing.quad), useNativeDriver: true,
    }).start(() => onDone?.());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, onDone]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: '50%',
            top: 40,
            width: p.size,
            height: p.size * 1.6,
            backgroundColor: p.color,
            borderRadius: 1,
            transform: [
              { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, p.x * 160] }) },
              { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, p.fall] }) },
              { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin}deg`] }) },
            ],
            opacity: progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 6, marginBottom: 6 },
  fill: { height: 6, borderRadius: 3 },
  toNext: { fontSize: 11, lineHeight: 15, marginBottom: 8 },
});
