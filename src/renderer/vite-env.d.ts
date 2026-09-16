/// <reference types="vite/client" />

interface Window {
  merqo: {
    app: {
      getInfo: () => Promise<any>;
      getVersion: () => Promise<any>;
      getPaths: () => Promise<any>;
    };
    db: {
      getStatus: () => Promise<any>;
      checkIntegrity: () => Promise<any>;
      isFirstLaunch: () => Promise<any>;
    };
    auth: {
      login: (payload: { phone: string; password: string }) => Promise<any>;
      loginWithPin: (payload: { phone: string; pin: string }) => Promise<any>;
      logout: () => Promise<any>;
      getSession: () => Promise<any>;
      verifyPassword: (payload: { password: string }) => Promise<any>;
    };
    business: {
      get: () => Promise<any>;
    };
    settings: {
      get: (key: string) => Promise<any>;
      getAll: () => Promise<any>;
      set: (key: string, value: unknown) => Promise<any>;
    };
    system: {
      getConfig: () => Promise<any>;
    };
    hardware: {
      getPrinters: () => Promise<any>;
      testPrinter: (id: string) => Promise<any>;
    };
    invoke: (channel: string, payload?: unknown) => Promise<any>;
  };
}
