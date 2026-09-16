/**
 * Typed IPC client for renderer
 * Uses window.merqo exposed via preload
 */

import type { IpcResponse } from '@shared/ipc/contracts';

export class IpcClient {
  private get api() {
    if (typeof window === 'undefined' || !window.merqo) {
      throw new Error('window.merqo not available — preload bridge not initialized');
    }
    return window.merqo;
  }

  async invoke<T>(channel: string, payload?: unknown): Promise<T> {
    const response = (await this.api.invoke(channel as any, payload)) as IpcResponse<T>;
    if (!response.success) {
      const error = new Error(response.error?.message || 'IPC failed');
      (error as any).code = response.error?.code;
      (error as any).messageBn = response.error?.messageBn;
      (error as any).correlationId = response.error?.correlationId;
      throw error;
    }
    return response.data as T;
  }

  // Typed shortcuts
  app = {
    getInfo: () => this.api.app.getInfo() as Promise<IpcResponse>,
    getVersion: () => this.api.app.getVersion() as Promise<IpcResponse>,
    getPaths: () => this.api.app.getPaths() as Promise<IpcResponse>,
  };

  db = {
    getStatus: () => this.api.db.getStatus() as Promise<IpcResponse>,
    checkIntegrity: () => this.api.db.checkIntegrity() as Promise<IpcResponse>,
    isFirstLaunch: () => this.api.db.isFirstLaunch() as Promise<IpcResponse>,
  };

  auth = {
    login: (phone: string, password: string) => this.api.auth.login({ phone, password }) as Promise<IpcResponse>,
    logout: () => this.api.auth.logout() as Promise<IpcResponse>,
    getSession: () => this.api.auth.getSession() as Promise<IpcResponse>,
  };

  business = {
    get: () => this.api.business.get() as Promise<IpcResponse>,
  };

  settings = {
    get: (key: string) => this.api.settings.get(key) as Promise<IpcResponse>,
    getAll: () => this.api.settings.getAll() as Promise<IpcResponse>,
    set: (key: string, value: unknown) => this.api.settings.set(key, value) as Promise<IpcResponse>,
  };

  system = {
    getConfig: () => this.api.system.getConfig() as Promise<IpcResponse>,
  };
}

export const ipcClient = new IpcClient();
