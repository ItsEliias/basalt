import { Pressable, StyleSheet, Text, View } from 'react-native';
import { color, mono } from '@basalt/ui';

// The app head — title left, mono context + gear right (prototype .apphead).

export function AppHeader({
  title, context, onPressGear,
}: {
  title: string;
  context?: string;
  onPressGear?: () => void;
}) {
  return (
    <View style={styles.head}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.right}>
        {context ? <Text style={styles.context}>{context.toUpperCase()}</Text> : null}
        {onPressGear ? (
          <Pressable onPress={onPressGear} hitSlop={18}>
            <Text style={styles.gear}>⚙</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 4,
  },
  title: { fontSize: 21, fontWeight: '650' as any, letterSpacing: -0.21, color: color.ink },
  right: { flexDirection: 'row', alignItems: 'baseline', gap: 14 },
  context: { fontFamily: mono, fontSize: 11, color: color.mute, letterSpacing: 0.66 },
  gear: { color: color.faint, fontSize: 13 },
});
