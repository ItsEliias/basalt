import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, color, mono } from '@basalt/ui';
import { useAppStore } from './src/state/appStore';
import { AppHeader } from './src/components/AppHeader';
import { TabBar, type TabKey } from './src/components/TabBar';
import { FadeIn } from './src/components/FadeIn';
import { QuickLogSheet, type QuickAction } from './src/components/QuickLogSheet';
import * as Haptics from 'expo-haptics';
import { addWater } from '@basalt/nutrition';
import { supabase } from './src/lib/supabase';
import { AuthScreen } from './src/screens/AuthScreen';
import { OnboardingScreen } from './src/screens/onboarding/OnboardingScreen';
import { TodayScreen } from './src/screens/today/TodayScreen';
import { LogScreen } from './src/screens/log/LogScreen';
import { TrainScreen } from './src/screens/train/TrainScreen';
import {
  RecoverShell, TrendsShell, SettingsShell,
} from './src/screens/shells';

// Shell mirrors the prototype exactly: statusbar-safe head, view area,
// tab bar with the centre +. Settings rides over the tabs via the gear;
// tapping any tab leaves it. Tab switch remounts the view (scroll resets),
// with the sanctioned 180 ms fade + 4 px rise.

type ViewKey = TabKey | 'settings';

const TITLES: Record<ViewKey, string> = {
  today: 'Today',
  log: 'Log',
  train: 'Train',
  recover: 'Recover',
  trends: 'Trends',
  settings: 'Settings',
};

function MainShell() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<TabKey>('today');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const quickLogOpen = useAppStore((s) => s.quickLogOpen);
  const setQuickLogOpen = useAppStore((s) => s.setQuickLogOpen);
  const bumpToday = useAppStore((s) => s.bumpToday);

  const view: ViewKey = settingsOpen ? 'settings' : tab;

  const onQuickAction = (a: QuickAction) => {
    if (a === 'water') {
      // +250 commits instantly — no confirmation screen, ever.
      void addWater(supabase, 250).then(() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        bumpToday();
      });
      return;
    }
    if (a === 'scan' || a === 'meal' || a === 'relog' || a === 'manual') setTab('log');
    if (a === 'session') setTab('train');
    if (a === 'breathwork') setTab('recover');
    if (a === 'weight') setTab('today');
    setSettingsOpen(false);
  };

  const body: Record<ViewKey, React.ReactNode> = {
    today: <TodayScreen />,
    log: <LogScreen />,
    train: <TrainScreen />,
    recover: <RecoverShell />,
    trends: <TrendsShell />,
    settings: <SettingsShell />,
  };

  const today = new Date();
  const context = view === 'settings'
    ? 'v0.1'
    : today.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <AppHeader
        title={TITLES[view]}
        context={context}
        onPressGear={() => setSettingsOpen(!settingsOpen)}
      />
      <View style={{ flex: 1 }}>
        <FadeIn viewKey={view}>{body[view]}</FadeIn>
      </View>
      <TabBar
        active={tab}
        onChange={(t) => {
          setSettingsOpen(false);
          setTab(t);
        }}
        onPlus={() => setQuickLogOpen(true)}
      />
      <QuickLogSheet
        open={quickLogOpen}
        onClose={() => setQuickLogOpen(false)}
        onAction={onQuickAction}
      />
    </View>
  );
}

function Gate() {
  const { session, sessionLoaded, profile, bootstrapped, init } = useAppStore();

  useEffect(() => {
    init();
    // init subscribes once; the store guards duplicate work internally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!sessionLoaded || (session && !bootstrapped)) {
    return (
      <View style={styles.loading}>
        <Text style={styles.brand}>BASALT</Text>
      </View>
    );
  }
  if (!session) return <AuthScreen />;
  if (!profile) return <OnboardingScreen />;
  return <MainShell />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <StatusBar style="light" />
        <Gate />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  loading: { flex: 1, backgroundColor: color.bg, alignItems: 'center', justifyContent: 'center' },
  brand: { fontFamily: mono, fontSize: 12, letterSpacing: 3, color: color.faint },
});
