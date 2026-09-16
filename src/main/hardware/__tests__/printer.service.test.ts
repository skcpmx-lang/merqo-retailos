import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DEFAULT_PRINTER_CONFIG, DEFAULT_SCANNER_CONFIG } from '../printer.types';

// Mock Electron before importing PrinterService
vi.mock('electron', () => ({
  BrowserWindow: class {
    static getAllWindows() { return []; }
    constructor() {}
    webContents = {
      getPrintersAsync: async () => [],
      print: (_opts: any, cb: any) => cb(true, null),
    };
    loadURL = async () => {};
    close = () => {};
  },
  app: {
    getVersion: () => '0.1.0',
    getPath: (name: string) => `/tmp/${name}`,
  },
}));

// Mock logger to avoid file system
vi.mock('../../logging/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    ipcRequest: vi.fn(),
    ipcResponse: vi.fn(),
  },
}));

import { getTestDb, seedBusiness } from '../../db/__tests__/test-helpers';
import { PrinterService } from '../printer.service';
import { getConnection as originalGetConnection } from '../../db/connection';
import { ProductRepository } from '../../db/repositories/product.repository';
import { StockLevelRepository } from '../../db/repositories/inventory.repository';
import { SaleService } from '../../services/sale.service';
import { CashAccountRepository } from '../../db/repositories/finance.repository';
import { UnitRepository } from '../../db/repositories/unit.repository';

// We will override getConnection via vi.mock for connection module
vi.mock('../../db/connection', async () => {
  const actual = await vi.importActual('../../db/connection') as any;
  return {
    ...actual,
    getConnection: vi.fn(),
  };
});

import { getConnection } from '../../db/connection';

