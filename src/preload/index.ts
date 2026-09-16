/**
 * Preload bridge — secure, restrictive IPC surface
 * Renderer must not receive unrestricted Node.js access
 */

import { contextBridge, ipcRenderer } from 'electron';
import { ALLOWED_IPC_CHANNELS, type IpcChannel } from '../shared/ipc/contracts';

// Type-safe IPC invoke
async function invoke(channel: IpcChannel, payload?: unknown) {
  if (!ALLOWED_IPC_CHANNELS.includes(channel)) {
    throw new Error(`Blocked IPC channel: ${channel}`);
  }
  return ipcRenderer.invoke(channel, payload);
}

// Expose only allowlisted, typed API to renderer
const merqoAPI = {
  // App
  app: {
    getInfo: () => invoke('app:getInfo'),
    getVersion: () => invoke('app:getVersion'),
    getPaths: () => invoke('app:getPaths'),
  },

  // DB
  db: {
    getStatus: () => invoke('db:getStatus'),
    checkIntegrity: () => invoke('db:checkIntegrity'),
    isFirstLaunch: () => invoke('db:isFirstLaunch'),
  },

  // Auth
  auth: {
    login: (payload: { phone: string; password: string }) => invoke('auth:login', payload),
    loginWithPin: (payload: { phone: string; pin: string }) => invoke('auth:loginWithPin', payload),
    logout: () => invoke('auth:logout'),
    getSession: () => invoke('auth:getSession'),
    verifyPassword: (payload: { password: string }) => invoke('auth:verifyPassword', payload),
  },

  // Business
  business: {
    get: () => invoke('business:get'),
  },

  // Settings
  settings: {
    get: (key: string) => invoke('settings:get', { key }),
    getAll: () => invoke('settings:getAll'),
    set: (key: string, value: unknown) => invoke('settings:set', { key, value }),
  },

  // System
  system: {
    getConfig: () => invoke('system:getConfig'),
  },

  // Hardware (future, but expose now for diagnostics)
  hardware: {
    getPrinters: () => invoke('hardware:getPrinters'),
    testPrinter: (id: string) => invoke('hardware:testPrinter', { id }),
  },

  // Generic invoke with validation (for internal use, but still allowlisted)
  invoke: (channel: IpcChannel, payload?: unknown) => invoke(channel, payload),
};

// Security: only expose merqoAPI, no raw ipcRenderer, no Node.js
contextBridge.exposeInMainWorld('merqo', merqoAPI);

// Type for renderer
declare global {
  interface Window {
    merqo: typeof merqoAPI;
  }
}

console.log('Preload bridge initialized — secure IPC surface ready');
