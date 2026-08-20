// Expo config plugin: Android 14+ requires every foreground service to
// declare a type. Notifee's service is declared here as specialUse with an
// explicit subtype (Play review reads it), overriding the library default
// via tools:replace. If Basalt ever requests ACTIVITY_RECOGNITION, the
// `health` FGS type (API 34, made for workout trackers) is the better fit —
// revisit at store submission.
const { withAndroidManifest } = require('@expo/config-plugins');

const PERMISSIONS = [
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
  'android.permission.POST_NOTIFICATIONS',
];

module.exports = function withTimerFgs(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.$ = manifest.$ || {};
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';

    manifest['uses-permission'] = manifest['uses-permission'] || [];
    for (const name of PERMISSIONS) {
      if (!manifest['uses-permission'].some((p) => p.$['android:name'] === name)) {
        manifest['uses-permission'].push({ $: { 'android:name': name } });
      }
    }

    const app = manifest.application[0];
    app.service = app.service || [];
    let svc = app.service.find((s) => s.$['android:name'] === 'app.notifee.core.ForegroundService');
    if (!svc) {
      svc = { $: { 'android:name': 'app.notifee.core.ForegroundService' } };
      app.service.push(svc);
    }
    svc.$['android:foregroundServiceType'] = 'specialUse';
    svc.$['tools:replace'] = 'android:foregroundServiceType';
    svc.property = [
      {
        $: {
          'android:name': 'android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE',
          'android:value': 'Guided workout set timer keeps running while the screen is off',
        },
      },
    ];
    return cfg;
  });
};
