import '@testing-library/jest-dom';

// Mock window.merqo for renderer tests
if (typeof window !== 'undefined') {
  (window as any).merqo = {
    app: {
      getInfo: async () => ({ success: true, data: { name: 'MERQO RetailOS', version: '0.1.0', isDev: true, isFirstLaunch: true } }),
      getVersion: async () => ({ success: true, data: '0.1.0' }),
      getPaths: async () => ({ success: true, data: {} }),
    },
    db: {
      getStatus: async () => ({
        success: true,
        data: { isOpen: true, path: ':memory:', integrityOk: true, isFirstLaunch: true, tableCount: 8 },
      }),
      checkIntegrity: async () => ({ success: true, data: { ok: true, errors: [] } }),
      isFirstLaunch: async () => ({ success: true, data: { isFirstLaunch: true } }),
    },
    auth: {
      login: async () => ({ success: true, data: {} }),
      logout: async () => ({ success: true, data: {} }),
      getSession: async () => ({ success: true, data: { isLoggedIn: false } }),
    },
    business: {
      get: async () => ({ success: true, data: null }),
    },
    settings: {
      get: async () => ({ success: true, data: null }),
      getAll: async () => ({ success: true, data: [] }),
      set: async () => ({ success: true, data: {} }),
    },
    system: {
      getConfig: async () => ({ success: true, data: {} }),
    },
    hardware: {
      getPrinters: async () => ({ success: true, data: { printers: [] } }),
    },
    invoke: async () => ({ success: true, data: {} }),
  };
}
