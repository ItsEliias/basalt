import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Card, ReceiptHeader, SrcNote, mono, useTheme, ScaledText as Text } from '@basalt/ui';
import { HYDRATION_HOUR_CHOICES, hydrationSummary } from '../../lib/hydrationRemindersModel';
import { getHydrationHours, setHydrationHours } from '../../lib/hydrationReminders';

// Hydration reminders config — rendered only inside the hydration
// ExtraSlot. Tapping an hour toggles a daily notification at that hour;
// the schedule is the whole feature.

export function HydrationCard() {
  const { theme } = useTheme();
  const [hours, setHours] = useState<number[]>([]);

  useEffect(() => {
    void getHydrationHours().then(setHours);
  }, []);

  const toggle = async (hour: number) => {
    const next = hours.includes(hour)
      ? hours.filter((h) => h !== hour)
      : [...hours, hour].sort((a, b) => a - b);
    const r = await setHydrationHours(next);
    if (!r.ok) {
      Alert.alert('Reminders not scheduled', r.reason ?? 'Could not schedule.');
      return;
    }
    setHours(next);
  };

  return (
    <Card>
      <ReceiptHeader label="Hydration reminders" summary={hydrationSummary(hours)} />
      <View style={styles.grid}>
        {HYDRATION_HOUR_CHOICES.map((hour) => {
          const on = hours.includes(hour);
          return (
            <Pressable
              key={hour}
              onPress={() => void toggle(hour)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Reminder at ${hour}:00 ${on ? 'on' : 'off'}`}
              style={[
                styles.chip,
                { borderColor: on ? theme.text.carbs : theme.surfaces.border },
              ]}
            >
              <Text style={[styles.chipText, { color: on ? theme.text.carbs : theme.text.mute }]}>
                {String(hour).padStart(2, '0')}:00
              </Text>
            </Pressable>
          );
        })}
      </View>
      <SrcNote>One daily notification per picked hour · nothing is logged unless you log it · turning the Extra off cancels them all</SrcNote>
    </Card>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, marginBottom: 8 },
  chip: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 9, minHeight: 40, justifyContent: 'center' },
  chipText: { fontFamily: mono, fontSize: 12.5, letterSpacing: 0.5 },
});
