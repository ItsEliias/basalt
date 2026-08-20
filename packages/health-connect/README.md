# @basalt/health-connect

Platform-agnostic health-data provider abstraction wrapping
[`react-native-health-connect`](https://www.npmjs.com/package/react-native-health-connect). Consumers
import `healthService` and the `HealthProvider` type surface from this package and never see
Health Connect (or a future HealthKit provider) directly.

`react-native-health-connect` and `react-native` are peer dependencies — the native module and its
Android manifest wiring are owned by the consuming app, not this package.

## App configuration required

Each consuming app's `app.json` must:

1. Register the Expo config plugin:

   ```json
   {
     "expo": {
       "plugins": ["react-native-health-connect"]
     }
   }
   ```

2. Declare the Health Connect permissions the app actually reads, under
   `expo.android.permissions`. Example (from `apps/arise/app.json`, which currently only declares
   `READ_STEPS` — extend this list as an app adds providers for the other `HealthPermission` values
   in `src/types.ts`, e.g. `android.permission.health.READ_HEART_RATE`,
   `android.permission.health.READ_SLEEP`, `android.permission.health.READ_WEIGHT`, etc.):

   ```json
   {
     "expo": {
       "android": {
         "permissions": ["android.permission.health.READ_STEPS"]
       }
     }
   }
   ```

Android 13/14 Health Connect availability/permission handling is done through the Expo plugin
block above — there is no separate native patch required.
