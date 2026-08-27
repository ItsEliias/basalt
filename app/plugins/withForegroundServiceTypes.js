// Expo config plugin: Android 14+ requires every foreground service to
// declare a type — plural, since API 34 supports pipe-combined multi-type
// declarations on one service, and notifee only ever registers ONE Android
// service class (app.notifee.core.ForegroundService) for every notifee
// foreground notification an app shows, regardless of purpose.
//
// `health` — the type Google built for workout trackers — backs the
// session-timer notification (timerService.ts). It requires the app to
// hold one of ACTIVITY_RECOGNITION / HIGH_SAMPLING_RATE_SENSORS /
// BODY_SENSORS; ACTIVITY_RECOGNITION is the defensible one for a fitness
// app and is requested at runtime before the service starts (falls back
// honestly if the user declines).
//
// `location` backs the outdoor-walk-tracking notification
// (walkTrackingService.ts) — it only requires the app already hold
// ACCESS_FINE_LOCATION/ACCESS_COARSE_LOCATION (requested separately, well
// before a walk starts), no extra runtime permission of its own.
const { withAndroidManifest } = require('@expo/config-plugins');

const PERMISSIONS = [
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_HEALTH',
  'android.permission.FOREGROUND_SERVICE_LOCATION',
  'android.permission.ACTIVITY_RECOGNITION',
  'android.permission.POST_NOTIFICATIONS',
];

module.exports = function withForegroundServiceTypes(config) {
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
    svc.$['android:foregroundServiceType'] = 'health|location';
    svc.$['tools:replace'] = 'android:foregroundServiceType';
    delete svc.property;
    return cfg;
  });
};
