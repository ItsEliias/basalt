// Expo config plugin: @notifee/react-native ships its `app.notifee:core`
// AAR as a local Maven repo inside its own package (android/libs), and its
// build.gradle tries to register that repo on every project via
// `rootProject.allprojects{}`. That self-registration doesn't reliably
// propagate to :app's dependency resolution in this pnpm workspace + recent
// Gradle combination (confirmed: the repo never shows up in Gradle's
// "Searched in the following locations" for app.notifee:core), so :app
// fails to resolve the dependency. Declaring the same repo explicitly in
// the root build.gradle's `allprojects` block fixes it — same repo,
// declared where :app is guaranteed to see it.
const { withProjectBuildGradle } = require('@expo/config-plugins');

const MARKER = 'notifee local maven (withNotifeeMavenRepo)';

module.exports = function withNotifeeMavenRepo(config) {
  return withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') return cfg;
    if (cfg.modResults.contents.includes(MARKER)) return cfg;
    cfg.modResults.contents = cfg.modResults.contents.replace(
      /allprojects\s*\{\s*repositories\s*\{/,
      `allprojects {\n  repositories {\n    // ${MARKER}\n    maven { url "$rootDir/../node_modules/@notifee/react-native/android/libs" }`,
    );
    return cfg;
  });
};
