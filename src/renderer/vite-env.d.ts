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
    supplier: {
      create: (payload: any) => Promise<any>;
      update: (payload: { id: string; data: any }) => Promise<any>;
      get: (id: string) => Promise<any>;
      list: (businessId: string) => Promise<any>;
      search: (payload: { businessId: string; query: string; includeInactive?: boolean }) => Promise<any>;
      deactivate: (id: string) => Promise<any>;
      delete: (id: string) => Promise<any>;
      statement: (payload: { supplierId: string; fromDate?: number; toDate?: number }) => Promise<any>;
      transactions: (payload: { supplierId: string; limit?: number }) => Promise<any>;
      pay: (payload: any) => Promise<any>;
    };
    purchase: {
      create: (payload: any) => Promise<any>;
      get: (id: string) => Promise<any>;
      list: (payload: { businessId: string; filters?: any; limit?: number; offset?: number }) => Promise<any>;
      cancel: (payload: { id: string; reason: string }) => Promise<any>;
      returnCreate: (payload: any) => Promise<any>;
      returnList: (purchaseId: string) => Promise<any>;
    };
    product: {
      search: (payload: { businessId: string; query: string }) => Promise<any>;
      get: (id: string) => Promise<any>;
    };
    unit: {
      list: (businessId: string) => Promise<any>;
      conversions: (businessId: string) => Promise<any>;
    };
    invoke: (channel: string, payload?: unknown) => Promise<any>;
  };
}
