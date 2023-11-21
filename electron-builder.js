module.exports = {
  appId: "com.jerefrer.TibetanTranslator",
  productName: "TibetanTranslator",
  beforeBuild: "scripts/modifyFontFilepath.js",
  mac: {
    category: "public.app-category.education",
    // artifactName: "${name}-${version}.${arch}.${ext}",
    target: ["zip"],
  },
  win: {
    icon: "./public/img/logo.png",
    target: [
      {
        target: "nsis",
        arch: ["x64", "ia32"],
      },
    ],
    // artifactName: "${name}-${version}.${arch}.${ext}",
  },
  nsis: {
    oneClick: false,
    perMachine: true,
    allowToChangeInstallationDirectory: true,
  },
  linux: {
    target: ["AppImage"],
    icon: "./public/img/logo.png",
  },
  publish: [
    {
      provider: "github",
      owner: "jerefrer",
      repo: "tibetan-translator",
      releaseType: "draft",
    },
  ],
};
