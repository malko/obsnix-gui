/* eslint-env node */
/* eslint-disable @typescript-eslint/no-var-requires */
const { Arch } = require('electron-builder');
const fs = require('fs');
const path = require('path');
const appImageFixer = require('./app-image-fixer.cjs');

const sdkCopier = (isAppImage=false) => async (context) => {
	const { appOutDir, packager, arch } = context;
	const platformName = packager.platform.name; // 'linux', 'windows', 'mac'

	const sdkBaseDir = path.resolve(__dirname, '../../../libs/sdk/libdev_v2.1.0_7');
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
		isAppImage && appImageFixer(context); // Apply AppImage sandbox fix
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

module.exports = sdkCopier;