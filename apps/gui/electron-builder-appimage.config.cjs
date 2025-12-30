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
    icon: "public/icons/",
    description: "Control application for OBSBOT cameras",
    desktop: {
      entry: {
        "Name": "OBSNIX",
        "Comment": "Control OBSBOT cameras AI tracking modes",
        "Categories": "AudioVideo;Video;Utility;"
      }
    }
  },
  afterPack: sdkCopier(true)
};
