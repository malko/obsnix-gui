/* eslint-env node */
/* eslint-disable @typescript-eslint/no-var-requires */
const sdkCopier = require('./electron-builder-hooks/sdk-copier.cjs');
const commonConfig = require('./electron-builder-common.config.cjs');
/**
 * @type {import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration/configuration
 */
module.exports = {
  ...commonConfig,
  linux: {
    target: ["AppImage"],
    category: "Video",
    artifactName: "${productName}-${version}-linux-${arch}.${ext}",
    synopsis: "OBSBOT GUI Application",
    description: "Control application for OBSBOT cameras",
  },
  afterPack: sdkCopier(true)
};
