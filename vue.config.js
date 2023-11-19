module.exports = {
  pwa: {
    name: "Tibetan Translator",
    themeColor: "#333333",
    msTileColor: "#000000",
    appleMobileWebAppCapable: "yes",
    appleMobileWebAppStatusBarStyle: "black",
    workboxOptions: {
      additionalManifestEntries: [
        { url: "/TibetanTranslator.sqlite", revision: "1" },
        { url: "/favicon.ico", revision: "1" },
        { url: "/img/icons/android-chrome-192x192.png", revision: "1" },
        { url: "/img/icons/android-chrome-512x512.png", revision: "1" },
        { url: "/img/icons/apple-touch-icon.png", revision: "1" },
        { url: "/img/icons/favicon-16x16.png", revision: "1" },
        { url: "/img/icons/favicon-32x32.png", revision: "1" },
        { url: "/img/icons/favicon.ico", revision: "1" },
        { url: "/img/icons/favicon.svg", revision: "1" },
        { url: "/img/icons/mstile-70x70.png", revision: "1" },
        { url: "/img/icons/mstile-144x144.png", revision: "1" },
        { url: "/img/icons/mstile-150x150.png", revision: "1" },
        { url: "/img/icons/mstile-310x150.png", revision: "1" },
        { url: "/img/icons/mstile-310x310.png", revision: "1" },
        { url: "/img/icons/safari-pinned-tab.svg", revision: "1" },
      ],
    },
  },
  configureWebpack: {
    devtool: "source-map",
    module: {
      rules: [{ test: /\.js$/, use: "babel-loader" }],
    },
    resolve: {
      alias: {
        vue$: "vue/dist/vue.esm.js",
      },
      fallback: {
        fs: false,
        path: false,
        crypto: false,
      },
    },
  },
  publicPath: "./",
};
