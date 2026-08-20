// Mapping + encoding for Health Connect record origins.
//
// Every HC record carries a `metadata.dataOrigin` string — the Android
// package name of the app that wrote it. We fold that into the DB's `source`
// column as `health_connect:<packageName>` so future per-source XP rules
// have the granularity to differentiate (Samsung Health vs Google Fit vs
// third-party trackers). UI reads the tag back and displays a friendly
// label; unknown packages fall back to "Synced".

export const HC_SOURCE_PREFIX = 'health_connect';

const KNOWN_ORIGINS: Record<string, string> = {
  'com.sec.android.app.shealth':               'Samsung Health',
  'com.google.android.apps.fitness':           'Google Fit',
  'com.google.android.apps.healthdata':        'Health Connect',
  'com.myfitnesspal.android':                  'MyFitnessPal',
  'com.fitbit.FitbitMobile':                   'Fitbit',
  'com.garmin.android.apps.connectmobile':     'Garmin Connect',
  'com.strava':                                'Strava',
  'com.withings.wiscale2':                     'Withings',
  'com.polar.polarflow':                       'Polar Flow',
  'com.oura.android':                          'Oura',
  'com.whoop.mobile':                          'WHOOP',
  'com.underarmour.record.core':               'MapMyFitness',
  'com.mc.miband1':                            'Mi Fitness',
  'com.xiaomi.wearable':                       'Xiaomi Wear',
  'com.huawei.health':                         'Huawei Health',
  'sleepcycle.sleepanalysis':                  'Sleep Cycle',
  'com.nike.plusgps':                          'Nike Run Club',
};

/** Encode `source` for a DB write. Empty package → plain 'health_connect'. */
export function encodeHcSource(dataOrigin: string | undefined | null): string {
  const pkg = (dataOrigin ?? '').trim();
  return pkg ? `${HC_SOURCE_PREFIX}:${pkg}` : HC_SOURCE_PREFIX;
}

/** True if a `source` string represents any Health Connect import. */
export function isHcSource(source: string | undefined | null): boolean {
  if (!source) return false;
  return source === HC_SOURCE_PREFIX || source.startsWith(`${HC_SOURCE_PREFIX}:`);
}

/** Extract the package name portion of an HC source tag, or '' if none. */
export function packageFromSource(source: string | undefined | null): string {
  if (!source) return '';
  if (source === HC_SOURCE_PREFIX) return '';
  const idx = source.indexOf(':');
  return idx >= 0 ? source.slice(idx + 1) : '';
}

/**
 * Human-friendly label for a package name. Known apps get a pretty name;
 * unknown packages fall back to 'Synced' (so the UI never leaks a raw
 * `com.example.foo` string to the user).
 */
export function labelForPackage(dataOrigin: string | undefined | null): string {
  const pkg = (dataOrigin ?? '').trim();
  if (!pkg) return 'Synced';
  return KNOWN_ORIGINS[pkg] ?? 'Synced';
}

/** Convenience — pretty label straight from a stored `source` tag. */
export function labelForSource(source: string | undefined | null): string {
  return labelForPackage(packageFromSource(source));
}
