import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const guiRoot = resolve(scriptDir, '..');
const sdkRoot = resolve(guiRoot, '../../libs/sdk');

const nativeSrc = join(sdkRoot, 'build/Release/obsbot_native.node');

if (!existsSync(nativeSrc)) {
  console.error(`[copy-native] Native module not found at ${nativeSrc}.`);
  console.error('[copy-native] Build the SDK first (monospace run sdk#build).');
  process.exit(1);
}

// `dist-electron/main.js` requires `../build/Release/obsbot_native.node` while
// electron-builder maps `native-deps/build/Release` to `build/Release` in the
// packaged app. Copy to both so dev and packaged runs resolve identically.
const targets = [
  join(guiRoot, 'build/Release'),
  join(guiRoot, 'native-deps/build/Release'),
];

const platformLibraries = () => {
  const libdevRoot = join(sdkRoot, 'libdev_v2.1.0_7');
  const arch = process.arch === 'arm64' ? 'arm64' : 'x86_64';

  switch (process.platform) {
    case 'linux':
      return { dir: join(libdevRoot, `linux/${arch}-release`), matches: (file) => file.startsWith('libdev.so') };
    case 'darwin':
      return { dir: join(libdevRoot, `macos/${arch}-release`), matches: (file) => file === 'libdev.dylib' };
    case 'win32':
      return { dir: join(libdevRoot, 'windows/win64-release'), matches: (file) => file.endsWith('.dll') };
    default:
      return undefined;
  }
};

const libraries = platformLibraries();
const libraryFiles = libraries && existsSync(libraries.dir)
  ? readdirSync(libraries.dir).filter(libraries.matches)
  : [];

for (const target of targets) {
  mkdirSync(target, { recursive: true });

  copyFileSync(nativeSrc, join(target, 'obsbot_native.node'));

  for (const file of libraryFiles) {
    const source = join(libraries.dir, file);
    if (statSync(source).isFile()) {
      copyFileSync(source, join(target, file));
    }
  }

  console.log(`[copy-native] Copied obsbot_native.node${libraryFiles.length ? ` + ${libraryFiles.length} SDK libraries` : ''} to ${target}`);
}
