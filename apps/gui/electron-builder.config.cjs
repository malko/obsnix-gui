/* eslint-env node */
/* eslint-disable @typescript-eslint/no-var-requires */
const commonConfig = require('./electron-builder-common.config.cjs');
const sdkCopier = require('./electron-builder-hooks/sdk-copier.cjs');
/**
 * @type {import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration/configuration
 */
module.exports = {
  ...commonConfig,
  mac: {
    target: ["zip"],
    artifactName: "${productName}-${version}-mac-${arch}.${ext}",
    hardenedRuntime: true,
    gatekeeperAssess: false,
    icon: "public/icons/",
    extendInfo: {
      NSCameraUsageDescription: "This app requires camera access to control OBSBOT devices."
    }
  },
  win: {
    target: [
      {
        target: "nsis",
        arch: ["x64"]
      }
    ],
    artifactName: "${productName}-${version}-win-${arch}.${ext}",
    icon: "public/icons/",
    extraFiles: [
      {
        from: "../../libs/sdk/libdev_v2.1.0_7/windows/win64-release/libdev.dll",
        to: "."
      },
      {
        from: "../../libs/sdk/libdev_v2.1.0_7/windows/win64-release/w32-pthreads.dll",
        to: "."
      }
    ]
  },
  linux: {
    // target: ["flatpak", "snap", "deb", "rpm"],
    target: ["flatpak", "deb", "rpm"],
    category: "Video",
    artifactName: "${productName}-${version}-linux-${arch}.${ext}",
    synopsis: "OBSNIX GUI Application",
    description: "Control application for OBSBOT cameras",
    icon: "public/icons/",
    desktop: {
      entry: {
        "Name": "OBSNIX",
        "Comment": "Control OBSBOT cameras AI tracking modes",
        "Categories": "AudioVideo;Video;Utility;"
      }
    }
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    deleteAppDataOnUninstall: false
  },
  afterPack: sdkCopier(false)
};
