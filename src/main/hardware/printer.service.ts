/**
 * Printer Service — P4.2 Hardware Integration
 * Main-process hardware service, clean abstraction behind IPC
 * Uses Electron getPrintersAsync() for Windows spooler discovery
 * No fake printers, no cloud, offline-first
 */

import { BrowserWindow, app } from 'electron';
import path from 'path';
import fs from 'fs';
import { getConnection } from '../db/connection';
import { getConfigManager } from '../config';
import { logger } from '../logging/logger';
import { Id } from '@core/domain/Id';
import { AppError } from '@core/domain/errors/AppError';
import type {
  PrinterInfo,
  PrinterConfig,
  PrintResult,
  PrinterStatusResult,
  ReceiptData,
  PaperWidth,
  PrintOptions,
  HardwareDiagnostics,
  ScannerConfig,
  PrinterStatusType,
} from './printer.types';
import { DEFAULT_PRINTER_CONFIG, DEFAULT_SCANNER_CONFIG } from './printer.types';
import { renderReceiptHtml, renderInvoiceA4Html, renderTestPageHtml } from './receipt-renderer';

let lastPrintResult: PrintResult | null = null;
let lastPrintError: string | null = null;

function sanitizePrinterName(name: string): string {
  // Prevent command injection — allow only safe chars, limit length
  // eslint-disable-next-line no-useless-escape
  return name.replace(/[^\w\s\-.\(\)\/\\:]/g, '').slice(0, 200);
}

function mapElectronPrinter(p: any): PrinterInfo {
  const name = String(p.name || p.displayName || 'Unknown').trim();
  return {
    id: Buffer.from(name).toString('base64').slice(0, 40), // stable id from name
    name,
    displayName: p.displayName || name,
    description: p.description || '',
    isDefault: !!p.isDefault,
    status: (p.status as PrinterStatusType) || 'unknown',
    options: p.options,
  };
}

export class PrinterService {
  private static instance: PrinterService | null = null;

  static getInstance(): PrinterService {
    if (!PrinterService.instance) {
      PrinterService.instance = new PrinterService();
    }
    return PrinterService.instance;
  }

  async listPrinters(): Promise<PrinterInfo[]> {
    try {
      // Try to get printers from any window, or create temporary
      let printers: any[] = [];
      const windows = BrowserWindow.getAllWindows();
      if (windows.length > 0) {
        try {
          printers = await windows[0].webContents.getPrintersAsync();
        } catch (e) {
          logger.warn('getPrintersAsync failed from existing window', { error: String(e) });
        }
      }

      if (printers.length === 0) {
        // Try creating hidden window for printer discovery (Windows)
        // This is safe, no network, offline
        try {
          const tempWin = new BrowserWindow({
            show: false,
            webPreferences: { contextIsolation: true, nodeIntegration: false },
          });
          printers = await tempWin.webContents.getPrintersAsync();
          tempWin.close();
        } catch (e) {
          logger.warn('getPrintersAsync failed from temp window', { error: String(e) });
          // Return empty list, not fake data
          return [];
        }
      }

      return printers.map(mapElectronPrinter);
    } catch (e) {
      logger.error('Failed to list printers', e);
      // Do not throw fake data, return empty
      return [];
    }
  }

  async getDefaultPrinter(): Promise<PrinterInfo | null> {
    const printers = await this.listPrinters();
    return printers.find(p => p.isDefault) || printers[0] || null;
  }

  getConfiguredPrinter(): PrinterConfig {
    try {
      const configManager = getConfigManager();
      const businessConfig = configManager.getBusinessConfig() as any;

      // Try system_settings table first
      try {
        const db = getConnection();
        const row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get('hardware_printer_config') as any;
        if (row?.value) {
          const parsed = JSON.parse(row.value);
          return { ...DEFAULT_PRINTER_CONFIG, ...parsed };
        }
      } catch {}

      // Fallback to businessConfig.defaultPrinterId
      if (businessConfig?.defaultPrinterId) {
        return {
          ...DEFAULT_PRINTER_CONFIG,
          selectedPrinterId: businessConfig.defaultPrinterId,
          selectedPrinterName: businessConfig.defaultPrinterId,
        };
      }

      return { ...DEFAULT_PRINTER_CONFIG };
    } catch {
      return { ...DEFAULT_PRINTER_CONFIG };
    }
  }

