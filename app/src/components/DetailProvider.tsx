import { createContext, useContext, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { mono, useTheme, ScaledText as Text } from '@basalt/ui';
import { useAppStore } from '../state/appStore';
import { atLeast, type DetailLevel } from '../lib/detailModel';

// Detail level (V4 Phase 8h). THE LAW, enforced by lint-as-test: nothing
// inside <Detail> may COMPUTE a value — it only shows or hides what the
// screen already computed. Hidden content stays one tap away via the
// MORE affordance, so no level ever loses access to a number.

const DetailContext = createContext<DetailLevel>('standard');

export function useDetail(): DetailLevel {
  return useContext(DetailContext);
}

/** Reads the profile's level; standard until the profile loads. */
export function DetailProvider({ children }: { children: ReactNode }) {
  const profile = useAppStore((s) => s.profile);
  return (
    <DetailContext.Provider value={profile?.detail ?? 'standard'}>
      {children}
    </DetailContext.Provider>
  );
}

/**
 * Render children at `min` and above. Below it, a quiet MORE reveals
 * them inline — hiding is presentation, never removal.
 */
export function Detail({ min, children, moreLabel = 'MORE →' }: {
  min: DetailLevel;
  children: ReactNode;
  moreLabel?: string;
}) {
  const level = useDetail();
  const { theme } = useTheme();
  const [revealed, setRevealed] = useState(false);
  if (atLeast(level, min) || revealed) return <>{children}</>;
  return (
    <Pressable onPress={() => setRevealed(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Show more detail">
      <Text style={[styles.more, { color: theme.text.faint }]}>{moreLabel}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  more: { fontFamily: mono, fontSize: 10.5, letterSpacing: 0.85, paddingVertical: 10 },
});
