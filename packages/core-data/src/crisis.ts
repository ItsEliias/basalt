// The crisis path (V4 Phase 7) — ALWAYS ON. This module lives in
// core-data precisely so nothing about it can be an Extra: it has no
// registry entry, no flag, no setting, and the lint test pins that its
// screen is never wrapped in an ExtraSlot. Every free-text field where a
// person writes about themselves runs checkCrisis BEFORE anything else
// (guards, coaches, saves of derived behaviour — the entry itself still
// saves).
//
// Detection is deliberately over-broad and entirely on-device: false
// positives cost one respectful screen; false negatives are not
// acceptable. The spec allowed an AI second pass for unsure matches — we
// treat unsure as a hit instead, because it is stricter AND keeps the
// promise that no text leaves the device without the user's own action.

const DEFINITE = [
  'kill myself', 'end my life', 'suicide', 'suicidal', 'want to die',
  'better off dead', 'no reason to live', 'end it all', 'take my own life',
  'hurt myself', 'harm myself', 'self harm', 'self-harm', 'cut myself',
  'overdose', 'not want to wake up', "don't want to wake up",
  'everyone would be better without me', 'goodbye letter',
];

const UNSURE = [
  'no point anymore', "can't go on", 'cant go on', 'give up on everything',
  'nothing matters anymore', 'disappear forever', 'tired of being alive',
  'what is the point of living',
];

/** True = show the crisis screen, stop any coaching. Pure, always on. */
export function checkCrisis(text: string): boolean {
  const t = text.toLowerCase();
  return DEFINITE.some((p) => t.includes(p)) || UNSURE.some((p) => t.includes(p));
}

export type CrisisLine = { name: string; phone: string; sms?: string };

export type CrisisResources = {
  region: string;
  lines: CrisisLine[];
  emergency: string;
  /** Everyone gets the directory link too. */
  directory: 'https://findahelpline.com';
};

/** Regional numbers, from a 2-letter region code (device locale). */
export function crisisResourcesFor(regionCode: string | null): CrisisResources {
  const r = (regionCode ?? '').toUpperCase();
  const directory = 'https://findahelpline.com' as const;
  if (r === 'AU') {
    return {
      region: 'AU', emergency: '000', directory,
      lines: [{ name: 'Lifeline', phone: '13 11 14', sms: '0477 13 11 14' }],
    };
  }
  if (r === 'NZ') {
    return { region: 'NZ', emergency: '111', directory, lines: [{ name: 'Need to talk?', phone: '1737', sms: '1737' }] };
  }
  if (r === 'GB' || r === 'UK' || r === 'IE') {
    return { region: r === 'IE' ? 'IE' : 'UK', emergency: r === 'IE' ? '112' : '999', directory, lines: [{ name: 'Samaritans', phone: '116 123' }] };
  }
  if (r === 'US' || r === 'CA') {
    return { region: r, emergency: '911', directory, lines: [{ name: 'Suicide & Crisis Lifeline', phone: '988', sms: '988' }] };
  }
  return { region: 'other', emergency: '112', directory, lines: [] };
}

// The words on the screen — plain, no mascot, no questioning back.
export const CRISIS_HEADING = 'This sounds heavy.';
export const CRISIS_BODY =
  'Basalt is a ledger, not the right help for this moment. Talking to a person is. '
  + 'These lines are free, anonymous and open now. Whatever you wrote is still saved — nothing was sent anywhere.';
