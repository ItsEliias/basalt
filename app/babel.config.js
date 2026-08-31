// Created for react-native-worklets-core (VisionCamera frame processors,
// V3.1 H1). Everything else is the implicit Expo default made explicit.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-worklets-core/plugin'],
  };
};
