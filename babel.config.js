module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // Necessário para o react-native-reanimated v4 (o plugin do worklets
    // substitui o antigo react-native-reanimated/plugin). Deve ser o último.
    plugins: ["react-native-worklets/plugin"],
  };
};
