const { Arch } = require('electron-builder');
const fs = require('fs');
const path = require('path');

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
  mac: {
    target: ["dmg", "zip"],
    artifactName: "${productName}-${version}-mac-${arch}.${ext}",
    hardenedRuntime: true,
    gatekeeperAssess: false,
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
    target: ["deb", "AppImage", "apk"],
    category: "Video",
    artifactName: "${productName}-${version}-linux-${arch}.${ext}",
    synopsis: "OBSBOT GUI Application",
    description: "Control application for OBSBOT cameras"
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    deleteAppDataOnUninstall: false
  },
  publish: {
    provider: "github",
    owner: "malko",
    repo: "obsnix-gui"
  },
  afterPack: async (context) => {
    const { appOutDir, packager, arch } = context;
    const platformName = packager.platform.name; // 'linux', 'windows', 'mac'

    // We only handle Linux and Mac here because Windows is handled by extraFiles (only x64 supported there)
    if (platformName === 'windows') return;

    const sdkBaseDir = path.resolve(__dirname, '../../libs/sdk/libdev_v2.1.0_7');
    let sourceDir = '';
    let filesToCopy = [];

    if (platformName === 'linux') {
      if (arch === Arch.x64) {
        sourceDir = path.join(sdkBaseDir, 'linux/x86_64-release');
      } else if (arch === Arch.arm64) {
        sourceDir = path.join(sdkBaseDir, 'linux/arm64-release');
      }
      // Find libdev.so* files
      if (sourceDir && fs.existsSync(sourceDir)) {
        filesToCopy = fs.readdirSync(sourceDir).filter(f => f.startsWith('libdev.so'));
      }
    } else if (platformName === 'mac') {
      if (arch === Arch.x64) {
        sourceDir = path.join(sdkBaseDir, 'macos/x86_64-release');
      } else if (arch === Arch.arm64) {
        sourceDir = path.join(sdkBaseDir, 'macos/arm64-release');
      }
      if (sourceDir && fs.existsSync(sourceDir)) {
        filesToCopy = ['libdev.dylib'];
      }
    }

    if (sourceDir && filesToCopy.length > 0) {
      console.log(`[afterPack] Copying SDK files for ${platformName} (${Arch[arch]}) from ${sourceDir}`);

      // Target directory: where the native module is unpacked
      // This ensures RPATH $ORIGIN works
      const targetDir = path.join(appOutDir, 'resources/app.asar.unpacked/build/Release');

      // Ensure target directory exists (it should if obsbot_native.node is there)
      if (!fs.existsSync(targetDir)) {
         console.log(`[afterPack] Creating target directory: ${targetDir}`);
         fs.mkdirSync(targetDir, { recursive: true });
      }

      for (const file of filesToCopy) {
        const src = path.join(sourceDir, file);
        const dest = path.join(targetDir, file);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
          console.log(`  Copied ${file} to ${dest}`);
        } else {
          console.warn(`  Warning: Source file not found: ${src}`);
        }
      }
    }
  }
};
