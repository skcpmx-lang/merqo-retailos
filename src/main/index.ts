/**
 * MERQO RetailOS — Main Process Entry
 * Production-safe Electron configuration
 */

import { app, BrowserWindow, shell, dialog } from 'electron';
import path from 'path';
import { getConfigManager } from './config';
import { logger } from './logging/logger';
import { createConnection, closeConnection, getConnection } from './db/connection';
import { Migrator } from './db/migrator';
import { registerIpcHandlers, unregisterIpcHandlers } from './ipc/handlers';
import { HashingService } from './security/hashing';

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

let mainWindow: BrowserWindow | null = null;

async function initializeDatabase() {
  logger.info('Initializing database...');

  try {
    const db = createConnection();
    const migrator = new Migrator(db);
    const result = migrator.initialize();

    if (!result.success) {
      logger.error('Database initialization failed', undefined, { error: result.error });
      dialog.showErrorBox(
        'ডাটাবেস ত্রুটি',
        `ডাটাবেস চালু করতে সমস্যা হয়েছে।\n\n${result.error}\n\nসাপোর্ট: merqoonline@gmail.com`
      );
      app.quit();
      return false;
    }

    logger.info(`Database initialized. First launch: ${result.isFirstLaunch}`, {
      isFirstLaunch: result.isFirstLaunch,
      migrations: result.executedMigrations,
    });

    return true;
  } catch (e) {
    logger.error('Database initialization exception', e);
    dialog.showErrorBox(
      'ডাটাবেস ত্রুটি',
      `ডাটাবেস চালু করতে সমস্যা হয়েছে।\n\n${String(e)}\n\nসাপোর্ট: merqoonline@gmail.com`
    );
    app.quit();
    return false;
  }
}

function createMainWindow() {
  const config = getConfigManager().getAppConfig();
  const userSettings = getConfigManager().getUserSettings();

  mainWindow = new BrowserWindow({
    width: config.defaultWindowWidth,
    height: config.defaultWindowHeight,
    minWidth: config.minWindowWidth,
    minHeight: config.minWindowHeight,
    show: false,
    backgroundColor: '#F8F9FB',
    title: config.appName,
    icon: path.join(__dirname, '../../resources/icons/icon.png'),
    webPreferences: {
      // Security: contextIsolation true, nodeIntegration false
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Need false for preload with better-sqlite3? Actually preload can be sandboxed but we use contextBridge
      // For Phase 1, sandbox false to allow preload, but we will enable sandbox later if compatible
      // preload must be CommonJS
      preload: path.join(__dirname, '../../preload/index.js'),
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
    },
  });

  // CSP via header
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; connect-src 'self';",
        ],
      },
    });
  });

  // Navigation restrictions
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // Only allow app URLs (file:// and http://localhost for dev)
    const allowedProtocols = ['file:', 'http:', 'https:'];
    const parsed = new URL(url);
    if (!allowedProtocols.includes(parsed.protocol)) {
      event.preventDefault();
      logger.warn('Blocked navigation to disallowed protocol', { url });
      return;
    }

    // In production, only allow file://
    if (config.isProd && parsed.protocol !== 'file:') {
      event.preventDefault();
      logger.warn('Blocked navigation in production', { url });
    }

    // Allow localhost in dev for Vite
    if (config.isDev && (url.includes('localhost:5173') || url.startsWith('file:'))) {
      return;
    }

    if (config.isProd && !url.startsWith('file:')) {
      event.preventDefault();
    }
  });

  // External URL handling — open in external browser, not in app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Only allow https for external
    if (url.startsWith('https://')) {
      shell.openExternal(url);
    } else {
      logger.warn('Blocked window.open to non-https', { url });
    }
    return { action: 'deny' };
  });

  // Prevent new windows
  mainWindow.webContents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });

  // Load renderer
  if (config.isDev) {
    // Dev: load from Vite dev server
    mainWindow.loadURL('http://localhost:5173').catch(e => {
      logger.error('Failed to load dev URL, falling back to file', e);
      mainWindow?.loadFile(path.join(__dirname, '../../renderer/index.html'));
    });
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // Prod: load from dist
    const rendererPath = path.join(__dirname, '../../renderer/index.html');
    mainWindow.loadFile(rendererPath);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    logger.info('Main window ready');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Save window size on close
  mainWindow.on('close', () => {
    // Could save window bounds to config
  });
}

app.whenReady().then(async () => {
  logger.info('App starting...', { version: app.getVersion(), isPackaged: app.isPackaged });

  // Initialize config
  getConfigManager();

  // Initialize hashing
  await HashingService.init();

  // Initialize database
  const dbOk = await initializeDatabase();
  if (!dbOk) return;

  // Register IPC handlers
  registerIpcHandlers();

  // Create window
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  logger.info('App quitting...');
  unregisterIpcHandlers();
  closeConnection();
});

app.on('quit', () => {
  closeConnection();
});

// Security: prevent remote module, etc.
// No additional setup needed for Electron 30+ as remote is removed

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  dialog.showErrorBox(
    'অপ্রত্যাশিত ত্রুটি',
    `একটি অপ্রত্যাশিত সমস্যা হয়েছে।\n\n${error.message}\n\nঅ্যাপটি বন্ধ করা হবে। সাপোর্ট: merqoonline@gmail.com`
  );
  app.quit();
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', reason as Error);
});
