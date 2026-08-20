import { ScrollView, StyleSheet } from 'react-native';
import { Card, EmptyState, MicroLabel, color } from '@basalt/ui';

// Temporary honest shells — each names what it is and what it needs, never a
// fake chart. Replaced screen-by-screen through M1.

function Shell({ label, message }: { label: string; message: string }) {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Card>
        <MicroLabel>{label}</MicroLabel>
        <EmptyState>{message}</EmptyState>
      </Card>
    </ScrollView>
  );
}

export function TodayShell() {
  return <Shell label="Today" message="Nothing logged yet today. Log food, water or a session and it shows up here." />;
}
export function LogShell() {
  return <Shell label="Log" message="Barcode capture, manual add and favorites are on their way in this milestone." />;
}
export function TrainShell() {
  return <Shell label="Train" message="The set logger arrives in this milestone. Sessions you log will appear here." />;
}
export function RecoverShell() {
  return <Shell label="Recover" message="No recovery data recorded yet. Connect a source or log a breathing session." />;
}
export function TrendsShell() {
  return <Shell label="Trends" message="Trends draw from your logged history. Nothing to show until there is history." />;
}
export function SettingsShell() {
  return <Shell label="Settings" message="Profile editing, export and account deletion land in this milestone." />;
}
export function OnboardingShell() {
  return <Shell label="Onboarding" message="The 8-step intake is being built in this milestone." />;
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: color.bg },
  content: { paddingHorizontal: 16, paddingBottom: 24 },
});
