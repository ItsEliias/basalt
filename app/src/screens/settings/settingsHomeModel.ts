// V4.1 §2 — the Settings home is a short list of sections, each with a
// one-line summary of its CURRENT values ("Gummy · Standard · Tiles"), so
// the home answers "what is set" without opening anything. Pure so the
// summaries are testable.

export type SettingsSectionKey =
  | 'profile' | 'appearance' | 'pebble' | 'extras'
  | 'nutrition' | 'notifications' | 'account' | 'about';

export const SETTINGS_SECTIONS: { key: SettingsSectionKey; name: string }[] = [
  { key: 'profile', name: 'Profile' },
  { key: 'appearance', name: 'Appearance' },
  { key: 'pebble', name: 'Pebble' },
  { key: 'extras', name: 'Extras' },
  { key: 'nutrition', name: 'Nutrition' },
  { key: 'notifications', name: 'Notifications' },
  { key: 'account', name: 'Account' },
  { key: 'about', name: 'About' },
];

export function profileSummary(p: {
  name?: string | null; goalCount: number; targetsKcal: number | null;
}): string {
  const parts = [
    p.name?.trim() || 'no name set',
    p.goalCount > 0 ? `${p.goalCount} goal${p.goalCount === 1 ? '' : 's'}` : 'no goals',
    p.targetsKcal != null ? `${p.targetsKcal} kcal target` : 'no targets yet',
  ];
  return parts.join(' · ');
}

export function appearanceSummary(p: {
  themeName: string; detailTitle: string; layoutLabel: string;
}): string {
  return `${p.themeName} · ${p.detailTitle} · ${p.layoutLabel}`;
}

export function pebbleSummary(on: boolean, stage: number | null): string {
  if (!on) return 'off — default';
  return stage != null ? `on · stage ${stage} of 5` : 'on';
}

export function extrasSummary(onCount: number, total: number): string {
  return onCount === 0 ? `all ${total} off — the core app` : `${onCount} of ${total} on`;
}

export function nutritionSummary(p: { hideNumbers: boolean; challengeOn: boolean }): string {
  const parts = [p.hideNumbers ? 'numbers hidden' : 'numbers shown'];
  if (p.challengeOn) parts.push('monthly challenge on');
  return parts.join(' · ');
}

export function notificationsSummary(onCount: number): string {
  return onCount === 0 ? 'all off' : `${onCount} on`;
}

export function accountSummary(email: string | null): string {
  return email ?? 'signed out';
}

export function aboutSummary(version: string | null): string {
  return version ? `v${version} · the promise, feedback` : 'the promise, feedback';
}
