import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mono, useTheme, ScaledText as Text } from '@basalt/ui';

// The honest promise (V4 Phase 8g) — one screen, plain words, reachable
// from onboarding and About. Copy lives in lib/promiseCopy.ts; the store
// listing and tester release notes are pinned to it by test.

import { PROMISE_DOES, PROMISE_DOESNT, PROMISE_TITLE } from '../lib/promiseCopy';

export function PromiseScreen({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: theme.surfaces.bg, paddingTop: insets.top + 22, paddingBottom: insets.bottom + 22 }]}>
        <View style={styles.head}>
          <Text style={[styles.brand, { color: theme.text.ink }]}>BASALT</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button">
            <Text style={[styles.close, { color: theme.text.faint }]}>CLOSE</Text>
          </Pressable>
        </View>
        <ScrollView style={styles.scroll}>
          <Text style={[styles.title, { color: theme.text.ink }]}>{PROMISE_TITLE}</Text>
          <Text style={[styles.section, { color: theme.text.mute }]}>WHAT IT DOES</Text>
          {PROMISE_DOES.map((line) => (
            <Text key={line.slice(0, 20)} style={[styles.line, { color: theme.text.ink2 }]}>{`· ${line}`}</Text>
          ))}
          <Text style={[styles.section, { color: theme.text.mute }]}>WHAT IT DOESN’T</Text>
          {PROMISE_DOESNT.map((line) => (
            <Text key={line.slice(0, 20)} style={[styles.line, { color: theme.text.ink2 }]}>{`· ${line}`}</Text>
          ))}
          <Text style={[styles.foot, { color: theme.text.faint }]}>
            Every formula in this app is printed next to its number. If you ever find one that isn’t, that’s a bug — tell us.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 22 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { fontFamily: mono, fontSize: 11, letterSpacing: 2.42 },
  close: { fontFamily: mono, fontSize: 11, letterSpacing: 1 },
  scroll: { flex: 1, marginTop: 18 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 16 },
  section: { fontFamily: mono, fontSize: 11, letterSpacing: 1.2, marginTop: 14, marginBottom: 8 },
  line: { fontSize: 14, lineHeight: 21, marginBottom: 8 },
  foot: { fontSize: 12, lineHeight: 17, marginTop: 16, marginBottom: 24 },
});
