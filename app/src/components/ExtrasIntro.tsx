import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CTA, ObOption, ObQuestion, ObSub, Pebble, PebbleSlot, mono, useTheme, ScaledText as Text,
} from '@basalt/ui';
import type { ExtraId, OnboardingExtraScreen } from '@basalt/core-data';
import { extraDef, onboardingExtraScreens } from '@basalt/core-data';
import { setExtraFlag, markExtrasIntroSeen } from '../lib/extras';

// The Extras offer — one screen per registry entry (or group), a live
// preview, the registry's question, Yes / Not now. Used in two places:
// onboarding steps after the theme picker, and the one-time "New in
// Basalt" flow existing users see after updating. Copy comes from the
// registry, never from here.

/** Live previews, keyed by the registry's preview string. */
function ExtraPreview({ kind }: { kind: string }) {
  const { theme } = useTheme();
  if (kind === 'pebble') {
    return (
      <View style={styles.previewBox}>
        <PebbleSlot
          proposal={{
            id: 'preview',
            kind: 'sleep-debt',
            text: 'Last night ran 1 h 30 m under your sleep target. Want tonight’s wind-down numbers?',
            actions: [
              { label: 'Open Recover', kind: 'open-recover' },
              { label: 'Not now', kind: 'dismiss' },
            ],
          }}
          onAction={() => {}}
        />
        <Text style={[styles.previewNote, { color: theme.text.faint }]} allowFontScaling={false}>
          SAMPLE PROPOSAL · PEBBLE ONLY SPEAKS WHEN THERE’S SOMETHING TO DO
        </Text>
      </View>
    );
  }
  return <Pebble size={56} />;
}

/**
 * One offer screen. Single Extra: Yes/Not now. A grouped screen renders a
 * checklist seeded from the registry defaults (capture ships ticked); the
 * primary CTA commits the ticks, Not now turns the lot off. Either way
 * every flag is written explicitly.
 */
export function ExtrasStep({ screen, onAnswered }: {
  screen: OnboardingExtraScreen;
  onAnswered: () => void;
}) {
  const { theme } = useTheme();
  const [busy, setBusy] = useState(false);
  const [ticks, setTicks] = useState<Record<string, boolean>>(
    () => Object.fromEntries(screen.ids.map((id) => [id, extraDef(id).default])),
  );
  const grouped = screen.ids.length > 1;
  const answer = async (yes: boolean) => {
    if (busy) return;
    setBusy(true);
    for (const id of screen.ids) {
      await setExtraFlag(id as ExtraId, yes ? (grouped ? !!ticks[id] : true) : false);
    }
    setBusy(false);
    onAnswered();
  };
  return (
    <>
      <ObQuestion>{screen.question}</ObQuestion>
      <ObSub>Off unless you say yes — and switchable any time in Settings › Extras.</ObSub>
      <View style={styles.body}>
        {grouped ? (
          <View>
            {screen.ids.map((id) => {
              const def = extraDef(id as ExtraId);
              return (
                <ObOption
                  key={id}
                  title={def.title}
                  subtitle={def.oneLiner}
                  on={!!ticks[id]}
                  multi
                  onPress={() => setTicks((t) => ({ ...t, [id]: !t[id] }))}
                />
              );
            })}
          </View>
        ) : (
          <ExtraPreview kind={screen.preview} />
        )}
        <CTA label={screen.yesLabel} disabled={busy} onPress={() => void answer(true)} />
        <Pressable onPress={() => void answer(false)} disabled={busy} hitSlop={10} accessibilityRole="button">
          <Text style={[styles.notNow, { color: theme.text.faint }]}>{screen.noLabel}</Text>
        </Pressable>
      </View>
    </>
  );
}

/**
 * "New in Basalt" — existing users get the same offers once after the
 * update that introduced the framework. Dismissable as a whole; skipping
 * leaves everything off.
 */
export function ExtrasIntroModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const screens = onboardingExtraScreens();
  const [index, setIndex] = useState(0);
  const done = async () => {
    await markExtrasIntroSeen();
    onClose();
  };
  const advance = () => {
    if (index + 1 >= screens.length) void done();
    else setIndex(index + 1);
  };
  const screen = screens[index];
  if (!screen) return null;
  return (
    <Modal visible={open} animationType="slide" onRequestClose={() => void done()}>
      <View style={[styles.modal, { backgroundColor: theme.surfaces.bg, paddingTop: insets.top + 22, paddingBottom: insets.bottom + 22 }]}>
        <View style={styles.modalHead}>
          <Text style={[styles.brand, { color: theme.text.ink }]}>NEW IN BASALT</Text>
          <Pressable onPress={() => void done()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Skip the extras">
            <Text style={[styles.skip, { color: theme.text.faint }]}>SKIP — ALL OFF</Text>
          </Pressable>
        </View>
        <ExtrasStep screen={screen} onAnswered={advance} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, marginTop: 18, gap: 16 },
  previewBox: { gap: 8, marginBottom: 6 },
  previewNote: { fontFamily: mono, fontSize: 10.5, letterSpacing: 0.5 },
  notNow: { fontFamily: mono, fontSize: 12.5, letterSpacing: 1, textAlign: 'center', paddingVertical: 12 },
  modal: { flex: 1, paddingHorizontal: 22 },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  brand: { fontFamily: mono, fontSize: 11, letterSpacing: 2.42 },
  skip: { fontFamily: mono, fontSize: 11, letterSpacing: 1 },
});
