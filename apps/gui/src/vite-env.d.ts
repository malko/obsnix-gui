/// <reference types="vite/client" />
interface Window {
  ipcRenderer: import('../electron/preload').IpcRendererAPI
}