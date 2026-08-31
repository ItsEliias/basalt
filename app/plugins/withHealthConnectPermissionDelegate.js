// Expo config plugin: react-native-health-connect's own app.plugin.js only
// adds the permissions-rationale intent-filter — it never wires up
// HealthConnectPermissionDelegate.setPermissionDelegate(this) in
// MainActivity, which its own README documents as required manual setup.
// Without it, HealthConnectPermissionDelegate's `requestPermission` launcher
// is never registered, so the FIRST call to request Health Connect
// permissions throws `UninitializedPropertyAccessException: lateinit
// property requestPermission has not been initialized` on a background
// coroutine thread — an uncaught native crash, confirmed via `adb logcat -b
// crash` (dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate
// .launchPermissionsDialog, HealthConnectPermissionDelegate.kt:45), invisible
// to any JS-level Result<T> try/catch since it never reaches JS.
const { withMainActivity } = require('@expo/config-plugins');

const IMPORT_LINE = 'import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate';
const DELEGATE_CALL = 'HealthConnectPermissionDelegate.setPermissionDelegate(this)';

module.exports = function withHealthConnectPermissionDelegate(config) {
  return withMainActivity(config, (cfg) => {
    if (cfg.modResults.language !== 'kt') return cfg;
    let contents = cfg.modResults.contents;

    if (!contents.includes(IMPORT_LINE)) {
      contents = contents.replace(
        /import expo\.modules\.ReactActivityDelegateWrapper/,
        `import expo.modules.ReactActivityDelegateWrapper\n\n${IMPORT_LINE}`,
      );
    }

    if (!contents.includes(DELEGATE_CALL)) {
      contents = contents.replace(
        /super\.onCreate\(null\)/,
        `super.onCreate(null)\n    // In order to handle Health Connect permission contract results, we\n    // need to set the permission delegate (react-native-health-connect README).\n    ${DELEGATE_CALL}`,
      );
    }

    cfg.modResults.contents = contents;
    return cfg;
  });
};
