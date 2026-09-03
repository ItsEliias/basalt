import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BlurTargetView } from 'expo-blur';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Nunito_400Regular, Nunito_700Bold, Nunito_800ExtraBold } from '@expo-google-fonts/nunito';
import { Barlow_400Regular, Barlow_600SemiBold, Barlow_700Bold } from '@expo-google-fonts/barlow';
import {
  BarlowCondensed_400Regular,
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
} from '@expo-google-fonts/barlow-condensed';
import { Archivo_400Regular, Archivo_600SemiBold, Archivo_900Black } from '@expo-google-fonts/archivo';
import { ArchivoBlack_400Regular } from '@expo-google-fonts/archivo-black';
import { Manrope_400Regular, Manrope_600SemiBold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { Jost_300Light, Jost_400Regular, Jost_500Medium } from '@expo-google-fonts/jost';
import {
  IBMPlexMono_300Light,
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
} from '@expo-google-fonts/ibm-plex-mono';
import {
  CormorantGaramond_300Light,
  CormorantGaramond_400Regular,
  CormorantGaramond_500Medium,
} from '@expo-google-fonts/cormorant-garamond';
import { ThemeProvider, useTheme, BlurTargetProvider, THEMES, DEFAULT_THEME, color, mono, GroundGlow, ScaledText as Text, relativeLuminance } from '@basalt/ui';
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
import { SettingsScreen } from './src/screens/settings/SettingsScreen';
import { RecoverScreen } from './src/screens/recover/RecoverScreen';
import { TrendsScreen } from './src/screens/trends/TrendsScreen';
import { WeightSheet } from './src/components/WeightSheet';
import { wireWeekReviewNotifTap } from './src/lib/weekReviewNotif';
import { registerTimerService } from './src/lib/timerService';
import { wireOutboxDraining, writeThroughOutbox } from './src/lib/outbox';
import { rescheduleMonthlyReportNotif, wireMonthlyReportNotifTap } from './src/lib/monthlyReportNotif';
import { registerBackgroundWork } from './src/lib/backgroundWork';
import { isoDay } from '@basalt/core-data';

// Foreground-service runner must be registered before any notification is
// displayed — module scope, once. The outbox drains on start, foreground,
// and interval — a committed write must never be lost to a dead spot.
registerTimerService();
wireOutboxDraining();
void rescheduleMonthlyReportNotif();
void registerBackgroundWork();

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
  const { theme } = useTheme();
  const blurTargetRef = useRef<View>(null);
  const [tab, setTab] = useState<TabKey>('today');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [weightOpen, setWeightOpen] = useState(false);
  const quickLogOpen = useAppStore((s) => s.quickLogOpen);
  const setQuickLogOpen = useAppStore((s) => s.setQuickLogOpen);
  const bumpToday = useAppStore((s) => s.bumpToday);

  const view: ViewKey = settingsOpen ? 'settings' : tab;

  // A tap on the Week in Review notification lands on Trends, where the
  // digest is composed live from the ledger — cold start included.
  useEffect(() => {
    const unWeek = wireWeekReviewNotifTap(() => {
      setSettingsOpen(false);
      setTab('trends');
    });
    const unMonth = wireMonthlyReportNotifTap(() => {
      setSettingsOpen(false);
      setTab('trends');
    });
    return () => { unWeek(); unMonth(); };
  }, []);

  const onQuickAction = (a: QuickAction) => {
    if (a === 'water') {
      // +250 commits instantly — no confirmation screen, ever. Offline it
      // queues just as instantly; the outbox replays it when we're back.
      const ts = new Date().toISOString();
      void writeThroughOutbox(
        () => addWater(supabase, 250, isoDay(new Date()), ts),
        { kind: 'water', ml: 250, date: isoDay(new Date()), ts },
      ).then(() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        bumpToday();
      });
      return;
    }
    if (a === 'scan' || a === 'meal' || a === 'relog' || a === 'manual') setTab('log');
    if (a === 'session') setTab('train');
    if (a === 'breathwork') setTab('recover');
    if (a === 'weight') { setWeightOpen(true); return; }
    setSettingsOpen(false);
  };

  const body: Record<ViewKey, React.ReactNode> = {
    today: <TodayScreen />,
    log: <LogScreen />,
    train: <TrainScreen />,
    recover: <RecoverScreen />,
    trends: <TrendsScreen />,
    settings: <SettingsScreen />,
  };

  const today = new Date();
  const context = view === 'settings'
    ? 'v0.1'
    : today.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <View style={[styles.root, { backgroundColor: theme.surfaces.bg, paddingTop: insets.top + 8 }]}>
      {/* expo-blur's Android blur needs an explicit target view to sample —
          it can't read "whatever's behind this" the way iOS's blur can.
          This wraps the one thing worth blurring (the ambient glow, over
          the same flat background every other theme just sees directly)
          and hands the ref to every Card/Tile via BlurTargetProvider. */}
      <BlurTargetView ref={blurTargetRef} style={[StyleSheet.absoluteFill, { backgroundColor: theme.surfaces.bg }]}>
        <GroundGlow />
      </BlurTargetView>
      <BlurTargetProvider target={blurTargetRef}>
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
        <WeightSheet open={weightOpen} onClose={() => setWeightOpen(false)} onLogged={bumpToday} />
      </BlurTargetProvider>
    </View>
  );
}

