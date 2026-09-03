import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mono, ScaledText as Text } from '@basalt/ui';
import { useTheme } from '@basalt/ui';

// The quick-log (+) sheet — 3-wide mono-labeled grid. Every logging action
// is ≤2 taps from here; Water +250 commits instantly with no screen.
// M1 carries 8 items: Walk recording is V1.x, and a dead button would be a
// lie, so it simply isn't here yet.

export type QuickAction =
  | 'scan' | 'meal' | 'relog' | 'water' | 'weight' | 'breathwork' | 'session' | 'manual';

const ITEMS: { key: QuickAction; glyph: string; label: string }[] = [
  { key: 'scan', glyph: '◫', label: 'Scan' },
  { key: 'meal', glyph: '✳', label: 'Meal' },
  { key: 'relog', glyph: '↺', label: 'Re-log' },
  { key: 'water', glyph: '▤', label: 'Water +250' },
  { key: 'weight', glyph: '▲', label: 'Weight' },
  { key: 'breathwork', glyph: '◔', label: 'Breathwork' },
  { key: 'session', glyph: '▶', label: 'Session' },
  { key: 'manual', glyph: '✎', label: 'Manual' },
];

export function QuickLogSheet({
  open, onClose, onAction,
}: {
  open: boolean;
  onClose: () => void;
  onAction: (a: QuickAction) => void;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.dim} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: theme.surfaces.surface, borderTopColor: theme.surfaces.borderStrong }, { paddingBottom: 22 + insets.bottom }]}>
        <View style={[styles.grab, { backgroundColor: theme.surfaces.borderStrong }]} />
        <View style={styles.grid}>
          {ITEMS.map((it) => (
            <Pressable
              key={it.key}
              style={[styles.item, { borderColor: theme.surfaces.border }]}
              onPress={() => {
                onAction(it.key);
                onClose();
              }}
            >
              <Text style={[styles.glyph, { color: theme.text.ink2 }]}>{it.glyph}</Text>
              <Text style={[styles.label, { color: theme.text.mute }]}>{it.label.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={[styles.hint, { color: theme.text.faint }]}>LOG ANYTHING FROM ANYWHERE · WATER +250 COMMITS INSTANTLY, NO SCREEN</Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: { flex: 1, backgroundColor: 'rgba(5,6,8,.6)' },
  sheet: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  grab: { width: 34, height: 3, borderRadius: 2, alignSelf: 'center', marginTop: 4, marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  item: {
    flexBasis: '31%',
    flexGrow: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  glyph: { fontSize: 16, fontFamily: mono },
  label: { fontFamily: mono, fontSize: 11, letterSpacing: 0.9, marginTop: 8 },
  hint: { fontFamily: mono, fontSize: 10.5, textAlign: 'center', marginTop: 14, letterSpacing: 0.57 },
});
