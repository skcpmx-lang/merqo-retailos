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
    customer: {
      create: (payload: any) => Promise<any>;
      update: (payload: { id: string; data: any }) => Promise<any>;
      get: (id: string) => Promise<any>;
      list: (businessId: string) => Promise<any>;
      search: (payload: { businessId: string; query: string; includeInactive?: boolean }) => Promise<any>;
      deactivate: (id: string) => Promise<any>;
      activate: (id: string) => Promise<any>;
      delete: (id: string) => Promise<any>;
      statement: (payload: { customerId: string; fromDate?: number; toDate?: number }) => Promise<any>;
      transactions: (payload: { customerId: string; limit?: number }) => Promise<any>;
      collect: (payload: any) => Promise<any>;
    };
    sale: {
      create: (payload: any) => Promise<any>;
      get: (id: string) => Promise<any>;
      list: (payload: { businessId: string; filters?: any; limit?: number; offset?: number }) => Promise<any>;
      cancel: (payload: { id: string; reason: string }) => Promise<any>;
      returnCreate: (payload: any) => Promise<any>;
      returnList: (saleId: string) => Promise<any>;
    };
    finance: {
      cashAccounts: (businessId: string) => Promise<any>;
      cashAccountCreate: (payload: any) => Promise<any>;
      cashAccountGet: (id: string) => Promise<any>;
      cashAccountUpdate: (payload: { id: string; data: any; businessId: string }) => Promise<any>;
      cashAccountDeactivate: (payload: { id: string; businessId: string }) => Promise<any>;
      cashAccountStatement: (payload: { accountId: string; fromDate?: number; toDate?: number }) => Promise<any>;
      cashAccountBalance: (accountId: string) => Promise<any>;
      cashMovements: (payload: { businessId: string; limit?: number; offset?: number; filters?: any }) => Promise<any>;
      bankAccounts: (businessId: string) => Promise<any>;
      bankAccountCreate: (payload: any) => Promise<any>;
      bankAccountGet: (id: string) => Promise<any>;
      bankAccountUpdate: (payload: { id: string; data: any }) => Promise<any>;
      bankAccountDeactivate: (id: string) => Promise<any>;
      bankAccountStatement: (payload: { accountId: string; fromDate?: number; toDate?: number }) => Promise<any>;
      bankAccountBalance: (accountId: string) => Promise<any>;
      bankTransactions: (payload: { businessId: string; limit?: number; offset?: number; filters?: any }) => Promise<any>;
      mfsAccounts: (businessId: string) => Promise<any>;
      mfsAccountCreate: (payload: any) => Promise<any>;
      mfsAccountGet: (id: string) => Promise<any>;
      mfsAccountUpdate: (payload: { id: string; data: any }) => Promise<any>;
      mfsAccountDeactivate: (id: string) => Promise<any>;
      mfsAccountStatement: (payload: { accountId: string; fromDate?: number; toDate?: number }) => Promise<any>;
      mfsAccountBalance: (accountId: string) => Promise<any>;
      mfsProviders: () => Promise<any>;
      mfsTransactions: (payload: { businessId: string; limit?: number; offset?: number; filters?: any }) => Promise<any>;
      mfsCashIn: (payload: any) => Promise<any>;
      mfsCashOut: (payload: any) => Promise<any>;
      cashTransfer: (payload: any) => Promise<any>;
      transfers: (businessId: string) => Promise<any>;
      expenseCategories: (businessId: string) => Promise<any>;
      expenseCreate: (payload: any) => Promise<any>;
      expenses: (payload: { businessId: string; limit?: number; offset?: number; filters?: any }) => Promise<any>;
      expenseGet: (id: string) => Promise<any>;
      expenseVoid: (payload: { id: string; reason: string; businessId: string }) => Promise<any>;
      dashboard: (businessId: string) => Promise<any>;
      reconcile: (payload: { businessId: string; accountId: string; accountType: string }) => Promise<any>;
    };
    shift: {
      open: (payload: any) => Promise<any>;
      list: (businessId: string) => Promise<any>;
      get: (id: string) => Promise<any>;
      current: (businessId: string) => Promise<any>;
      close: (payload: { shiftId: string; actualCashPaisa: number; notes?: string }) => Promise<any>;
      reconciliation: (shiftId: string) => Promise<any>;
    };
    product: {
      search: (payload: { businessId: string; query: string }) => Promise<any>;
      get: (id: string) => Promise<any>;
    };
    unit: {
      list: (businessId: string) => Promise<any>;
      conversions: (businessId: string) => Promise<any>;
    };
    pos: {
      productByBarcode: (payload: { businessId: string; barcode: string }) => Promise<any>;
      productSearch: (payload: { businessId: string; query: string; limit?: number }) => Promise<any>;
      stockLevel: (payload: { productId: string }) => Promise<any>;
      holdSale: (payload: any) => Promise<any>;
      heldSalesList: (businessId: string) => Promise<any>;
      heldSaleGet: (id: string) => Promise<any>;
      heldSaleCancel: (id: string) => Promise<any>;
      heldSaleResume: (id: string) => Promise<any>;
      currentShift: (businessId: string) => Promise<any>;
    };
    invoke: (channel: string, payload?: unknown) => Promise<any>;
  };
}