describe('Printer Service — P4.2', () => {
  let db: any;
  const businessId = 'biz_printer_p42';

  beforeEach(() => {
    db = getTestDb();
    seedBusiness(db, businessId);
    (getConnection as any).mockReturnValue(db);
  });

  afterEach(() => {
    try { db.close(); } catch {}
    vi.clearAllMocks();
    (getConnection as any).mockReturnValue(db);
  });

  it('should have sensible default printer config', () => {
    expect(DEFAULT_PRINTER_CONFIG.paperWidth).toBe('80mm');
    expect(DEFAULT_PRINTER_CONFIG.copies).toBe(1);
    expect(DEFAULT_PRINTER_CONFIG.receiptFooter).toContain('ধন্যবাদ');
    expect(DEFAULT_PRINTER_CONFIG.showCustomer).toBe(true);
  });

  it('should have sensible default scanner config', () => {
    expect(DEFAULT_SCANNER_CONFIG.enabled).toBe(true);
    expect(DEFAULT_SCANNER_CONFIG.suffix).toBe('Enter');
    expect(DEFAULT_SCANNER_CONFIG.minLength).toBe(3);
    expect(DEFAULT_SCANNER_CONFIG.charThresholdMs).toBe(50);
    expect(DEFAULT_SCANNER_CONFIG.scanTimeoutMs).toBe(150);
  });

  it('should save and load printer config via system_settings', () => {
    const service = PrinterService.getInstance();

    const saved = service.savePrinterConfiguration({
      selectedPrinterId: 'test_printer_id',
      selectedPrinterName: 'Test Printer 80mm',
      paperWidth: '80mm',
      copies: 2,
      receiptFooter: 'Test Footer',
    });

    expect(saved.selectedPrinterId).toBe('test_printer_id');
    expect(saved.paperWidth).toBe('80mm');
    expect(saved.copies).toBe(2);

    const loaded = service.getConfiguredPrinter();
    expect(loaded.selectedPrinterId).toBe('test_printer_id');
    expect(loaded.selectedPrinterName).toBe('Test Printer 80mm');
  });

  it('should validate printer config — invalid paper width', () => {
    const service = PrinterService.getInstance();
    expect(() => {
      service.savePrinterConfiguration({ paperWidth: 'INVALID' as any });
    }).toThrow();
  });

  it('should validate printer config — copies 1-10', () => {
    const service = PrinterService.getInstance();

    expect(() => {
      service.savePrinterConfiguration({ copies: 0 });
    }).toThrow();

    expect(() => {
      service.savePrinterConfiguration({ copies: 11 });
    }).toThrow();

    const saved = service.savePrinterConfiguration({ copies: 2 });
    expect(saved.copies).toBe(2);
  });

  it('should save and load scanner config', () => {
    const service = PrinterService.getInstance();

    const saved = service.saveScannerConfig({
      enabled: true,
      minLength: 4,
      suffix: 'Tab',
      charThresholdMs: 60,
      scanTimeoutMs: 200,
    });

    expect(saved.minLength).toBe(4);
    expect(saved.suffix).toBe('Tab');
    expect(saved.charThresholdMs).toBe(60);

    const loaded = service.getScannerConfig();
    expect(loaded.suffix).toBe('Tab');
    expect(loaded.minLength).toBe(4);
  });

  it('should validate scanner config', () => {
    const service = PrinterService.getInstance();

    expect(() => service.saveScannerConfig({ minLength: 0 })).toThrow();
    expect(() => service.saveScannerConfig({ maxLength: 200 })).toThrow();
    expect(() => service.saveScannerConfig({ suffix: 'Invalid' as any })).toThrow();
  });

  it('should map electron printer correctly — empty list in mocked env', async () => {
    const service = PrinterService.getInstance();
    const printers = await service.listPrinters();
    expect(Array.isArray(printers)).toBe(true);
    expect(printers.length).toBe(0);
  });

  it('should handle missing printer — Bengali error', async () => {
    const service = PrinterService.getInstance();
    const status = await service.getPrinterStatus('nonexistent_printer_xyz');
    expect(status.isAvailable).toBe(false);
    expect(status.messageBn).toContain('প্রিন্টার পাওয়া যায়নি');
  });

  it('should ensure printing does NOT create duplicate sale/payment/stock', async () => {
    const productRepo = new ProductRepository(db);
    const stockRepo = new StockLevelRepository(db);
    const saleService = new SaleService(db);
    const unitRepo = new UnitRepository(db);

    let unit = db.prepare('SELECT id FROM units LIMIT 1').get() as any;
    let unitId: string;
    if (unit) {
      unitId = unit.id;
    } else {
      const u = unitRepo.create({ businessId, name: 'Piece', shortName: 'pcs', isBaseUnit: true, unitGroup: 'piece', isActive: true } as any);
      unitId = u.id;
    }

    const product = productRepo.create({
      businessId,
      baseUnitId: unitId,
      name: 'চাল Test',
      sku: 'RICE-TEST-001',
      barcode: '1234567890123',
      costPricePaisa: 5000,
      sellingPricePaisa: 8500,
      isStockTrackable: true,
      isSellable: true,
      isActive: true,
      minStockMilli: 0,
      reorderLevelMilli: 0,
      openingStockMilli: 0,
      taxRate: 0,
    } as any);

    db.prepare(`INSERT INTO stock_movements (id, business_id, product_id, movement_type, quantity_milli, cost_paisa, reference_type, reference_id, location_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      'mov1', businessId, product.id, 'purchase', 100000, 5000, 'test', 'ref1', 'main', Date.now()
    );
    db.prepare(`INSERT INTO stock_levels (id, business_id, product_id, location_id, quantity_milli, reserved_milli, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
      'sl1', businessId, product.id, 'main', 100000, 0, Date.now()
    );

    const cashRepo = new CashAccountRepository(db);
    const cashAccount = cashRepo.create({
      businessId,
      name: 'Main Cash',
      openingBalancePaisa: 1000000,
      currentBalancePaisa: 1000000,
      isActive: true,
    } as any);

    const sale = saleService.create({
      businessId,
      items: [{ productId: product.id, unitId, quantityMilli: 2000, unitPricePaisa: 8500, discountPaisa: 0 }],
      discountPaisa: 0,
      taxPaisa: 0,
      shippingPaisa: 0,
      paidPaisa: 17000,
      payments: [{ method: 'cash', amountPaisa: 17000, cashAccountId: cashAccount.id }],
      createdBy: 'test_user',
    });

    const saleCountBefore = (db.prepare('SELECT COUNT(*) as c FROM sales').get() as any).c;
    const paymentCountBefore = (db.prepare('SELECT COUNT(*) as c FROM sale_payments').get() as any).c;
    const stockMovementCountBefore = (db.prepare('SELECT COUNT(*) as c FROM stock_movements').get() as any).c;
    const stockLevelBefore = stockRepo.findByProductAndLocation(product.id, 'main')?.quantityMilli;
    const customerTxCountBefore = (db.prepare('SELECT COUNT(*) as c FROM customer_transactions').get() as any).c;

    const service = PrinterService.getInstance();

    // Mock printHtml to avoid Electron
    const originalPrintHtml = (service as any).printHtml;
    (service as any).printHtml = async () => ({
      success: true,
      message: 'Mock print success',
      messageBn: 'প্রিন্ট সফল',
      timestamp: Date.now(),
    });

    const result = await service.printReceipt(sale.id, { paperWidth: '80mm', silent: true });

    expect(result.success).toBe(true);

    const saleCountAfter = (db.prepare('SELECT COUNT(*) as c FROM sales').get() as any).c;
    const paymentCountAfter = (db.prepare('SELECT COUNT(*) as c FROM sale_payments').get() as any).c;
    const stockMovementCountAfter = (db.prepare('SELECT COUNT(*) as c FROM stock_movements').get() as any).c;
    const stockLevelAfter = stockRepo.findByProductAndLocation(product.id, 'main')?.quantityMilli;
    const customerTxCountAfter = (db.prepare('SELECT COUNT(*) as c FROM customer_transactions').get() as any).c;

    expect(saleCountAfter).toBe(saleCountBefore);
    expect(paymentCountAfter).toBe(paymentCountBefore);
    expect(stockMovementCountAfter).toBe(stockMovementCountBefore);
    expect(stockLevelAfter).toBe(stockLevelBefore);
    expect(customerTxCountAfter).toBe(customerTxCountBefore);

    const auditCount = (db.prepare("SELECT COUNT(*) as c FROM audit_logs WHERE action LIKE '%print%'").get() as any).c;
    expect(auditCount).toBeGreaterThanOrEqual(1);

    const reprintResult = await service.reprintReceipt(sale.id, { paperWidth: '80mm', silent: true });
    expect(reprintResult.success).toBe(true);

    const saleCountAfterReprint = (db.prepare('SELECT COUNT(*) as c FROM sales').get() as any).c;
    expect(saleCountAfterReprint).toBe(saleCountBefore);

    (service as any).printHtml = originalPrintHtml;
  });

  it('should handle print failure — sale remains valid, no rollback', async () => {
    const service = PrinterService.getInstance();

    const originalPrintHtml = (service as any).printHtml;
    (service as any).printHtml = async () => ({
      success: false,
      message: 'Printer offline',
      messageBn: 'প্রিন্টার অফলাইন। প্রিন্টার চালু করুন।',
      timestamp: Date.now(),
    });

    const productRepo = new ProductRepository(db);
    const unitRepo = new UnitRepository(db);
    let unit = db.prepare('SELECT id FROM units LIMIT 1').get() as any;
    let unitId: string;
    if (unit) {
      unitId = unit.id;
    } else {
      const u = unitRepo.create({ businessId, name: 'Piece', shortName: 'pcs', isBaseUnit: true, unitGroup: 'piece', isActive: true } as any);
      unitId = u.id;
    }

    const product = productRepo.create({
      businessId,
      baseUnitId: unitId,
      name: 'Test Product Fail',
      sku: 'FAIL-001',
      barcode: 'FAIL123',
      costPricePaisa: 1000,
      sellingPricePaisa: 2000,
      isStockTrackable: false,
      isSellable: true,
      isActive: true,
      minStockMilli: 0,
      reorderLevelMilli: 0,
      openingStockMilli: 0,
      taxRate: 0,
    } as any);

    const saleService = new SaleService(db);
    const sale = saleService.create({
      businessId,
      items: [{ productId: product.id, unitId, quantityMilli: 1000, unitPricePaisa: 2000, discountPaisa: 0 }],
      discountPaisa: 0,
      taxPaisa: 0,
      shippingPaisa: 0,
      paidPaisa: 2000,
      payments: [{ method: 'cash', amountPaisa: 2000 }],
      createdBy: 'test_user',
    });

    const result = await service.printReceipt(sale.id, { paperWidth: '80mm' });
    expect(result.success).toBe(false);
    expect(result.messageBn).toContain('প্রিন্টার');

    const saleAfter = db.prepare('SELECT * FROM sales WHERE id = ?').get(sale.id) as any;
    expect(saleAfter).toBeTruthy();
    expect(saleAfter.total_paisa).toBe(2000);

    (service as any).printHtml = originalPrintHtml;
  });

  it('should get diagnostics without fake data', async () => {
    const service = PrinterService.getInstance();
    const diag = await service.getDiagnostics();
    expect(diag.printersDetected).toBe(0);
    expect(diag.systemInfo.platform).toBeTruthy();
    expect(diag.systemInfo.appVersion).toBe('0.1.0');
    expect(diag.printerConfig).toBeTruthy();
    expect(diag.scannerConfig).toBeTruthy();
    expect(diag.timestamp).toBeGreaterThan(0);
  });
});
