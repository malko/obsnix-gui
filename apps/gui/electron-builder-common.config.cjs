/* eslint-env node */
/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * @type {import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration/configuration
 */
module.exports = {
  appId: "eu.gotti.obsnix",
  productName: "OBSNIX",
  directories: {
    output: "release/${version}"
  },
  files: [
    "dist-electron/**/*",
    "dist/**/*",
    {
      from: "native-deps/build/Release",
      to: "build/Release",
      filter: ["*.node"]
    }
  ],
  asarUnpack: [
    "**/build/Release/*.node"
  ],
  publish: {
    provider: "github",
    owner: "malko",
    repo: "obsnix-gui"
  },
};
