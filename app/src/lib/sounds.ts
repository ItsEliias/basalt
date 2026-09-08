import { createAudioPlayer } from 'expo-audio';
import { getExtras } from './extras';

// The sounds Extra — three short generated samples, played quietly through
// the media stream. Known limit, stated: Android's ringer switch does not
// mute the media stream; the Extra is opt-in and the samples are soft.
// Haptics are core and unaffected.

const SOURCES = {
  tick: require('../../assets/sounds/tick.wav'),
  commit: require('../../assets/sounds/commit.wav'),
  pr: require('../../assets/sounds/pr.wav'),
} as const;

export async function playSound(kind: keyof typeof SOURCES): Promise<void> {
  try {
    const extras = await getExtras();
    if (!extras.sounds) return;
    const player = createAudioPlayer(SOURCES[kind]);
    player.volume = 0.4;
    player.play();
    setTimeout(() => { try { player.release(); } catch { /* released */ } }, 1500);
  } catch { /* a missing beep is not an error */ }
}
