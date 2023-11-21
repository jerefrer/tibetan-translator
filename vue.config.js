module.exports = {
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
  productionSourceMap: false,
};
