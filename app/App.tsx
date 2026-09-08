import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BlurTargetView } from 'expo-blur';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { ThemeProvider, useTheme, BlurTargetProvider, THEMES, DEFAULT_THEME, color, mono, GroundGlow, ScaledText as Text, relativeLuminance } from '@basalt/ui';
import { useAppStore } from './src/state/appStore';
import { expressiveFontsReady, loadExpressiveFonts } from './src/lib/expressiveFonts';
import Constants from 'expo-constants';
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
import { ExtrasProvider } from './src/components/ExtrasProvider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ExtrasIntroModal } from './src/components/ExtrasIntro';
import { FinishProfileModal, FINISH_PROFILE_SEEN_KEY } from './src/components/FinishProfileModal';
import { extrasIntroSeen } from './src/lib/extras';
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
    today: <TodayScreen onOpenTab={setTab} />,
    log: <LogScreen />,
    train: <TrainScreen />,
    recover: <RecoverScreen />,
    trends: <TrendsScreen />,
    settings: <SettingsScreen />,
  };

  const today = new Date();
  const context = view === 'settings'
    ? `v${Constants.expoConfig?.version ?? '?'}`
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

/** Existing users get the Extras offers exactly once after updating. */
function NewInBasalt() {
  const profile = useAppStore((s) => s.profile);
  const [open, setOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  useEffect(() => {
    if (!profile) return;
    void extrasIntroSeen().then((seen) => { if (!seen) setOpen(true); });
    // Phase 8a: the PT-intake questions existing users never saw — once.
    if (profile.ptIntake === null) {
      void AsyncStorage.getItem(FINISH_PROFILE_SEEN_KEY).then((seen) => {
        if (seen !== 'yes') setFinishOpen(true);
      });
    }
  }, [profile]);
  if (!profile) return null;
  return (
    <>
      <ExtrasIntroModal open={open} onClose={() => setOpen(false)} />
      <FinishProfileModal open={finishOpen && !open} onClose={() => setFinishOpen(false)} />
    </>
  );
}

export default function App() {
  // The five non-Minimal themes' typography (docs/THEME-SYSTEM-REPORT.md)
  // needs these bundled — resolveTypeface can't return a family expo-font
  // hasn't registered yet, so first paint waits on this the same way it
  // already waits on session/profile below.
  // Per-file requires, deliberately: importing an @expo-google-fonts INDEX
  // makes Metro bundle the package's entire family — every weight and
  // italic (~15 MB of dead assets in the 0.1.0 AAB audit). Only the faces
  // the six original themes declare ship; expressive themes load theirs
  // lazily in lib/expressiveFonts.ts, per-file for the same reason.
  const [fontsLoaded] = useFonts({
    Nunito_400Regular: require('@expo-google-fonts/nunito/400Regular/Nunito_400Regular.ttf'),
    Nunito_700Bold: require('@expo-google-fonts/nunito/700Bold/Nunito_700Bold.ttf'),
    Nunito_800ExtraBold: require('@expo-google-fonts/nunito/800ExtraBold/Nunito_800ExtraBold.ttf'),
    Barlow_400Regular: require('@expo-google-fonts/barlow/400Regular/Barlow_400Regular.ttf'),
    Barlow_600SemiBold: require('@expo-google-fonts/barlow/600SemiBold/Barlow_600SemiBold.ttf'),
    Barlow_700Bold: require('@expo-google-fonts/barlow/700Bold/Barlow_700Bold.ttf'),
    BarlowCondensed_400Regular: require('@expo-google-fonts/barlow-condensed/400Regular/BarlowCondensed_400Regular.ttf'),
    BarlowCondensed_600SemiBold: require('@expo-google-fonts/barlow-condensed/600SemiBold/BarlowCondensed_600SemiBold.ttf'),
    BarlowCondensed_700Bold: require('@expo-google-fonts/barlow-condensed/700Bold/BarlowCondensed_700Bold.ttf'),
    Archivo_400Regular: require('@expo-google-fonts/archivo/400Regular/Archivo_400Regular.ttf'),
    Archivo_600SemiBold: require('@expo-google-fonts/archivo/600SemiBold/Archivo_600SemiBold.ttf'),
    Archivo_900Black: require('@expo-google-fonts/archivo/900Black/Archivo_900Black.ttf'),
    ArchivoBlack_400Regular: require('@expo-google-fonts/archivo-black/400Regular/ArchivoBlack_400Regular.ttf'),
    Manrope_400Regular: require('@expo-google-fonts/manrope/400Regular/Manrope_400Regular.ttf'),
    Manrope_600SemiBold: require('@expo-google-fonts/manrope/600SemiBold/Manrope_600SemiBold.ttf'),
    Manrope_800ExtraBold: require('@expo-google-fonts/manrope/800ExtraBold/Manrope_800ExtraBold.ttf'),
    Jost_300Light: require('@expo-google-fonts/jost/300Light/Jost_300Light.ttf'),
    Jost_400Regular: require('@expo-google-fonts/jost/400Regular/Jost_400Regular.ttf'),
    Jost_500Medium: require('@expo-google-fonts/jost/500Medium/Jost_500Medium.ttf'),
    IBMPlexMono_300Light: require('@expo-google-fonts/ibm-plex-mono/300Light/IBMPlexMono_300Light.ttf'),
    IBMPlexMono_400Regular: require('@expo-google-fonts/ibm-plex-mono/400Regular/IBMPlexMono_400Regular.ttf'),
    IBMPlexMono_500Medium: require('@expo-google-fonts/ibm-plex-mono/500Medium/IBMPlexMono_500Medium.ttf'),
    CormorantGaramond_300Light: require('@expo-google-fonts/cormorant-garamond/300Light/CormorantGaramond_300Light.ttf'),
    CormorantGaramond_400Regular: require('@expo-google-fonts/cormorant-garamond/400Regular/CormorantGaramond_400Regular.ttf'),
    CormorantGaramond_500Medium: require('@expo-google-fonts/cormorant-garamond/500Medium/CormorantGaramond_500Medium.ttf'),
  });

  // Settings → Display. Falls back to the ThemeProvider's own defaults
  // (Minimal/comfortable/system) before the profile has loaded — never
  // blocks first paint on a network round trip.
  const profile = useAppStore((s) => s.profile);
  const themeId = profile?.theme && THEMES[profile.theme] ? profile.theme : DEFAULT_THEME;
  const theme = THEMES[themeId];

  // V3.4 expressive themes load their typefaces on demand — a Minimal
  // startup never waits on them (see lib/expressiveFonts.ts).
  const [expressiveReady, setExpressiveReady] = useState(() => expressiveFontsReady(themeId));
  useEffect(() => {
    if (expressiveFontsReady(themeId)) {
      setExpressiveReady(true);
      return;
    }
    setExpressiveReady(false);
    let alive = true;
    void loadExpressiveFonts(themeId).then(() => { if (alive) setExpressiveReady(true); });
    return () => { alive = false; };
  }, [themeId]);

  if (!fontsLoaded || !expressiveReady) {
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
        <ExtrasProvider>
          <Gate />
          <NewInBasalt />
        </ExtrasProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  loading: { flex: 1, backgroundColor: color.bg, alignItems: 'center', justifyContent: 'center' },
  brand: { fontFamily: mono, fontSize: 12, letterSpacing: 3, color: color.faint },
});
