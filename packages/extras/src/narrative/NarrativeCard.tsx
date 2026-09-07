import { StyleSheet, View } from 'react-native';
import { SrcNote, mono, useTheme, ScaledText as Text } from '@basalt/ui';
import { NARRATIVE_LABEL, NARRATIVE_SUBLABEL } from './model';

// The label is part of the component, not a prop — a generated paragraph
// can never render unlabelled.

export function NarrativeCard({ summary }: { summary: string }) {
  const { theme } = useTheme();
  return (
    <View>
      <Text style={[styles.label, { color: theme.text.mute }]}>{NARRATIVE_LABEL.toUpperCase()}</Text>
      <Text style={[styles.body, { color: theme.text.ink2 }]}>{summary}</Text>
      <SrcNote>{NARRATIVE_SUBLABEL}</SrcNote>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: mono, fontSize: 11, letterSpacing: 1.32, marginBottom: 6 },
  body: { fontSize: 14, lineHeight: 21 },
});
