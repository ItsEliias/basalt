// Expo config plugin: react-native-health-connect's own app.plugin.js only
// adds the ACTION_SHOW_PERMISSIONS_RATIONALE intent-filter — it never
// declares the Health Connect package in <queries>. On Android 11+, package
// visibility is filtered by default: without this declaration, the app
// cannot resolve/launch com.google.android.apps.healthdata, and the native
// health-connect-sdk client throws when asked to check availability or
// launch permissions, which crashes the app instead of surfacing a JS
// Result<T> error (confirmed: every JS-level call site is already
// try/catch-guarded, so the crash has to be below that layer).
const { withAndroidManifest } = require('@expo/config-plugins');

const HEALTH_CONNECT_PACKAGE = 'com.google.android.apps.healthdata';

module.exports = function withHealthConnectQueries(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.queries = manifest.queries || [];
    if (manifest.queries.length === 0) {
      manifest.queries.push({});
    }
    const queriesBlock = manifest.queries[0];
    queriesBlock.package = queriesBlock.package || [];
    const alreadyDeclared = queriesBlock.package.some(
      (p) => p.$ && p.$['android:name'] === HEALTH_CONNECT_PACKAGE,
    );
    if (!alreadyDeclared) {
      queriesBlock.package.push({ $: { 'android:name': HEALTH_CONNECT_PACKAGE } });
    }

    // react-native-health-connect's own plugin pushes a fresh
    // ACTION_SHOW_PERMISSIONS_RATIONALE intent-filter on every prebuild
    // without checking for an existing one, which triples it across
    // repeated (non-clean) prebuilds. Dedupe defensively here too.
    const activity = manifest.application[0].activity[0];
    if (Array.isArray(activity['intent-filter'])) {
      const seen = new Set();
      activity['intent-filter'] = activity['intent-filter'].filter((filter) => {
        const actionNames = (filter.action || []).map((a) => a.$['android:name']).sort().join(',');
        const categoryNames = (filter.category || []).map((c) => c.$['android:name']).sort().join(',');
        const key = `${actionNames}|${categoryNames}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    return cfg;
  });
};
