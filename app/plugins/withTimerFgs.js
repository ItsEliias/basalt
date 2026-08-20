// Expo config plugin: Android 14+ requires every foreground service to
// declare a type. Notifee's service is declared as `health` — the type
// Google built for workout trackers (API 34). `health` requires the app to
// hold one of ACTIVITY_RECOGNITION / HIGH_SAMPLING_RATE_SENSORS /
// BODY_SENSORS; ACTIVITY_RECOGNITION is the defensible one for a fitness
// app and is requested at runtime before the service starts
// (timerService.ts falls back honestly if the user declines).
const { withAndroidManifest } = require('@expo/config-plugins');

const PERMISSIONS = [
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_HEALTH',
  'android.permission.ACTIVITY_RECOGNITION',
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
    svc.$['android:foregroundServiceType'] = 'health';
    svc.$['tools:replace'] = 'android:foregroundServiceType';
    delete svc.property;
    return cfg;
  });
};
