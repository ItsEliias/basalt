// Voice lane — OS speech-to-text into the existing AI quick-add flow.
// The OS transcribes, the deployed ai-quick-add function does the food
// reasoning, and the Tray still gates every log — voice changes the
// input surface, never the honesty gates.
//
// Lazy-required so builds without the native module (Expo Go, dev
// clients from before the rebuild) degrade to the mic simply not
// appearing — never a crash, never a dead button.

type VoiceEvents = {
  onPartial: (transcript: string) => void;
  onFinal: (transcript: string) => void;
  onError: (message: string) => void;
  onEnd: () => void;
};

let mod: any | null | undefined;

function nativeModule(): any | null {
  if (mod !== undefined) return mod;
  try {
    mod = require('expo-speech-recognition').ExpoSpeechRecognitionModule;
  } catch {
    mod = null;
  }
  return mod;
}

export function voiceAvailable(): boolean {
  const m = nativeModule();
  try {
    return !!m && m.isRecognitionAvailable();
  } catch {
    return false;
  }
}

export async function startVoiceCapture(
  ev: VoiceEvents,
): Promise<{ ok: boolean; stop: () => void }> {
  const m = nativeModule();
  const dead = { ok: false, stop: () => {} };
  if (!m) return dead;

  const perm = await m.requestPermissionsAsync();
  if (!perm.granted) {
    ev.onError('Microphone permission is off for Basalt in system settings.');
    return dead;
  }

  const subs: { remove: () => void }[] = [];
  const cleanup = () => subs.splice(0).forEach((s) => s.remove());
  subs.push(
    m.addListener('result', (e: any) => {
      const t: string = e?.results?.[0]?.transcript ?? '';
      if (e?.isFinal) ev.onFinal(t);
      else ev.onPartial(t);
    }),
    m.addListener('error', (e: any) => {
      ev.onError(e?.message ?? e?.error ?? 'Speech recognition failed.');
    }),
    m.addListener('end', () => {
      cleanup();
      ev.onEnd();
    }),
  );

  try {
    m.start({ lang: 'en-AU', interimResults: true, continuous: false });
  } catch (e: any) {
    cleanup();
    ev.onError(e?.message ?? 'Speech recognition failed to start.');
    return dead;
  }
  return { ok: true, stop: () => { try { m.stop(); } catch { /* end event still fires */ } } };
}
