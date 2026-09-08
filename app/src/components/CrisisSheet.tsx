import { Linking, Modal, Pressable, StyleSheet, View } from 'react-native';
import { mono, useTheme, ScaledText as Text } from '@basalt/ui';
import { CRISIS_BODY, CRISIS_HEADING, crisisResourcesFor } from '@basalt/core-data';

// The crisis screen — ALWAYS ON; no gate of any kind may wrap it (pinned
// by lint test). Plain words, regional numbers, one-tap call and text. No
// mascot, no confirmation dialogs, nothing leaves the device unless the
// user taps a line themselves.

export function CrisisSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { theme } = useTheme();
  // Region from the JS locale (Hermes Intl) — no native dependency.
  const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? '';
  const region = locale.split('-').find((part) => /^[A-Z]{2}$/.test(part)) ?? null;
  const res = crisisResourcesFor(region);

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: theme.surfaces.bg }]}>
        <Text style={[styles.heading, { color: theme.text.ink }]}>{CRISIS_HEADING}</Text>
        <Text style={[styles.body, { color: theme.text.ink2 }]}>{CRISIS_BODY}</Text>

        {res.lines.map((line) => (
          <View key={line.name} style={styles.lineBlock}>
            <Pressable
              onPress={() => void Linking.openURL(`tel:${line.phone.replace(/\s/g, '')}`)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`Call ${line.name}`}
              style={[styles.lineBtn, { borderColor: theme.surfaces.borderStrong }]}
            >
              <Text style={[styles.lineName, { color: theme.text.ink }]}>{`Call ${line.name}`}</Text>
              <Text style={[styles.lineNum, { color: theme.text.carbs }]}>{line.phone}</Text>
            </Pressable>
            {line.sms ? (
              <Pressable
                onPress={() => void Linking.openURL(`sms:${line.sms!.replace(/\s/g, '')}`)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={`Text ${line.name}`}
              >
                <Text style={[styles.smsLink, { color: theme.text.mute }]}>{`or text ${line.sms}`}</Text>
              </Pressable>
            ) : null}
          </View>
        ))}

        <Pressable
          onPress={() => void Linking.openURL(`tel:${res.emergency}`)}
          hitSlop={10}
          accessibilityRole="button"
        >
          <Text style={[styles.emergency, { color: theme.text.mute }]}>
            {`In immediate danger: call ${res.emergency}`}
          </Text>
        </Pressable>

        <Pressable onPress={() => void Linking.openURL(res.directory)} hitSlop={10} accessibilityRole="button">
          <Text style={[styles.directory, { color: theme.text.mute }]}>
            {res.lines.length === 0 ? 'Find a helpline where you are — findahelpline.com' : 'More lines: findahelpline.com'}
          </Text>
        </Pressable>

        <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" style={styles.closeBtn}>
          <Text style={[styles.close, { color: theme.text.faint }]}>BACK</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 28, justifyContent: 'center', gap: 14 },
  heading: { fontSize: 22, fontWeight: '600' },
  body: { fontSize: 14.5, lineHeight: 22 },
  lineBlock: { gap: 6, marginTop: 6 },
  lineBtn: { borderWidth: 1, borderRadius: 10, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lineName: { fontSize: 15 },
  lineNum: { fontFamily: mono, fontSize: 15 },
  smsLink: { fontSize: 13, paddingVertical: 8, textAlign: 'center' },
  emergency: { fontSize: 13, paddingVertical: 8 },
  directory: { fontSize: 13, paddingVertical: 8 },
  closeBtn: { marginTop: 10 },
  close: { fontFamily: mono, fontSize: 12, letterSpacing: 1.2, textAlign: 'center', paddingVertical: 12 },
});
