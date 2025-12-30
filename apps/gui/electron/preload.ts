import { ipcRenderer, contextBridge } from 'electron'
import type { FrontEndDevice } from '../types'


const API= {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  once(...args: Parameters<typeof ipcRenderer.once>) {
    const [channel, listener] = args
    return ipcRenderer.once(channel, (event, ...args) => listener(event, ...args))
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },
  setAiMode: (deviceId:string , mode: number, subMode?: number) => ipcRenderer.send('set-ai-mode', { deviceId, mode, subMode }),
  listDevices: () => ipcRenderer.send('scan-obsbot-devices'),
  onDeviceList: (callback: (devices: Record<string, FrontEndDevice>) => void) => {
    const cb = (_event, value) => callback(value)
    ipcRenderer.on('device-list', cb)
    return () => ipcRenderer.off('device-list', cb)
  },
  getDeviceStatus: (deviceId: string) => ipcRenderer.invoke('get-device-status', deviceId),
  onDeviceStatus: (callback: (data: { deviceId: string; status: any }) => void) => {
    const cb = (_event, value) => callback(value)
    ipcRenderer.on('device-status', cb)
    return () => ipcRenderer.off('device-status', cb)
  },
  toggleGestureTarget: (deviceId: string, enable: boolean) => ipcRenderer.invoke('toggle-gesture-target', { deviceId, enable }),
  toggleGestureZoom: (deviceId: string, enable: boolean) => ipcRenderer.invoke('toggle-gesture-zoom', { deviceId, enable }),
  toggleGestureDynamicZoom: (deviceId: string, enable: boolean) => ipcRenderer.invoke('toggle-gesture-dynamic-zoom', { deviceId, enable }),
  toggleGestureMirror: (deviceId: string, enable: boolean) => ipcRenderer.invoke('toggle-gesture-mirror', { deviceId, enable }),
}

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', API)
export type IpcRendererAPI = typeof API
