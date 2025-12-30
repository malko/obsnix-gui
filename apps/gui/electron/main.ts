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
      capabilities: device.getCapabilities(),
      videoPath,
      mediaDeviceLabelMatcher: new RegExp('OBSBOT ' + productType.replace(/\s+/g, `\\s*`), 'i'),
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
  let status: any = {};
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
