// Expo config plugin: Basalt has exactly one fixed dark palette (no light
// mode, per docs/basalt-design-spec.md) but the generated AppTheme parent is
// Theme.AppCompat.DayNight.NoActionBar, which lets Android's automatic
// "Force Dark" color remapping repaint native widgets — confirmed on-device
// (Samsung SM_S908E) via uiautomator: typed EditText text held the correct
// string (`color: color.ink` in JS, #F4F5F6) but rendered at ~#22262E,
// indistinguishable from the input's own background. Plain RN <Text> was
// unaffected, isolating it to native EditText widget repainting. Declaring
// forceDarkAllowed=false (API 29+) makes the OS stop touching colors we
// already control end-to-end.
const { withAndroidStyles, AndroidConfig } = require('@expo/config-plugins');

module.exports = function withDisableForceDark(config) {
  return withAndroidStyles(config, (cfg) => {
    cfg.modResults = AndroidConfig.Styles.setStylesItem({
      xml: cfg.modResults,
      parent: AndroidConfig.Styles.getAppThemeGroup(),
      item: {
        $: { name: 'android:forceDarkAllowed', 'tools:targetApi': '29' },
        _: 'false',
      },
    });
    return cfg;
  });
};