  savePrinterConfiguration(config: Partial<PrinterConfig>): PrinterConfig {
    const current = this.getConfiguredPrinter();
    const updated: PrinterConfig = {
      ...current,
      ...config,
      updatedAt: Date.now(),
    };

    // Validate paperWidth
    if (updated.paperWidth && !['58mm', '80mm', 'A4'].includes(updated.paperWidth)) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        message: 'Invalid paper width',
        messageBn: 'কাগজের প্রস্থ সঠিক নয়',
        statusCode: 400,
      });
    }

    // Validate printerId length
    if (updated.selectedPrinterId && updated.selectedPrinterId.length > 200) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        message: 'Printer ID too long',
        messageBn: 'প্রিন্টার আইডি অনেক বড়',
        statusCode: 400,
      });
    }

    if (updated.copies !== undefined && updated.copies !== null && (updated.copies < 1 || updated.copies > 10)) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        message: 'Copies must be 1-10',
        messageBn: 'কপি ১-১০ এর মধ্যে হতে হবে',
        statusCode: 400,
      });
    }

    try {
      const db = getConnection();
      db.prepare(
        `INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?`
      ).run(
        'hardware_printer_config',
        JSON.stringify(updated),
        Date.now(),
        JSON.stringify(updated),
        Date.now()
      );
    } catch (e) {
      logger.warn('Failed to save printer config to DB, saving to file config', { error: String(e) });
      // Fallback to file config
      try {
        const configManager = getConfigManager();
        configManager.updateBusinessConfig({
          defaultPrinterId: updated.selectedPrinterId || undefined,
          receiptFooter: updated.receiptFooter,
        } as any);
      } catch {}
    }

    return updated;
  }

  getScannerConfig(): ScannerConfig {
    try {
      const db = getConnection();
      const row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get('hardware_scanner_config') as any;
      if (row?.value) {
        const parsed = JSON.parse(row.value);
        return { ...DEFAULT_SCANNER_CONFIG, ...parsed };
      }
    } catch {}
    return { ...DEFAULT_SCANNER_CONFIG };
  }

  saveScannerConfig(config: Partial<ScannerConfig>): ScannerConfig {
    const current = this.getScannerConfig();
    const updated: ScannerConfig = {
      ...current,
      ...config,
      updatedAt: Date.now(),
    };

    // Validate
    if (updated.minLength < 1 || updated.minLength > 20) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        message: 'minLength invalid',
        messageBn: 'ন্যূনতম দৈর্ঘ্য সঠিক নয়',
        statusCode: 400,
      });
    }
    if (updated.maxLength < 4 || updated.maxLength > 128) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        message: 'maxLength invalid',
        messageBn: 'সর্বোচ্চ দৈর্ঘ্য সঠিক নয়',
        statusCode: 400,
      });
    }
    if (!['Enter', 'Tab', 'None'].includes(updated.suffix)) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        message: 'suffix invalid',
        messageBn: 'সাফিক্স সঠিক নয়',
        statusCode: 400,
      });
    }

    try {
      const db = getConnection();
      db.prepare(
        `INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?`
      ).run(
        'hardware_scanner_config',
        JSON.stringify(updated),
        Date.now(),
        JSON.stringify(updated),
        Date.now()
      );
    } catch (e) {
      logger.warn('Failed to save scanner config', { error: String(e) });
    }

    return updated;
  }

  async getPrinterStatus(printerIdOrName: string): Promise<PrinterStatusResult> {
    const sanitized = sanitizePrinterName(printerIdOrName);
    const printers = await this.listPrinters();

    // Try to find by id or name
    const found = printers.find(p => p.id === sanitized || p.name === sanitized || p.displayName === sanitized);

    if (!found) {
      return {
        printerId: sanitized,
        printerName: sanitized,
        status: 'offline',
        isAvailable: false,
        isDefault: false,
        message: 'Printer not found',
        messageBn: 'প্রিন্টার পাওয়া যায়নি। সংযোগ পরীক্ষা করুন।',
      };
    }

    return {
      printerId: found.id,
      printerName: found.name,
      status: found.status === 'unknown' ? 'online' : found.status,
      isAvailable: true,
      isDefault: found.isDefault,
      message: 'Printer available',
      messageBn: 'প্রিন্টার প্রস্তুত',
    };
  }

  private async getSaleData(saleId: string): Promise<ReceiptData> {
    const db = getConnection();

    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId) as any;
    if (!sale) {
      throw new AppError({
        code: 'NOT_FOUND',
        message: 'Sale not found',
        messageBn: 'বিক্রয় পাওয়া যায়নি',
        statusCode: 404,
      });
    }

    const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ? ORDER BY created_at ASC, rowid ASC').all(saleId) as any[];

    const business = db.prepare('SELECT * FROM businesses LIMIT 1').get() as any;

    let customer: any = null;
    if (sale.customer_id) {
      customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(sale.customer_id) as any;
    }

    const payments = db.prepare('SELECT * FROM sale_payments WHERE sale_id = ?').all(saleId) as any[];

    // Map items to receipt format
    const receiptItems = items.map((it: any) => ({
      productName: it.product_name_snapshot || it.product_name || 'পণ্য',
      quantity: it.quantity_milli ? it.quantity_milli / 1000 : it.quantity || 1,
      quantityMilli: it.quantity_milli || Math.round((it.quantity || 1) * 1000),
      unitShortName: it.unit_short_name || it.unit_name || 'pcs',
      unitPricePaisa: it.unit_price_paisa,
      lineTotalPaisa: it.line_total_paisa,
      discountPaisa: it.discount_paisa || 0,
    }));

    // Get cashier name if possible
    let cashier: string | null = null;
    if (sale.created_by) {
      try {
        const user = db.prepare('SELECT name FROM users WHERE id = ?').get(sale.created_by) as any;
        cashier = user?.name || null;
      } catch {}
    }

    const changePaisa = sale.paid_paisa > sale.total_paisa ? sale.paid_paisa - sale.total_paisa : 0;

    return {
      sale: {
        id: sale.id,
        saleNumber: sale.sale_number,
        saleDate: sale.sale_date || sale.created_at,
        subtotalPaisa: sale.subtotal_paisa,
        discountPaisa: sale.discount_paisa,
        taxPaisa: sale.tax_paisa,
        totalPaisa: sale.total_paisa,
        paidPaisa: sale.paid_paisa,
        duePaisa: sale.due_paisa,
        notes: sale.notes,
      },
      items: receiptItems,
      business,
      customer: customer ? { name: customer.name, phone: customer.phone } : null,
      payments: payments.map((p: any) => ({
        method: p.payment_method || p.method || 'cash',
        amountPaisa: p.amount_paisa,
      })),
      cashier,
      changePaisa,
    };
  }

  private async printHtml(html: string, options: PrintOptions): Promise<PrintResult> {
    const printerName = options.printerName ? sanitizePrinterName(options.printerName) : undefined;
    const copies = options.copies && options.copies >= 1 && options.copies <= 10 ? options.copies : 1;

    return new Promise<PrintResult>((resolve) => {
      try {
        const printWin = new BrowserWindow({
          show: false,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
          },
        });

        const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;

        printWin.loadURL(dataUrl).then(() => {
          // Wait a bit for fonts to load
          setTimeout(() => {
            const printOptions: Electron.WebContentsPrintOptions = {
              silent: options.silent !== false, // default silent true
              printBackground: true,
              copies,
            };
            if (printerName) {
              (printOptions as any).deviceName = printerName;
            }

            // For A4, specify margins
            if (options.paperWidth === 'A4') {
              (printOptions as any).margins = { marginType: 'none' };
            }

            printWin.webContents.print(printOptions, (success, failureReason) => {
              try {
                printWin.close();
              } catch {}

              if (success) {
                const result: PrintResult = {
                  success: true,
                  jobId: Id.generate(),
                  message: 'Print successful',
                  messageBn: 'প্রিন্ট সফল হয়েছে',
                  printerName,
                  timestamp: Date.now(),
                };
                lastPrintResult = result;
                lastPrintError = null;
                resolve(result);
              } else {
                const errMsg = failureReason || 'Print failed';
                lastPrintError = errMsg;
                const result: PrintResult = {
                  success: false,
                  message: errMsg,
                  messageBn: this.mapPrintErrorToBn(errMsg),
                  printerName,
                  timestamp: Date.now(),
                };
                lastPrintResult = result;
                resolve(result);
              }
            });
          }, 500);
        }).catch((e) => {
          try {
            printWin.close();
          } catch {}
          lastPrintError = String(e);
          resolve({
            success: false,
            message: String(e),
            messageBn: 'প্রিন্ট করা যায়নি। প্রিন্টার পরীক্ষা করে আবার চেষ্টা করুন।',
            printerName,
            timestamp: Date.now(),
          });
        });
      } catch (e) {
        lastPrintError = String(e);
        resolve({
          success: false,
          message: String(e),
          messageBn: 'প্রিন্ট করা যায়নি। প্রিন্টার পরীক্ষা করে আবার চেষ্টা করুন।',
          printerName,
          timestamp: Date.now(),
        });
      }
    });
  }

  private mapPrintErrorToBn(error: string): string {
    const lower = error.toLowerCase();
    if (lower.includes('not found') || lower.includes('no printer')) {
      return 'প্রিন্টার পাওয়া যায়নি। সংযোগ পরীক্ষা করুন।';
    }
    if (lower.includes('offline')) {
      return 'প্রিন্টার অফলাইন। প্রিন্টার চালু করুন।';
    }
    if (lower.includes('paper')) {
      return 'প্রিন্টারে কাগজ নেই। কাগজ পরীক্ষা করুন।';
    }
    if (lower.includes('access denied') || lower.includes('permission')) {
      return 'প্রিন্টারের অনুমতি নেই। প্রিন্টার সেটিংস পরীক্ষা করুন।';
    }
    return 'রসিদ প্রিন্ট করা যায়নি। প্রিন্টার পরীক্ষা করে আবার চেষ্টা করুন।';
  }

  async printReceipt(saleId: string, options: PrintOptions = {}): Promise<PrintResult> {
    try {
      const receiptData = await this.getSaleData(saleId);
      const config = this.getConfiguredPrinter();
      const width: PaperWidth = options.paperWidth || config.paperWidth || '80mm';
      const printerName = options.printerName || options.printerId || config.selectedPrinterName || config.selectedPrinterId || undefined;

      const html = renderReceiptHtml(receiptData, width, {
        showBarcode: config.showBarcode,
        showCustomer: config.showCustomer,
        footer: config.receiptFooter,
      });

      const result = await this.printHtml(html, {
        printerName,
        paperWidth: width,
        copies: options.copies || config.copies,
        silent: options.silent,
      });

      // Audit log for print — does NOT create sale/payment/stock, only audit
      try {
        const db = getConnection();
        const auditId = Id.generate();
        db.prepare(
          `INSERT INTO audit_logs (id, business_id, user_id, action, entity_type, entity_id, description, description_bn, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          auditId,
          (receiptData.business as any)?.id || 'unknown',
          'system',
          'print_receipt',
          'sale',
          saleId,
          `Receipt printed for sale ${receiptData.sale.saleNumber} on ${printerName || 'default'}`,
          `বিক্রয় ${receiptData.sale.saleNumber} এর রসিদ প্রিন্ট করা হয়েছে`,
          Date.now()
        );
      } catch (e) {
        logger.warn('Failed to create audit log for print', { error: String(e) });
      }

      return result;
    } catch (e) {
      const err = e instanceof AppError ? e : new AppError({
        code: 'SYSTEM_ERROR',
        message: String(e),
        messageBn: 'প্রিন্ট করা যায়নি। আবার চেষ্টা করুন।',
        statusCode: 500,
      });
      lastPrintError = err.message;
      return {
        success: false,
        message: err.message,
        messageBn: err.messageBn,
        timestamp: Date.now(),
      };
    }
  }

  async printInvoice(saleId: string, options: PrintOptions = {}): Promise<PrintResult> {
    try {
      const receiptData = await this.getSaleData(saleId);
      const config = this.getConfiguredPrinter();
      const printerName = options.printerName || options.printerId || config.a4PrinterName || config.a4PrinterId || config.selectedPrinterName || undefined;

      const html = renderInvoiceA4Html(receiptData, {
        showBarcode: config.showBarcode,
        showCustomer: config.showCustomer,
        footer: config.receiptFooter,
      });

      const result = await this.printHtml(html, {
        printerName,
        paperWidth: 'A4',
        copies: options.copies || config.copies,
        silent: options.silent,
      });

      // Audit
      try {
        const db = getConnection();
        const auditId = Id.generate();
        db.prepare(
          `INSERT INTO audit_logs (id, business_id, user_id, action, entity_type, entity_id, description, description_bn, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          auditId,
          (receiptData.business as any)?.id || 'unknown',
          'system',
          'print_invoice',
          'sale',
          saleId,
          `Invoice printed for sale ${receiptData.sale.saleNumber}`,
          `বিক্রয় ${receiptData.sale.saleNumber} এর ইনভয়েস প্রিন্ট করা হয়েছে`,
          Date.now()
        );
      } catch {}

      return result;
    } catch (e) {
      const err = e instanceof AppError ? e : new AppError({
        code: 'SYSTEM_ERROR',
        message: String(e),
        messageBn: 'ইনভয়েস প্রিন্ট করা যায়নি।',
        statusCode: 500,
      });
      lastPrintError = err.message;
      return {
        success: false,
        message: err.message,
        messageBn: err.messageBn,
        timestamp: Date.now(),
      };
    }
  }

  async reprintReceipt(saleId: string, options: PrintOptions = {}): Promise<PrintResult> {
    // Reprint must NOT create another sale, payment, stock, ledger — only print + audit
    // This method reuses printReceipt which only reads DB and writes audit, safe
    const result = await this.printReceipt(saleId, options);

    if (result.success) {
      try {
        const db = getConnection();
        const sale = db.prepare('SELECT business_id, sale_number FROM sales WHERE id = ?').get(saleId) as any;
        if (sale) {
          const auditId = Id.generate();
          db.prepare(
            `INSERT INTO audit_logs (id, business_id, user_id, action, entity_type, entity_id, description, description_bn, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(
            auditId,
            sale.business_id,
            'system',
            'reprint_receipt',
            'sale',
            saleId,
            `Receipt reprinted for sale ${sale.sale_number}`,
            `বিক্রয় ${sale.sale_number} এর রসিদ পুনরায় প্রিন্ট করা হয়েছে`,
            Date.now()
          );
        }
      } catch {}
    }

    return result;
  }

  async testPrinter(printerIdOrName: string): Promise<PrintResult> {
    const sanitized = sanitizePrinterName(printerIdOrName);
    const printers = await this.listPrinters();
    const found = printers.find(p => p.id === sanitized || p.name === sanitized);

    const targetName = found?.name || sanitized;

    if (!found && printers.length > 0) {
      // If not found, return Bengali error, don't fake success
      return {
        success: false,
        message: 'Printer not found',
        messageBn: 'প্রিন্টার পাওয়া যায়নি। সংযোগ পরীক্ষা করুন।',
        printerName: targetName,
        timestamp: Date.now(),
      };
    }

    const html = renderTestPageHtml(targetName);

    return this.printHtml(html, {
      printerName: targetName,
      paperWidth: '80mm',
      copies: 1,
      silent: true,
    });
  }

  async getDiagnostics(): Promise<HardwareDiagnostics> {
    const printers = await this.listPrinters();
    const defaultPrinter = printers.find(p => p.isDefault) || null;
    const config = this.getConfiguredPrinter();
    const scannerConfig = this.getScannerConfig();

    const configManager = getConfigManager();
    const appConfig = configManager.getAppConfig();

    return {
      printersDetected: printers.length,
      defaultPrinter: defaultPrinter?.name || null,
      configuredPrinter: config.selectedPrinterName || config.selectedPrinterId || null,
      a4Printer: config.a4PrinterName || config.a4PrinterId || null,
      lastPrintResult,
      lastPrintError,
      lastScannerEvent: null, // Scanner events are renderer-side, will be updated via IPC
      scannerConfig,
      printerConfig: config,
      systemInfo: {
        platform: process.platform,
        arch: process.arch,
        electronVersion: process.versions.electron || 'unknown',
        appVersion: app.getVersion(),
        userDataPath: appConfig.userDataPath,
      },
      timestamp: Date.now(),
    };
  }

  // For testing — clear last print state
  clearDiagnostics() {
    lastPrintResult = null;
    lastPrintError = null;
  }
}
