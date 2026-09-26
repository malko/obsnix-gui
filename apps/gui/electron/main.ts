import { app, BrowserWindow, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import {osbotSdk} from 'obsbot-sdk'
import type { BaseDevice } from 'obsbot-sdk/lib/base_device'
import type { FrontEndDevice } from '../../gui/types'
import type { TinyDevice } from 'obsbot-sdk/lib/tiny_device'
import type { MeetDevice } from 'obsbot-sdk/lib/meet_device'

// const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

const BOUNDS_FILE = path.join(app.getPath('userData'), 'window-bounds.json');

function saveWindowBounds(win: BrowserWindow) {
  try {
    const bounds = win.getBounds();
    fs.writeFileSync(BOUNDS_FILE, JSON.stringify(bounds));
  } catch (error) {
    console.error('Failed to save window bounds:', error);
  }
}

function loadWindowBounds() {
  try {
    if (fs.existsSync(BOUNDS_FILE)) {
      const data = fs.readFileSync(BOUNDS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to load window bounds:', error);
  }
  return { width: 1200, height: 800 };
}

let win: BrowserWindow | null

function createWindow() {
  // Load saved window bounds or use defaults
  const savedBounds = loadWindowBounds();

  win = new BrowserWindow({
    width: savedBounds.width,
    height: savedBounds.height,
    x: savedBounds.x,
    y: savedBounds.y,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(process.env.VITE_PUBLIC, 'logo.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // Save window bounds when they change (debounced)
  let saveTimeout: NodeJS.Timeout;
  const debouncedSave = () => {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      if (win && !win.isDestroyed()) {
        saveWindowBounds(win);
      }
    }, 500);
  };

  win.on('resize', debouncedSave);
  win.on('move', debouncedSave);

  // Save bounds before closing
  win.on('close', () => {
    if (win && !win.isDestroyed()) {
      saveWindowBounds(win);
    }
  });

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Cleanup native SDK on app quit
app.on('before-quit', async () => {
  // release native SDK resources
  await osbotSdk.release()
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Chromium exposes camera device IDs as HMAC-SHA256(origin, rawDeviceId + salt).
 * The salt lives either in the profile Preferences file (`media.device_id_salt`)
 * or, when media device ID partitioning is enabled, in a `MediaDeviceSalts`
 * SQLite database next to it. Return every salt we can find and let the
 * renderer try them all (it verifies each candidate against the real
 * `enumerateDevices()` output, so a wrong/half-read salt is harmless).
 */
const readPartitionedSalts = async (dbPath: string): Promise<string[]> => {
  if (!fs.existsSync(dbPath)) return [];
  try {
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(dbPath, { readOnly: true });
    try {
      const rows = db.prepare('SELECT salt FROM media_device_salts').all() as Array<{ salt?: string }>;
      return rows.map((row) => row.salt).filter((salt): salt is string => Boolean(salt));
    } finally {
      db.close();
    }
  } catch (error) {
    console.warn('Could not read MediaDeviceSalts database:', error);
    return [];
  }
};

const readMediaDeviceSalts = async (): Promise<string[]> => {
  const salts = new Set<string>();
  const userData = app.getPath('userData');

  try {
    const prefsPath = path.join(userData, 'Preferences');
    if (fs.existsSync(prefsPath)) {
      const prefs = JSON.parse(fs.readFileSync(prefsPath, 'utf8'));
      const salt = prefs?.media?.device_id_salt;
      if (typeof salt === 'string' && salt) salts.add(salt);
    }
  } catch (error) {
    console.warn('Could not read media device salt from Preferences:', error);
  }

  for (const salt of await readPartitionedSalts(path.join(userData, 'MediaDeviceSalts'))) {
    salts.add(salt);
  }

  return Array.from(salts);
};

const V4L2_CLASS_DIR = '/sys/class/video4linux';

const findUsbDevicePath = (videoNode: string): string | undefined => {
  try {
    let current = fs.realpathSync(path.join(V4L2_CLASS_DIR, videoNode, 'device'));
    while (current && current !== path.dirname(current)) {
      if (fs.existsSync(path.join(current, 'idVendor'))) return current;
      current = path.dirname(current);
    }
  } catch {
    // not a V4L2/USB device
  }
  return undefined;
};

/**
 * A single OBSBOT camera can expose several `/dev/videoN` nodes. The SDK may
 * pick a different one than Chromium, so return the path of every video node
 * belonging to the same physical USB device and let the HMAC verification
 * pick the right one.
 */
const getVideoPathCandidates = (videoPath: string): string[] => {
  if (process.platform !== 'linux' || !videoPath) return videoPath ? [videoPath] : [];
  const node = path.basename(videoPath);
  if (!/^video\d+$/.test(node)) return [videoPath];

  const usbDevice = findUsbDevicePath(node);
  if (!usbDevice) return [videoPath];

  try {
    const siblings = fs
      .readdirSync(V4L2_CLASS_DIR)
      .filter((name) => /^video\d+$/.test(name) && findUsbDevicePath(name) === usbDevice)
      .map((name) => path.join('/dev', name));
    return siblings.length > 0 ? siblings : [videoPath];
  } catch {
    return [videoPath];
  }
};

const osbotDevices = new Map<string, BaseDevice>();
const refreshDeviceList = () => {
  const devices = osbotSdk.getDevList();
  osbotDevices.clear();
  devices.forEach(device => {
    const sn = device.getSn();
    osbotDevices.set(sn, device)
  })
  console.log(`Found ${osbotDevices.size} OBSBOT device(s)`);
  return osbotDevices
}

const getDeviceListForFrontend = async (): Promise<Record<string, FrontEndDevice>> => {
  return Array.from(osbotDevices.entries()).reduce((acc, [key, device]) => {
    const videoPath = device.getVideoDevPath();
    const deviceName = device.getName();
    const productId = device.getProductType();
    const productType = device.getProductTypeName();
    const uuid = device.getUUID();
    const modelCode = device.getModelCode();

    acc[key] = {
      productId,
      product: deviceName,
      productTypeName: productType,
      uuid,
      modelCode,
      key,
      sn: device.getSn(),
      family: device.getFamily(),
      capabilities: device.getCapabilities(),
      videoPath,
      videoPaths: getVideoPathCandidates(videoPath),
    };
    return acc;
  }, {} as Record<string, FrontEndDevice>);
};

const sendDeviceListToFrontend = async () => {
  if (win && !win.isDestroyed()) {
    const deviceList = await getDeviceListForFrontend();
    win.webContents.send('device-list', deviceList);
  }
};

app.whenReady().then(() => {
  // Initialize the native SDK
  osbotSdk.setDevChangedCallback(async (event) => {
    refreshDeviceList();
    await sendDeviceListToFrontend();
    if (win) {
      win.webContents.send('device-changed', event);
    }
  })
  osbotSdk.init(false) // pass true to enable debug logs

  createWindow()

  app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })

})


ipcMain.on('scan-obsbot-devices', async (event) => {
  try {
    refreshDeviceList();
    const deviceList = await getDeviceListForFrontend();
    event.reply('device-list', deviceList)
  } catch (error) {
    console.error('Error getting devices from native SDK:', error)
    event.reply('device-list', {})
  }
});


ipcMain.handle('get-media-device-salts', async () => {
  try {
    return await readMediaDeviceSalts();
  } catch (error) {
    console.error('Error reading media device salts:', error);
    return [];
  }
});

ipcMain.handle('identify-device', async (_event, { sn }: { sn: string }) => {
  const device = osbotDevices.get(sn);
  if (!device) return { success: false, reason: 'unknown-device' };
  try {
    if (device.getFamily() === 'Tiny') {
      device.gimbalMove(0, 40);
      await delay(400);
      device.gimbalMove(0, -40);
      await delay(400);
      device.gimbalMove(0, 0);
      return { success: true, method: 'gimbal' };
    }

    const range = device.getZoomRange();
    if (range && range.max > range.min) {
      const current = device.getZoom();
      const target = Math.min(range.max, current + Math.max(1, (range.max - range.min) * 0.25));
      device.setZoom(target);
      await delay(500);
      device.setZoom(current);
      return { success: true, method: 'zoom' };
    }

    return { success: false, reason: 'no-identifier' };
  } catch (error) {
    console.error('Error identifying device:', error);
    return { success: false, reason: 'error' };
  }
});


ipcMain.on('set-ai-mode', (event, data) => {
  const { deviceId, mode, subMode } = data;
  const device = osbotDevices.get(deviceId);
  if (device instanceof osbotSdk.TinyDevice) {
    try {
      device.setAiMode(mode, subMode);
      event.reply('ai-mode-set', { deviceId, success: true });
    } catch (error) {
      console.error('Error setting AI mode:', error);
      event.reply('ai-mode-set', { deviceId, success: false });
    }
  } else {
    event.reply('ai-mode-set', { deviceId, success: false });
  }
});

ipcMain.handle('get-device-status', async (_event, deviceId: string) => {
  const device = osbotDevices.get(deviceId);
  let status: unknown = {};
  if (device) {
    const family = device.getFamily();
    switch(family) {
      case 'Tiny':
        status = await (device as TinyDevice).getStatus();
        break;
      case 'Meet':
        status = await (device as MeetDevice).getStatus();
        break;
      default:
        status = {};
        break;
    }
  }
  ipcMain.emit('device-status', null, { deviceId, status });
  return status
});

const toggleGestureHandler = async (_event, data: { deviceId: string; enable: boolean; gestureType: 'target' | 'zoom' | 'dynamicZoom' | 'mirror' }) => {
  const { deviceId, enable, gestureType } = data;
  const device = osbotDevices.get(deviceId);
  if (device instanceof osbotSdk.TinyDevice) {
    try {
      await device[`toggleGesture${gestureType.charAt(0).toUpperCase() + gestureType.slice(1)}`](enable);
      return { deviceId, success: true };
    } catch (error) {
      console.error(`Error toggling gesture ${gestureType}:`, error);
      return { deviceId, success: false };
    }
  } else {
    return { deviceId, success: false };
  }
};

ipcMain.handle('toggle-gesture-target', async (_event, data: { deviceId: string; enable: boolean }) => {
  const { deviceId, enable } = data;
  return toggleGestureHandler(_event, { deviceId, enable, gestureType: 'target' });
});
ipcMain.handle('toggle-gesture-zoom', async (_event, data: { deviceId: string; enable: boolean }) => {
  const { deviceId, enable } = data;
  return toggleGestureHandler(_event, { deviceId, enable, gestureType: 'zoom' });
});
ipcMain.handle('toggle-gesture-dynamic-zoom', async (_event, data: { deviceId: string; enable: boolean }) => {
  const { deviceId, enable } = data;
  return toggleGestureHandler(_event, { deviceId, enable, gestureType: 'dynamicZoom' });
});
ipcMain.handle('toggle-gesture-mirror', async (_event, data: { deviceId: string; enable: boolean }) => {
  const { deviceId, enable } = data;
  return toggleGestureHandler(_event, { deviceId, enable, gestureType: 'mirror' });
});
