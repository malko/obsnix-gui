/* eslint-env node */
/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * @type {import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration/configuration
 */
module.exports = {
  appId: "eu.gotti.obsnix",
  productName: "OBSNIX",
  // The OBSBOT native addon is shipped prebuilt (native-deps -> build/Release)
  // and is an N-API module, so there is no need to rebuild it for Electron.
  // Rebuilding the workspace `obsbot-sdk` fails when cross-compiling.
  npmRebuild: false,
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
