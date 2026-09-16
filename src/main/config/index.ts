/**
 * Centralized configuration system
 * Separate: app config, business config, user settings, hardware settings, env
 */

import path from 'path';
import fs from 'fs';

let app: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const electron = require('electron');
  app = electron.app;
} catch {
  // Mock for tests or when electron not available
  app = {
    getPath: (name: string) => {
      if (name === 'userData') return path.join(process.cwd(), 'app-data-test');
      return process.cwd();
    },
    getVersion: () => '0.1.0',
    isPackaged: false,
  };
}

export interface AppConfig {
  appName: string;
  version: string;
  isDev: boolean;
  isProd: boolean;
  userDataPath: string;
  logsPath: string;
  backupsPath: string;
  dbPath: string;
  configPath: string;
  minWindowWidth: number;
  minWindowHeight: number;
  defaultWindowWidth: number;
  defaultWindowHeight: number;
}

export interface BusinessConfig {
  currency: string;
  lowStockThreshold: number;
  allowNegativeStock: boolean;
  autoBackupEnabled: boolean;
  autoBackupKeepDays: number;
  defaultPrinterId?: string;
  receiptFooter?: string;
}

export interface UserSettings {
  language: 'bn' | 'en';
  theme: 'light';
  sidebarCollapsed: boolean;
  posShortcuts: Record<string, string>;
}

class ConfigManager {
  private appConfig: AppConfig;
  private userSettings: UserSettings;
  private businessConfig: BusinessConfig;
  private configFilePath: string;

  constructor() {
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
    const userDataPath = app ? app.getPath('userData') : path.join(process.cwd(), 'app-data');

    this.appConfig = {
      appName: 'MERQO RetailOS',
      version: app ? app.getVersion() : '0.1.0',
      isDev,
      isProd: !isDev,
      userDataPath,
      logsPath: path.join(userDataPath, 'logs'),
      backupsPath: path.join(userDataPath, 'backups'),
      dbPath: path.join(userDataPath, 'merqo.db'),
      configPath: path.join(userDataPath, 'config.json'),
      minWindowWidth: 1280,
      minWindowHeight: 720,
      defaultWindowWidth: 1366,
      defaultWindowHeight: 768,
    };

    this.configFilePath = this.appConfig.configPath;

    this.userSettings = {
      language: 'bn',
      theme: 'light',
      sidebarCollapsed: false,
      posShortcuts: {
        focusSearch: 'F2',
        customerSearch: 'F3',
        discount: 'F4',
        holdSale: 'F5',
        retrieveHeld: 'F6',
        clearCart: 'F7',
        payment: 'F8',
        quickAddProduct: 'F9',
        quickAddCustomer: 'F10',
        printLast: 'Ctrl+P',
        return: 'Ctrl+R',
      },
    };

    this.businessConfig = {
      currency: 'BDT',
      lowStockThreshold: 5,
      allowNegativeStock: false,
      autoBackupEnabled: true,
      autoBackupKeepDays: 7,
      receiptFooter: 'ধন্যবাদ, আবার আসবেন',
    };

    this.ensureDirectories();
    this.loadUserSettings();
  }

  private ensureDirectories() {
    try {
      fs.mkdirSync(this.appConfig.userDataPath, { recursive: true });
      fs.mkdirSync(this.appConfig.logsPath, { recursive: true });
      fs.mkdirSync(this.appConfig.backupsPath, { recursive: true });
    } catch (e) {
      console.error('Failed to create directories', e);
    }
  }

  private loadUserSettings() {
    try {
      if (fs.existsSync(this.configFilePath)) {
        const data = fs.readFileSync(this.configFilePath, 'utf-8');
        const parsed = JSON.parse(data);
        this.userSettings = { ...this.userSettings, ...parsed.userSettings };
        this.businessConfig = { ...this.businessConfig, ...parsed.businessConfig };
      }
    } catch (e) {
      console.warn('Failed to load config, using defaults', e);
    }
  }

  save() {
    try {
      const data = JSON.stringify(
        {
          userSettings: this.userSettings,
          businessConfig: this.businessConfig,
        },
        null,
        2
      );
      fs.writeFileSync(this.configFilePath, data, 'utf-8');
    } catch (e) {
      console.error('Failed to save config', e);
    }
  }

  getAppConfig(): AppConfig {
    return { ...this.appConfig };
  }

  getUserSettings(): UserSettings {
    return { ...this.userSettings };
  }

  getBusinessConfig(): BusinessConfig {
    return { ...this.businessConfig };
  }

  updateUserSettings(settings: Partial<UserSettings>) {
    this.userSettings = { ...this.userSettings, ...settings };
    this.save();
  }

  updateBusinessConfig(config: Partial<BusinessConfig>) {
    this.businessConfig = { ...this.businessConfig, ...config };
    this.save();
  }

  getDbPath(): string {
    return this.appConfig.dbPath;
  }
}

// Singleton, but lazy for testing (app may not be available in tests)
let configManagerInstance: ConfigManager | null = null;

export function getConfigManager(): ConfigManager {
  if (!configManagerInstance) {
    configManagerInstance = new ConfigManager();
  }
  return configManagerInstance;
}

export function resetConfigManager() {
  configManagerInstance = null;
}
