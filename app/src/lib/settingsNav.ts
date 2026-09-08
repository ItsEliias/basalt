import type { SettingsSectionKey } from '../screens/settings/settingsHomeModel';

// V4.1 §2 — deep links land on a SECTION, not the settings home. Any screen
// can call openSettingsSection('appearance'); App opens the settings view and
// SettingsScreen consumes the pending key on mount.

let pending: SettingsSectionKey | null = null;
let opener: (() => void) | null = null;

export function openSettingsSection(section: SettingsSectionKey): void {
  pending = section;
  opener?.();
}

/** App.tsx registers how "open the settings view" actually happens. */
export function registerSettingsOpener(fn: () => void): () => void {
  opener = fn;
  return () => { if (opener === fn) opener = null; };
}

/** SettingsScreen consumes the deep-link target exactly once. */
export function consumePendingSection(): SettingsSectionKey | null {
  const p = pending;
  pending = null;
  return p;
}