function Gate() {
  const { session, sessionLoaded, profile, bootstrapped, init } = useAppStore();
  const { theme } = useTheme();

  useEffect(() => {
    init();
    // init subscribes once; the store guards duplicate work internally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!sessionLoaded || (session && !bootstrapped)) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.surfaces.bg }]}>
        <Text style={[styles.brand, { color: theme.text.faint }]}>BASALT</Text>
      </View>
    );
  }
  if (!session) return <AuthScreen />;
  if (!profile) return <OnboardingScreen />;
  return <MainShell />;
}

export default function App() {
  // The five non-Minimal themes' typography (docs/THEME-SYSTEM-REPORT.md)
  // needs these bundled — resolveTypeface can't return a family expo-font
  // hasn't registered yet, so first paint waits on this the same way it
  // already waits on session/profile below.
  const [fontsLoaded] = useFonts({
    Nunito_400Regular, Nunito_700Bold, Nunito_800ExtraBold,
    Barlow_400Regular, Barlow_600SemiBold, Barlow_700Bold,
    BarlowCondensed_400Regular, BarlowCondensed_600SemiBold, BarlowCondensed_700Bold,
    Archivo_400Regular, Archivo_600SemiBold, Archivo_900Black,
    ArchivoBlack_400Regular,
    Manrope_400Regular, Manrope_600SemiBold, Manrope_800ExtraBold,
    Jost_300Light, Jost_400Regular, Jost_500Medium,
    IBMPlexMono_300Light, IBMPlexMono_400Regular, IBMPlexMono_500Medium,
    CormorantGaramond_300Light, CormorantGaramond_400Regular, CormorantGaramond_500Medium,
  });

  // Settings → Display. Falls back to the ThemeProvider's own defaults
  // (Minimal/comfortable/system) before the profile has loaded — never
  // blocks first paint on a network round trip.
  const profile = useAppStore((s) => s.profile);
  const theme = profile?.theme ? THEMES[profile.theme] : THEMES[DEFAULT_THEME];

  if (!fontsLoaded) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.surfaces.bg }]}>
        <Text style={[styles.brand, { color: theme.text.faint }]}>BASALT</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider theme={theme} density={profile?.density} textScale={profile?.textScale}>
        {/* Icon color must oppose the theme ground — hardcoded "light" made
            the clock and battery invisible on the paper themes. */}
        <StatusBar style={relativeLuminance(theme.surfaces.bg) > 0.5 ? 'dark' : 'light'} />
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
