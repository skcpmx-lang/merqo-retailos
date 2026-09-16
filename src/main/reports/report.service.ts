/**
 * Report Service — P4.4
 * READ-ONLY, no mutations, integer paisa, milli quantity
 * Parameterized queries only, no SQL injection
 * Date ranges inclusive start/end
 */

import { getConnection } from '../db/connection';
import { logger } from '../logging/logger';
import type {
  ReportFilter,
  DateRange,
  DateRangePreset,
  SalesSummary,
  SalesByProductRow,
  SalesByCategoryRow,
  SalesByCashierRow,
  SalesByPaymentMethodRow,
  PurchaseSummary,
  PurchaseBySupplierRow,
  PurchaseByProductRow,
  InventoryStockRow,
  LowStockRow,
  StockMovementRow,
  StockValuation,
  CustomerDueRow,
  CustomerStatement,
  CustomerStatementRow,
  SupplierPayableRow,
  SupplierStatement,
  SupplierStatementRow,
  CashReport,
  BankReport,
  MfsReport,
  ExpenseSummary,
  ExpenseByCategoryRow,
  ExpenseReportRow,
  ShiftReportRow,
  ProfitLossReport,
  DashboardMetrics,
} from './report.types';
import { PAYMENT_METHOD_LABELS, MOVEMENT_TYPE_LABELS } from './report.types';

// Date range helpers — reused from finance dashboard but centralized
export function getDateRange(preset: DateRangePreset, customStart?: number, customEnd?: number): DateRange {
  const now = new Date();
  let start: Date;
  let end: Date;

  switch (preset) {
    case 'today': {
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      end = new Date(now);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case 'yesterday': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      start = new Date(y);
      start.setHours(0, 0, 0, 0);
      end = new Date(y);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case 'thisWeek': {
      start = new Date(now);
      const day = start.getDay(); // 0 Sun
      const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Monday start
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
      end = new Date(now);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case 'thisMonth': {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    }
    case 'prevMonth': {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      break;
    }
    case 'custom': {
      if (customStart && customEnd) {
        start = new Date(customStart);
        start.setHours(0, 0, 0, 0);
        end = new Date(customEnd);
        end.setHours(23, 59, 59, 999);
      } else {
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
        end = new Date(now);
        end.setHours(23, 59, 59, 999);
      }
      break;
    }
    default: {
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      end = new Date(now);
      end.setHours(23, 59, 59, 999);
    }
  }

  const label = `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
  const labelBn = `${start.toLocaleDateString('bn-BD')} - ${end.toLocaleDateString('bn-BD')}`;

  return {
    preset,
    start: start.getTime(),
    end: end.getTime(),
    label,
    labelBn,
  };
}

function resolveDateRange(filter?: ReportFilter): { start: number; end: number } | null {
  if (!filter) return null;
  if (filter.dateRange) {
    return { start: filter.dateRange.start, end: filter.dateRange.end };
  }
  if (filter.fromDate !== undefined && filter.toDate !== undefined) {
    return { start: filter.fromDate, end: filter.toDate };
  }
  if (filter.fromDate !== undefined) {
    return { start: filter.fromDate, end: Date.now() };
  }
  return null;
}

function buildDateCondition(column: string, filter: ReportFilter | undefined, params: any[]): string {
  const range = resolveDateRange(filter);
  if (!range) return '';
  params.push(range.start, range.end);
  return ` AND ${column} >= ? AND ${column} <= ? `;
}

function safeOrderBy(input: string | undefined, allowed: string[], defaultOrder: string): string {
  if (!input) return defaultOrder;
  if (allowed.includes(input)) return input;
  return defaultOrder;
}

export class ReportService {
  private static instance: ReportService | null = null;

  static getInstance(): ReportService {
    if (!ReportService.instance) {
      ReportService.instance = new ReportService();
    }
    return ReportService.instance;
  }

  // ========== SALES REPORTS ==========

  getSalesSummary(filter: ReportFilter = {}): SalesSummary {
    const db = getConnection();
    const params: any[] = [];
    let where = ' WHERE 1=1 ';
    if (filter.businessId) {
      where += ' AND business_id = ? ';
      params.push(filter.businessId);
    }
    const range = resolveDateRange(filter);
    if (range) {
      where += ' AND sale_date >= ? AND sale_date <= ? ';
      params.push(range.start, range.end);
    }
    if (filter.customerId) {
      where += ' AND customer_id = ? ';
      params.push(filter.customerId);
    }
    if (filter.userId) {
      where += ' AND created_by = ? ';
      params.push(filter.userId);
    }

    // Exclude cancelled/voided
    where += " AND status NOT IN ('cancelled','voided') ";

    const row = db.prepare(`
      SELECT
        COALESCE(SUM(subtotal_paisa),0) as gross,
        COALESCE(SUM(discount_paisa),0) as discount,
        COALESCE(SUM(tax_paisa),0) as tax,
        COALESCE(SUM(shipping_paisa),0) as shipping,
        COALESCE(SUM(total_paisa),0) as net,
        COALESCE(SUM(paid_paisa),0) as paid,
        COALESCE(SUM(due_paisa),0) as due,
        COUNT(*) as cnt,
        COALESCE(SUM(total_paisa - paid_paisa),0) as dueCheck
      FROM sales
      ${where}
    `).get(...params) as any;

    // Quantity sold
    const qtyParams: any[] = [];
    let qtyWhere = ' WHERE 1=1 ';
    if (filter.businessId) {
      qtyWhere += ' AND s.business_id = ? ';
      qtyParams.push(filter.businessId);
    }
    if (range) {
      qtyWhere += ' AND s.sale_date >= ? AND s.sale_date <= ? ';
      qtyParams.push(range.start, range.end);
    }
    if (filter.customerId) {
      qtyWhere += ' AND s.customer_id = ? ';
      qtyParams.push(filter.customerId);
    }
    if (filter.userId) {
      qtyWhere += ' AND s.created_by = ? ';
      qtyParams.push(filter.userId);
    }
    qtyWhere += " AND s.status NOT IN ('cancelled','voided') ";

    const qtyRow = db.prepare(`
      SELECT COALESCE(SUM(si.base_quantity_milli),0) as totalQty
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      ${qtyWhere}
    `).get(...qtyParams) as any;

    // Returns
    const retParams: any[] = [];
    let retWhere = ' WHERE 1=1 ';
    if (filter.businessId) {
      retWhere += ' AND business_id = ? ';
      retParams.push(filter.businessId);
    }
    if (range) {
      retWhere += ' AND return_date >= ? AND return_date <= ? ';
      retParams.push(range.start, range.end);
    }
    retWhere += " AND status NOT IN ('cancelled','voided') ";

    const retRow = db.prepare(`
      SELECT COALESCE(SUM(total_paisa),0) as retTotal, COALESCE(SUM(refund_paisa),0) as refundTotal
      FROM sale_returns
      ${retWhere}
    `).get(...retParams) as any;

    const gross = row.gross || 0;
    const discount = row.discount || 0;
    const tax = row.tax || 0;
    const shipping = row.shipping || 0;
    const net = row.net || 0;
    const paid = row.paid || 0;
    const due = row.due || 0;
    const retTotal = retRow.retTotal || 0;
    const refundTotal = retRow.refundTotal || 0;
    const cnt = row.cnt || 0;
    const totalQty = qtyRow.totalQty || 0;
    const avg = cnt > 0 ? Math.round(net / cnt) : 0;

    return {
      grossSalesPaisa: gross,
      discountPaisa: discount,
      taxPaisa: tax,
      shippingPaisa: shipping,
      netSalesPaisa: net,
      paidPaisa: paid,
      duePaisa: due,
      returnPaisa: retTotal,
      refundPaisa: refundTotal,
      netSalesAfterReturnPaisa: net - retTotal,
      transactionCount: cnt,
      totalQuantityMilli: totalQty,
      averageSalePaisa: avg,
    };
  }

  getSalesByProduct(filter: ReportFilter = {}): SalesByProductRow[] {
    const db = getConnection();
    const params: any[] = [];
    let where = ' WHERE 1=1 ';
    if (filter.businessId) {
      where += ' AND s.business_id = ? ';
      params.push(filter.businessId);
    }
    const range = resolveDateRange(filter);
    if (range) {
      where += ' AND s.sale_date >= ? AND s.sale_date <= ? ';
      params.push(range.start, range.end);
    }
    if (filter.productId) {
      where += ' AND si.product_id = ? ';
      params.push(filter.productId);
    }
    if (filter.categoryId) {
      where += ' AND p.category_id = ? ';
      params.push(filter.categoryId);
    }
    if (filter.userId) {
      where += ' AND s.created_by = ? ';
      params.push(filter.userId);
    }
    where += " AND s.status NOT IN ('cancelled','voided') ";

    const rows = db.prepare(`
      SELECT
        si.product_id as productId,
        p.name as productName,
        p.name_bn as productNameBn,
        p.sku as sku,
        p.barcode as barcode,
        si.unit_id as unitId,
        u.name as unitName,
        SUM(si.base_quantity_milli) as quantityMilli,
        SUM(si.line_total_paisa) as grossSales,
        SUM(si.discount_paisa) as discount,
        SUM(si.line_total_paisa) as netSales,
        SUM(si.line_cost_total_paisa) as cogs,
        SUM(si.line_total_paisa - si.line_cost_total_paisa) as grossProfit
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      JOIN products p ON p.id = si.product_id
      LEFT JOIN units u ON u.id = si.unit_id
      ${where}
      GROUP BY si.product_id
      ORDER BY netSales DESC
    `).all(...params) as any[];

    return rows.map(r => {
      const qtyUnits = r.quantityMilli / 1000;
      const margin = r.netSales > 0 ? ((r.grossProfit / r.netSales) * 100) : null;
      return {
        productId: r.productId,
        productName: r.productName,
        productNameBn: r.productNameBn,
        sku: r.sku,
        barcode: r.barcode,
        unitId: r.unitId,
        unitName: r.unitName,
        quantityMilli: r.quantityMilli,
        quantityUnits: qtyUnits,
        grossSalesPaisa: r.grossSales,
        discountPaisa: r.discount,
        netSalesPaisa: r.netSales,
        cogsPaisa: r.cogs,
        grossProfitPaisa: r.grossProfit,
        marginPercent: margin !== null ? Math.round(margin * 100) / 100 : null,
      };
    });
  }

  getSalesByCategory(filter: ReportFilter = {}): SalesByCategoryRow[] {
    const db = getConnection();
    const params: any[] = [];
    let where = ' WHERE 1=1 ';
    if (filter.businessId) {
      where += ' AND s.business_id = ? ';
      params.push(filter.businessId);
    }
    const range = resolveDateRange(filter);
    if (range) {
      where += ' AND s.sale_date >= ? AND s.sale_date <= ? ';
      params.push(range.start, range.end);
    }
    where += " AND s.status NOT IN ('cancelled','voided') ";

    const rows = db.prepare(`
      SELECT
        c.id as categoryId,
        c.name as categoryName,
        c.name_bn as categoryNameBn,
        c.parent_id as parentId,
        SUM(si.base_quantity_milli) as quantityMilli,
        SUM(si.line_total_paisa) as salesPaisa,
        SUM(si.line_cost_total_paisa) as cogsPaisa,
        SUM(si.line_total_paisa - si.line_cost_total_paisa) as grossProfitPaisa,
        COUNT(DISTINCT si.product_id) as productCount
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      JOIN products p ON p.id = si.product_id
      JOIN categories c ON c.id = p.category_id
      ${where}
      GROUP BY c.id
      ORDER BY salesPaisa DESC
    `).all(...params) as any[];

    return rows.map(r => ({
      categoryId: r.categoryId,
      categoryName: r.categoryName,
      categoryNameBn: r.categoryNameBn,
      parentId: r.parentId,
      quantityMilli: r.quantityMilli,
      salesPaisa: r.salesPaisa,
      cogsPaisa: r.cogsPaisa,
      grossProfitPaisa: r.grossProfitPaisa,
      productCount: r.productCount,
    }));
  }

  getSalesByCashier(filter: ReportFilter = {}): SalesByCashierRow[] {
    const db = getConnection();
    const params: any[] = [];
    let where = ' WHERE 1=1 ';
    if (filter.businessId) {
      where += ' AND s.business_id = ? ';
      params.push(filter.businessId);
    }
    const range = resolveDateRange(filter);
    if (range) {
      where += ' AND s.sale_date >= ? AND s.sale_date <= ? ';
      params.push(range.start, range.end);
    }
    where += " AND s.status NOT IN ('cancelled','voided') ";

    const rows = db.prepare(`
      SELECT
        s.created_by as cashierId,
        COALESCE(u.name, s.created_by) as cashierName,
        COUNT(*) as transactionCount,
        SUM(s.total_paisa) as salesPaisa,
        SUM(s.discount_paisa) as discountPaisa,
        SUM(s.paid_paisa) as paidPaisa,
        SUM(s.due_paisa) as duePaisa
      FROM sales s
      LEFT JOIN users u ON u.id = s.created_by
      ${where}
      GROUP BY s.created_by
      ORDER BY salesPaisa DESC
    `).all(...params) as any[];

    // Returns per cashier
    const retParams: any[] = [];
    let retWhere = ' WHERE 1=1 ';
    if (filter.businessId) {
      retWhere += ' AND business_id = ? ';
      retParams.push(filter.businessId);
    }
    if (range) {
      retWhere += ' AND return_date >= ? AND return_date <= ? ';
      retParams.push(range.start, range.end);
    }
    const retRows = db.prepare(`
      SELECT created_by as cashierId, COALESCE(SUM(total_paisa),0) as returnPaisa
      FROM sale_returns
      ${retWhere}
      GROUP BY created_by
    `).all(...retParams) as any[];
    const retMap = new Map(retRows.map((r: any) => [r.cashierId, r.returnPaisa]));

    return rows.map(r => ({
      cashierId: r.cashierId || 'unknown',
      cashierName: r.cashierName || r.cashierId || 'অজানা',
      transactionCount: r.transactionCount,
      salesPaisa: r.salesPaisa,
      discountPaisa: r.discountPaisa,
      returnPaisa: retMap.get(r.cashierId) || 0,
      netSalesPaisa: r.salesPaisa - (retMap.get(r.cashierId) || 0),
      paidPaisa: r.paidPaisa,
      duePaisa: r.duePaisa,
    }));
  }

  getSalesByPaymentMethod(filter: ReportFilter = {}): SalesByPaymentMethodRow[] {
    const db = getConnection();
    const params: any[] = [];
    let where = ' WHERE 1=1 ';
    if (filter.businessId) {
      where += ' AND sp.business_id = ? ';
      params.push(filter.businessId);
    }
    const range = resolveDateRange(filter);
    if (range) {
      where += ' AND s.sale_date >= ? AND s.sale_date <= ? ';
      params.push(range.start, range.end);
    }
    where += " AND s.status NOT IN ('cancelled','voided') ";

    const rows = db.prepare(`
      SELECT
        sp.payment_method as method,
        COUNT(*) as cnt,
        SUM(sp.amount_paisa) as amount
      FROM sale_payments sp
      JOIN sales s ON s.id = sp.sale_id
      ${where}
      GROUP BY sp.payment_method
      ORDER BY amount DESC
    `).all(...params) as any[];

    const total = rows.reduce((sum: number, r: any) => sum + (r.amount || 0), 0);

    return rows.map(r => {
      const labels = PAYMENT_METHOD_LABELS[r.method] || PAYMENT_METHOD_LABELS['other'];
      const pct = total > 0 ? (r.amount / total) * 100 : 0;
      return {
        method: r.method,
        methodLabel: labels.en,
        methodLabelBn: labels.bn,
        count: r.cnt,
        amountPaisa: r.amount,
        percentage: Math.round(pct * 100) / 100,
      };
    });
  }

  // ========== PURCHASE REPORTS ==========

  getPurchaseSummary(filter: ReportFilter = {}): PurchaseSummary {
    const db = getConnection();
    const params: any[] = [];
    let where = ' WHERE 1=1 ';
    if (filter.businessId) {
      where += ' AND business_id = ? ';
      params.push(filter.businessId);
    }
    const range = resolveDateRange(filter);
    if (range) {
      where += ' AND purchase_date >= ? AND purchase_date <= ? ';
      params.push(range.start, range.end);
    }
    if (filter.supplierId) {
      where += ' AND supplier_id = ? ';
      params.push(filter.supplierId);
    }
    where += " AND status NOT IN ('cancelled','voided') ";

    const row = db.prepare(`
      SELECT
        COUNT(*) as cnt,
        COALESCE(SUM(subtotal_paisa),0) as subtotal,
        COALESCE(SUM(discount_paisa),0) as discount,
        COALESCE(SUM(tax_paisa),0) as tax,
        COALESCE(SUM(shipping_paisa),0) as shipping,
        COALESCE(SUM(total_paisa),0) as total,
        COALESCE(SUM(paid_paisa),0) as paid,
        COALESCE(SUM(due_paisa),0) as due
      FROM purchases
      ${where}
    `).get(...params) as any;

    const retParams: any[] = [];
    let retWhere = ' WHERE 1=1 ';
    if (filter.businessId) {
      retWhere += ' AND business_id = ? ';
      retParams.push(filter.businessId);
    }
    if (range) {
      retWhere += ' AND return_date >= ? AND return_date <= ? ';
      retParams.push(range.start, range.end);
    }
    const retRow = db.prepare(`
      SELECT COALESCE(SUM(total_paisa),0) as retTotal
      FROM purchase_returns
      ${retWhere}
    `).get(...retParams) as any;

    return {
      purchaseCount: row.cnt || 0,
      subtotalPaisa: row.subtotal || 0,
      discountPaisa: row.discount || 0,
      taxPaisa: row.tax || 0,
      shippingPaisa: row.shipping || 0,
      totalPaisa: row.total || 0,
      paidPaisa: row.paid || 0,
      duePaisa: row.due || 0,
      returnPaisa: retRow.retTotal || 0,
      netPurchasePaisa: (row.total || 0) - (retRow.retTotal || 0),
    };
  }

  getPurchaseBySupplier(filter: ReportFilter = {}): PurchaseBySupplierRow[] {
    const db = getConnection();
    const params: any[] = [];
    let where = ' WHERE 1=1 ';
    if (filter.businessId) {
      where += ' AND p.business_id = ? ';
      params.push(filter.businessId);
    }
    const range = resolveDateRange(filter);
    if (range) {
      where += ' AND p.purchase_date >= ? AND p.purchase_date <= ? ';
      params.push(range.start, range.end);
    }
    where += " AND p.status NOT IN ('cancelled','voided') ";

    const rows = db.prepare(`
      SELECT
        s.id as supplierId,
        s.name as supplierName,
        s.phone as phone,
        COUNT(p.id) as purchaseCount,
        COALESCE(SUM(p.total_paisa),0) as purchaseAmount,
        COALESCE(SUM(p.paid_paisa),0) as paid,
        COALESCE(SUM(p.due_paisa),0) as payable
      FROM purchases p
      JOIN suppliers s ON s.id = p.supplier_id
      ${where}
      GROUP BY s.id
      ORDER BY purchaseAmount DESC
    `).all(...params) as any[];

    // Returns per supplier
    const retParams: any[] = [];
    let retWhere = ' WHERE 1=1 ';
    if (filter.businessId) {
      retWhere += ' AND business_id = ? ';
      retParams.push(filter.businessId);
    }
    if (range) {
      retWhere += ' AND return_date >= ? AND return_date <= ? ';
      retParams.push(range.start, range.end);
    }
    const retRows = db.prepare(`
      SELECT supplier_id, COALESCE(SUM(total_paisa),0) as retTotal
      FROM purchase_returns
      ${retWhere}
      GROUP BY supplier_id
    `).all(...retParams) as any[];
    const retMap = new Map(retRows.map((r: any) => [r.supplier_id, r.retTotal]));

    return rows.map(r => ({
      supplierId: r.supplierId,
      supplierName: r.supplierName,
      phone: r.phone,
      purchaseCount: r.purchaseCount,
      purchaseAmountPaisa: r.purchaseAmount,
      paidPaisa: r.paid,
      payablePaisa: r.payable,
      returnPaisa: retMap.get(r.supplierId) || 0,
    }));
  }

  getPurchaseByProduct(filter: ReportFilter = {}): PurchaseByProductRow[] {
    const db = getConnection();
    const params: any[] = [];
    let where = ' WHERE 1=1 ';
    if (filter.businessId) {
      where += ' AND p.business_id = ? ';
      params.push(filter.businessId);
    }
    const range = resolveDateRange(filter);
    if (range) {
      where += ' AND p.purchase_date >= ? AND p.purchase_date <= ? ';
      params.push(range.start, range.end);
    }
    if (filter.productId) {
      where += ' AND pi.product_id = ? ';
      params.push(filter.productId);
    }
    where += " AND p.status NOT IN ('cancelled','voided') ";

    const rows = db.prepare(`
      SELECT
        pi.product_id as productId,
        prod.name as productName,
        prod.sku as sku,
        SUM(pi.base_quantity_milli) as quantityMilli,
        SUM(pi.line_total_paisa) as purchaseCost,
        AVG(pi.base_cost_per_unit_paisa) as avgCost
      FROM purchase_items pi
      JOIN purchases p ON p.id = pi.purchase_id
      JOIN products prod ON prod.id = pi.product_id
      ${where}
      GROUP BY pi.product_id
      ORDER BY purchaseCost DESC
    `).all(...params) as any[];

    // Returns per product
    const retParams: any[] = [];
    let retWhere = ' WHERE 1=1 ';
    if (filter.businessId) {
      retWhere += ' AND pr.business_id = ? ';
      retParams.push(filter.businessId);
    }
    if (range) {
      retWhere += ' AND pr.return_date >= ? AND pr.return_date <= ? ';
      retParams.push(range.start, range.end);
    }
    if (filter.productId) {
      retWhere += ' AND pri.product_id = ? ';
      retParams.push(filter.productId);
    }
    const retRows = db.prepare(`
      SELECT pri.product_id as productId, COALESCE(SUM(pri.base_quantity_milli),0) as retQty, COALESCE(SUM(pri.line_total_paisa),0) as retCost
      FROM purchase_return_items pri
      JOIN purchase_returns pr ON pr.id = pri.return_id
      ${retWhere}
      GROUP BY pri.product_id
    `).all(...retParams) as any[];
    const retMap = new Map(retRows.map((r: any) => [r.productId, { qty: r.retQty, cost: r.retCost }]));

    return rows.map(r => {
      const ret = retMap.get(r.productId) || { qty: 0, cost: 0 };
      return {
        productId: r.productId,
        productName: r.productName,
        sku: r.sku,
        quantityMilli: r.quantityMilli,
        quantityUnits: r.quantityMilli / 1000,
        purchaseCostPaisa: r.purchaseCost,
        avgCostPaisa: Math.round(r.avgCost || 0),
        returnedQuantityMilli: ret.qty,
        netQuantityMilli: r.quantityMilli - ret.qty,
        netCostPaisa: r.purchaseCost - ret.cost,
      };
    });
  }

  // ========== INVENTORY REPORTS ==========

  getCurrentStock(filter: ReportFilter = {}): InventoryStockRow[] {
    const db = getConnection();
    const params: any[] = [];
    let where = ' WHERE 1=1 ';
    if (filter.businessId) {
      where += ' AND p.business_id = ? ';
      params.push(filter.businessId);
    }
    if (filter.productId) {
      where += ' AND p.id = ? ';
      params.push(filter.productId);
    }
    if (filter.categoryId) {
      where += ' AND p.category_id = ? ';
      params.push(filter.categoryId);
    }
    where += ' AND p.deleted_at IS NULL ';

    const rows = db.prepare(`
      SELECT
        p.id as productId,
        p.name as productName,
        p.name_bn as productNameBn,
        p.sku as sku,
        p.barcode as barcode,
        p.base_unit_id as baseUnitId,
        u.name as baseUnitName,
        COALESCE(sl.quantity_milli,0) as currentQuantityMilli,
        COALESCE(sl.reserved_milli,0) as reservedMilli,
        p.cost_price_paisa as wacPaisa,
        p.min_stock_milli as minStockMilli,
        p.reorder_level_milli as reorderLevelMilli,
        c.name as categoryName
      FROM products p
      LEFT JOIN stock_levels sl ON sl.product_id = p.id AND sl.location_id = 'main'
      LEFT JOIN units u ON u.id = p.base_unit_id
      LEFT JOIN categories c ON c.id = p.category_id
      ${where}
      ORDER BY p.name ASC
      LIMIT ? OFFSET ?
    `).all(...params, filter.limit || 1000, filter.offset || 0) as any[];

    return rows.map(r => {
      const available = r.currentQuantityMilli - r.reservedMilli;
      const stockValue = Math.round((r.currentQuantityMilli / 1000) * r.wacPaisa);
      let status: InventoryStockRow['status'] = 'in_stock';
      if (r.currentQuantityMilli <= 0) status = 'out_of_stock';
      else if (r.minStockMilli > 0 && r.currentQuantityMilli <= r.minStockMilli) status = 'low_stock';
      else if (r.reorderLevelMilli > 0 && r.currentQuantityMilli <= r.reorderLevelMilli) status = 'low_stock';

      return {
        productId: r.productId,
        productName: r.productName,
        productNameBn: r.productNameBn,
        sku: r.sku,
        barcode: r.barcode,
        baseUnitId: r.baseUnitId,
        baseUnitName: r.baseUnitName,
        currentQuantityMilli: r.currentQuantityMilli,
        quantityUnits: r.currentQuantityMilli / 1000,
        reservedMilli: r.reservedMilli,
        availableMilli: available,
        wacPaisa: r.wacPaisa,
        stockValuePaisa: stockValue,
        minStockMilli: r.minStockMilli,
        reorderLevelMilli: r.reorderLevelMilli,
        status,
        categoryName: r.categoryName,
      };
    });
  }

  getLowStock(filter: ReportFilter = {}): LowStockRow[] {
    const all = this.getCurrentStock({ ...filter, limit: 10000 });
    const low = all.filter(r => r.status === 'low_stock' || r.status === 'out_of_stock');
    return low.map(r => ({
      ...r,
      deficitMilli: Math.max(0, (r.minStockMilli || r.reorderLevelMilli || 0) - r.currentQuantityMilli),
    }));
  }

  getStockValuation(filter: ReportFilter = {}): StockValuation {
    const stocks = this.getCurrentStock({ ...filter, limit: 10000 });
    const totalQty = stocks.reduce((sum, s) => sum + s.currentQuantityMilli, 0);
    const totalValue = stocks.reduce((sum, s) => sum + s.stockValuePaisa, 0);
    const avgWac = stocks.length > 0 ? Math.round(totalValue / (totalQty / 1000 || 1)) : 0;
    return {
      totalProducts: stocks.length,
      totalQuantityMilli: totalQty,
      totalValuePaisa: totalValue,
      averageWacPaisa: avgWac,
      inStockCount: stocks.filter(s => s.status === 'in_stock').length,
      lowStockCount: stocks.filter(s => s.status === 'low_stock').length,
      outOfStockCount: stocks.filter(s => s.status === 'out_of_stock').length,
    };
  }

  getStockMovements(filter: ReportFilter = {}): StockMovementRow[] {
    const db = getConnection();
    const params: any[] = [];
    let where = ' WHERE 1=1 ';
    if (filter.businessId) {
      where += ' AND sm.business_id = ? ';
      params.push(filter.businessId);
    }
    const range = resolveDateRange(filter);
    if (range) {
      where += ' AND sm.created_at >= ? AND sm.created_at <= ? ';
      params.push(range.start, range.end);
    }
    if (filter.productId) {
      where += ' AND sm.product_id = ? ';
      params.push(filter.productId);
    }

    const rows = db.prepare(`
      SELECT
        sm.id as id,
        sm.created_at as createdAt,
        sm.product_id as productId,
        p.name as productName,
        p.sku as sku,
        sm.movement_type as movementType,
        sm.quantity_milli as quantityMilli,
        sm.cost_paisa as costPaisa,
        sm.reference_type as referenceType,
        sm.reference_id as referenceId,
        sm.location_id as locationId,
        sm.notes as notes,
        sm.created_by as createdBy
      FROM stock_movements sm
      JOIN products p ON p.id = sm.product_id
      ${where}
      ORDER BY sm.created_at DESC, sm.rowid DESC
      LIMIT ? OFFSET ?
    `).all(...params, filter.limit || 200, filter.offset || 0) as any[];

    // Try to resolve reference numbers
    return rows.map(r => {
      const labels = MOVEMENT_TYPE_LABELS[r.movementType] || { en: r.movementType, bn: r.movementType };
      let refNumber: string | undefined;
      try {
        if (r.referenceType === 'purchase' && r.referenceId) {
          const pur = db.prepare('SELECT purchase_number FROM purchases WHERE id = ?').get(r.referenceId) as any;
          refNumber = pur?.purchase_number;
        } else if (r.referenceType === 'sale' && r.referenceId) {
          const sal = db.prepare('SELECT sale_number FROM sales WHERE id = ?').get(r.referenceId) as any;
          refNumber = sal?.sale_number;
        } else if (r.referenceType === 'sale_return' && r.referenceId) {
          const ret = db.prepare('SELECT return_number FROM sale_returns WHERE id = ?').get(r.referenceId) as any;
          refNumber = ret?.return_number;
        } else if (r.referenceType === 'purchase_return' && r.referenceId) {
          const ret = db.prepare('SELECT return_number FROM purchase_returns WHERE id = ?').get(r.referenceId) as any;
          refNumber = ret?.return_number;
        }
      } catch {}

      return {
        id: r.id,
        createdAt: r.createdAt,
        productId: r.productId,
        productName: r.productName,
        sku: r.sku,
        movementType: r.movementType,
        movementTypeBn: labels.bn,
        quantityMilli: r.quantityMilli,
        quantityUnits: r.quantityMilli / 1000,
        costPaisa: r.costPaisa,
        referenceType: r.referenceType,
        referenceId: r.referenceId,
        referenceNumber: refNumber,
        locationId: r.locationId,
        notes: r.notes,
        createdBy: r.createdBy,
      };
    });
  }

  // ========== CUSTOMER REPORTS ==========

  getCustomerDue(filter: ReportFilter = {}): CustomerDueRow[] {
    const db = getConnection();
    const params: any[] = [];
    let where = ' WHERE 1=1 ';
    if (filter.businessId) {
      where += ' AND c.business_id = ? ';
      params.push(filter.businessId);
    }
    if (filter.customerId) {
      where += ' AND c.id = ? ';
      params.push(filter.customerId);
    }
    where += ' AND c.deleted_at IS NULL ';

    const rows = db.prepare(`
      SELECT
        c.id as customerId,
        c.name as customerName,
        c.phone as phone,
        c.opening_due_paisa as openingDue,
        c.current_due_paisa as currentDue,
        c.credit_limit_paisa as creditLimit,
        MAX(ct.created_at) as lastTxAt
      FROM customers c
      LEFT JOIN customer_transactions ct ON ct.customer_id = c.id
      ${where}
      GROUP BY c.id
      ORDER BY c.current_due_paisa DESC
      LIMIT ? OFFSET ?
    `).all(...params, filter.limit || 1000, filter.offset || 0) as any[];

    // For each customer, get sales/payments/returns totals if date range
    const range = resolveDateRange(filter);
    return rows.map(r => {
      let sales = 0, payments = 0, returns = 0;
      if (range) {
        try {
          const salesRow = db.prepare(`
            SELECT COALESCE(SUM(amount_paisa),0) as total FROM customer_transactions
            WHERE customer_id = ? AND transaction_type = 'sale' AND created_at >= ? AND created_at <= ?
          `).get(r.customerId, range.start, range.end) as any;
          sales = salesRow.total || 0;

          const payRow = db.prepare(`
            SELECT COALESCE(SUM(amount_paisa),0) as total FROM customer_transactions
            WHERE customer_id = ? AND transaction_type = 'payment' AND created_at >= ? AND created_at <= ?
          `).get(r.customerId, range.start, range.end) as any;
          payments = Math.abs(payRow.total || 0);

          const retRow = db.prepare(`
            SELECT COALESCE(SUM(amount_paisa),0) as total FROM customer_transactions
            WHERE customer_id = ? AND transaction_type = 'return' AND created_at >= ? AND created_at <= ?
          `).get(r.customerId, range.start, range.end) as any;
          returns = retRow.total || 0;
        } catch {}
      } else {
        // No date filter, get all
        try {
          const salesRow = db.prepare(`SELECT COALESCE(SUM(amount_paisa),0) as total FROM customer_transactions WHERE customer_id = ? AND transaction_type = 'sale'`).get(r.customerId) as any;
          sales = salesRow.total || 0;
          const payRow = db.prepare(`SELECT COALESCE(SUM(amount_paisa),0) as total FROM customer_transactions WHERE customer_id = ? AND transaction_type = 'payment'`).get(r.customerId) as any;
          payments = Math.abs(payRow.total || 0);
          const retRow = db.prepare(`SELECT COALESCE(SUM(amount_paisa),0) as total FROM customer_transactions WHERE customer_id = ? AND transaction_type = 'return'`).get(r.customerId) as any;
          returns = retRow.total || 0;
        } catch {}
      }

      const available = (r.creditLimit || 0) > 0 ? (r.creditLimit - r.currentDue) : 0;

      return {
        customerId: r.customerId,
        customerName: r.customerName,
        phone: r.phone,
        openingDuePaisa: r.openingDue || 0,
        salesPaisa: sales,
        paymentsPaisa: payments,
        returnsPaisa: returns,
        currentDuePaisa: r.currentDue || 0,
        creditLimitPaisa: r.creditLimit || 0,
        availableCreditPaisa: available,
        lastTransactionAt: r.lastTxAt,
      };
    });
  }

  getCustomerStatement(customerId: string, filter: ReportFilter = {}): CustomerStatement {
    const db = getConnection();
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId) as any;
    if (!customer) throw new Error('গ্রাহক পাওয়া যায়নি');

    const range = resolveDateRange(filter);
    const params: any[] = [customerId];
    let where = ' WHERE customer_id = ? ';
    if (range) {
      where += ' AND created_at >= ? AND created_at <= ? ';
      params.push(range.start, range.end);
    }

    const rows = db.prepare(`
      SELECT * FROM customer_transactions
      ${where}
      ORDER BY created_at ASC, rowid ASC
    `).all(...params) as any[];

    // Opening balance: sum before range
    let opening = customer.opening_due_paisa || 0;
    if (range) {
      const beforeRow = db.prepare(`
        SELECT COALESCE(SUM(amount_paisa),0) as total FROM customer_transactions
        WHERE customer_id = ? AND created_at < ?
      `).get(customerId, range.start) as any;
      opening += beforeRow.total || 0;
    }

    let running = opening;
    let totalSales = 0, totalPayments = 0, totalReturns = 0;

    const statementRows: CustomerStatementRow[] = rows.map(r => {
      running += r.amount_paisa;

      if (r.transaction_type === 'sale') totalSales += r.amount_paisa;
      else if (r.transaction_type === 'payment') totalPayments += Math.abs(r.amount_paisa);
      else if (r.transaction_type === 'return') totalReturns += r.amount_paisa;

      const typeBnMap: Record<string, string> = {
        sale: 'বিক্রয়',
        payment: 'পরিশোধ',
        return: 'ফেরত',
        adjustment: 'সমন্বয়',
        opening: 'ওপেনিং',
      };

      let refNumber: string | undefined;
      try {
        if (r.reference_type === 'sale' && r.reference_id) {
          const s = db.prepare('SELECT sale_number FROM sales WHERE id = ?').get(r.reference_id) as any;
          refNumber = s?.sale_number;
        }
      } catch {}

      return {
        id: r.id,
        date: r.created_at,
        type: r.transaction_type,
        typeBn: typeBnMap[r.transaction_type] || r.transaction_type,
        amountPaisa: r.amount_paisa,
        referenceType: r.reference_type,
        referenceId: r.reference_id,
        referenceNumber: refNumber,
        notes: r.notes,
        runningBalancePaisa: running,
      };
    });

    return {
      customerId,
      customerName: customer.name,
      openingBalancePaisa: opening,
      closingBalancePaisa: running,
      rows: statementRows,
      totalSalesPaisa: totalSales,
      totalPaymentsPaisa: totalPayments,
      totalReturnsPaisa: totalReturns,
    };
  }

  // ========== SUPPLIER REPORTS ==========

  getSupplierPayable(filter: ReportFilter = {}): SupplierPayableRow[] {
    const db = getConnection();
    const params: any[] = [];
    let where = ' WHERE 1=1 ';
    if (filter.businessId) {
      where += ' AND s.business_id = ? ';
      params.push(filter.businessId);
    }
    if (filter.supplierId) {
      where += ' AND s.id = ? ';
      params.push(filter.supplierId);
    }
    where += ' AND s.deleted_at IS NULL ';

    const rows = db.prepare(`
      SELECT
        s.id as supplierId,
        s.name as supplierName,
        s.phone as phone,
        s.opening_payable_paisa as openingPayable,
        s.current_payable_paisa as currentPayable,
        MAX(st.created_at) as lastTxAt
      FROM suppliers s
      LEFT JOIN supplier_transactions st ON st.supplier_id = s.id
      ${where}
      GROUP BY s.id
      ORDER BY s.current_payable_paisa DESC
      LIMIT ? OFFSET ?
    `).all(...params, filter.limit || 1000, filter.offset || 0) as any[];

    const range = resolveDateRange(filter);
    return rows.map(r => {
      let purchases = 0, payments = 0, returns = 0;
      if (range) {
        try {
          const purRow = db.prepare(`SELECT COALESCE(SUM(amount_paisa),0) as total FROM supplier_transactions WHERE supplier_id = ? AND transaction_type = 'purchase' AND created_at >= ? AND created_at <= ?`).get(r.supplierId, range.start, range.end) as any;
          purchases = purRow.total || 0;
          const payRow = db.prepare(`SELECT COALESCE(SUM(amount_paisa),0) as total FROM supplier_transactions WHERE supplier_id = ? AND transaction_type = 'payment' AND created_at >= ? AND created_at <= ?`).get(r.supplierId, range.start, range.end) as any;
          payments = Math.abs(payRow.total || 0);
          const retRow = db.prepare(`SELECT COALESCE(SUM(amount_paisa),0) as total FROM supplier_transactions WHERE supplier_id = ? AND transaction_type = 'return' AND created_at >= ? AND created_at <= ?`).get(r.supplierId, range.start, range.end) as any;
          returns = retRow.total || 0;
        } catch {}
      } else {
        try {
          const purRow = db.prepare(`SELECT COALESCE(SUM(amount_paisa),0) as total FROM supplier_transactions WHERE supplier_id = ? AND transaction_type = 'purchase'`).get(r.supplierId) as any;
          purchases = purRow.total || 0;
          const payRow = db.prepare(`SELECT COALESCE(SUM(amount_paisa),0) as total FROM supplier_transactions WHERE supplier_id = ? AND transaction_type = 'payment'`).get(r.supplierId) as any;
          payments = Math.abs(payRow.total || 0);
          const retRow = db.prepare(`SELECT COALESCE(SUM(amount_paisa),0) as total FROM supplier_transactions WHERE supplier_id = ? AND transaction_type = 'return'`).get(r.supplierId) as any;
          returns = retRow.total || 0;
        } catch {}
      }

      return {
        supplierId: r.supplierId,
        supplierName: r.supplierName,
        phone: r.phone,
        openingPayablePaisa: r.openingPayable || 0,
        purchasesPaisa: purchases,
        paymentsPaisa: payments,
        returnsPaisa: returns,
        currentPayablePaisa: r.currentPayable || 0,
        lastTransactionAt: r.lastTxAt,
      };
    });
  }

  getSupplierStatement(supplierId: string, filter: ReportFilter = {}): SupplierStatement {
    const db = getConnection();
    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId) as any;
    if (!supplier) throw new Error('সরবরাহকারী পাওয়া যায়নি');

    const range = resolveDateRange(filter);
    const params: any[] = [supplierId];
    let where = ' WHERE supplier_id = ? ';
    if (range) {
      where += ' AND created_at >= ? AND created_at <= ? ';
      params.push(range.start, range.end);
    }

    const rows = db.prepare(`
      SELECT * FROM supplier_transactions
      ${where}
      ORDER BY created_at ASC, rowid ASC
    `).all(...params) as any[];

    let opening = supplier.opening_payable_paisa || 0;
    if (range) {
      const beforeRow = db.prepare(`SELECT COALESCE(SUM(amount_paisa),0) as total FROM supplier_transactions WHERE supplier_id = ? AND created_at < ?`).get(supplierId, range.start) as any;
      opening += beforeRow.total || 0;
    }

    let running = opening;
    let totalPurchases = 0, totalPayments = 0, totalReturns = 0;

    const statementRows: SupplierStatementRow[] = rows.map(r => {
      running += r.amount_paisa;
      if (r.transaction_type === 'purchase') totalPurchases += r.amount_paisa;
      else if (r.transaction_type === 'payment') totalPayments += Math.abs(r.amount_paisa);
      else if (r.transaction_type === 'return') totalReturns += r.amount_paisa;

      const typeBnMap: Record<string, string> = {
        purchase: 'ক্রয়',
        payment: 'পরিশোধ',
        return: 'ফেরত',
        adjustment: 'সমন্বয়',
        opening: 'ওপেনিং',
      };

      let refNumber: string | undefined;
      try {
        if (r.reference_type === 'purchase' && r.reference_id) {
          const p = db.prepare('SELECT purchase_number FROM purchases WHERE id = ?').get(r.reference_id) as any;
          refNumber = p?.purchase_number;
        }
      } catch {}

      return {
        id: r.id,
        date: r.created_at,
        type: r.transaction_type,
        typeBn: typeBnMap[r.transaction_type] || r.transaction_type,
        amountPaisa: r.amount_paisa,
        referenceType: r.reference_type,
        referenceId: r.reference_id,
        referenceNumber: refNumber,
        notes: r.notes,
        runningBalancePaisa: running,
      };
    });

    return {
      supplierId,
      supplierName: supplier.name,
      openingBalancePaisa: opening,
      closingBalancePaisa: running,
      rows: statementRows,
      totalPurchasesPaisa: totalPurchases,
      totalPaymentsPaisa: totalPayments,
      totalReturnsPaisa: totalReturns,
    };
  }

  // ========== FINANCE REPORTS ==========

  getCashReport(accountId: string, filter: ReportFilter = {}): CashReport {
    const db = getConnection();
    const account = db.prepare('SELECT * FROM cash_accounts WHERE id = ?').get(accountId) as any;
    if (!account) throw new Error('নগদ হিসাব পাওয়া যায়নি');

    const range = resolveDateRange(filter);
    let opening = account.opening_balance_paisa || 0;
    if (range) {
      const beforeRow = db.prepare(`SELECT COALESCE(SUM(amount_paisa),0) as total FROM cash_movements WHERE cash_account_id = ? AND created_at < ?`).get(accountId, range.start) as any;
      opening += beforeRow.total || 0;
    }

    const params: any[] = [accountId];
    let where = ' WHERE cash_account_id = ? ';
    if (range) {
      where += ' AND created_at >= ? AND created_at <= ? ';
      params.push(range.start, range.end);
    }

    const movements = db.prepare(`
      SELECT * FROM cash_movements
      ${where}
      ORDER BY created_at ASC, rowid ASC
    `).all(...params) as any[];

    let sales = 0, collections = 0, transIn = 0, mfsOut = 0, otherIn = 0;
    let supPay = 0, expenses = 0, transOut = 0, mfsIn = 0, otherOut = 0;

    let running = opening;
    const enriched = movements.map(m => {
      running += m.amount_paisa;

      // Categorize
      if (m.movement_type === 'sale') sales += m.amount_paisa;
      else if (m.movement_type === 'customer_collection' || m.movement_type === 'customer_payment') collections += m.amount_paisa;
      else if (m.movement_type === 'transfer_in') transIn += m.amount_paisa;
      else if (m.movement_type === 'mfs_cash_out') mfsOut += m.amount_paisa;
      else if (m.amount_paisa > 0) otherIn += m.amount_paisa;
      else if (m.movement_type === 'supplier_payment') supPay += Math.abs(m.amount_paisa);
      else if (m.movement_type === 'expense') expenses += Math.abs(m.amount_paisa);
      else if (m.movement_type === 'transfer_out') transOut += Math.abs(m.amount_paisa);
      else if (m.movement_type === 'mfs_cash_in') mfsIn += Math.abs(m.amount_paisa);
      else if (m.amount_paisa < 0) otherOut += Math.abs(m.amount_paisa);

      const typeBnMap: Record<string, string> = {
        sale: 'বিক্রয়',
        customer_collection: 'গ্রাহক আদায়',
        customer_payment: 'গ্রাহক আদায়',
        supplier_payment: 'সরবরাহকারী পরিশোধ',
        expense: 'খরচ',
        transfer_in: 'স্থানান্তর ইন',
        transfer_out: 'স্থানান্তর আউট',
        mfs_cash_in: 'MFS ক্যাশ-ইন',
        mfs_cash_out: 'MFS ক্যাশ-আউট',
        opening: 'ওপেনিং',
        sale_return_refund: 'বিক্রয় ফেরত রিফান্ড',
        sale_cancel: 'বিক্রয় বাতিল',
        expense_void: 'খরচ বাতিল',
      };

      return {
        id: m.id,
        date: m.created_at,
        type: m.movement_type,
        typeBn: typeBnMap[m.movement_type] || m.movement_type,
        amountPaisa: m.amount_paisa,
        referenceType: m.reference_type,
        referenceId: m.reference_id,
        notes: m.notes,
        balanceAfterPaisa: running,
      };
    });

    const totalIn = sales + collections + transIn + mfsOut + otherIn;
    const totalOut = supPay + expenses + transOut + mfsIn + otherOut;

    return {
      accountId,
      accountName: account.name,
      openingBalancePaisa: opening,
      inflows: {
        salesPaisa: sales,
        customerCollectionsPaisa: collections,
        transfersInPaisa: transIn,
        mfsCashOutPaisa: mfsOut,
        otherInPaisa: otherIn,
        totalInPaisa: totalIn,
      },
      outflows: {
        supplierPaymentsPaisa: supPay,
        expensesPaisa: expenses,
        transfersOutPaisa: transOut,
        mfsCashInPaisa: mfsIn,
        otherOutPaisa: otherOut,
        totalOutPaisa: totalOut,
      },
      closingBalancePaisa: running,
      movements: enriched,
    };
  }

  getBankReport(accountId: string, filter: ReportFilter = {}): BankReport {
    const db = getConnection();
    const account = db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(accountId) as any;
    if (!account) throw new Error('ব্যাংক হিসাব পাওয়া যায়নি');

    const range = resolveDateRange(filter);
    let opening = account.opening_balance_paisa || 0;
    if (range) {
      const beforeRow = db.prepare(`SELECT COALESCE(SUM(amount_paisa),0) as total FROM bank_transactions WHERE bank_account_id = ? AND created_at < ?`).get(accountId, range.start) as any;
      opening += beforeRow.total || 0;
    }

    const params: any[] = [accountId];
    let where = ' WHERE bank_account_id = ? ';
    if (range) {
      where += ' AND created_at >= ? AND created_at <= ? ';
      params.push(range.start, range.end);
    }

    const movements = db.prepare(`
      SELECT * FROM bank_transactions
      ${where}
      ORDER BY created_at ASC, rowid ASC
    `).all(...params) as any[];

    let sales = 0, transIn = 0, otherIn = 0;
    let supPay = 0, expenses = 0, transOut = 0, otherOut = 0;

    let running = opening;
    const enriched = movements.map(m => {
      running += m.amount_paisa;
      if (m.transaction_type === 'sale') sales += m.amount_paisa;
      else if (m.transaction_type === 'transfer_in') transIn += m.amount_paisa;
      else if (m.amount_paisa > 0) otherIn += m.amount_paisa;
      else if (m.transaction_type === 'supplier_payment') supPay += Math.abs(m.amount_paisa);
      else if (m.transaction_type === 'expense') expenses += Math.abs(m.amount_paisa);
      else if (m.transaction_type === 'transfer_out') transOut += Math.abs(m.amount_paisa);
      else if (m.amount_paisa < 0) otherOut += Math.abs(m.amount_paisa);

      const typeBnMap: Record<string, string> = {
        sale: 'বিক্রয়',
        supplier_payment: 'সরবরাহকারী পরিশোধ',
        expense: 'খরচ',
        transfer_in: 'স্থানান্তর ইন',
        transfer_out: 'স্থানান্তর আউট',
        opening: 'ওপেনিং',
      };

      return {
        id: m.id,
        date: m.created_at,
        type: m.transaction_type,
        typeBn: typeBnMap[m.transaction_type] || m.transaction_type,
        amountPaisa: m.amount_paisa,
        referenceType: m.reference_type,
        referenceId: m.reference_id,
        notes: m.notes,
        balanceAfterPaisa: running,
      };
    });

    return {
      accountId,
      accountName: account.account_name || account.bank_name,
      bankName: account.bank_name,
      openingBalancePaisa: opening,
      inflows: {
        salesPaisa: sales,
        transfersInPaisa: transIn,
        otherInPaisa: otherIn,
        totalInPaisa: sales + transIn + otherIn,
      },
      outflows: {
        supplierPaymentsPaisa: supPay,
        expensesPaisa: expenses,
        transfersOutPaisa: transOut,
        otherOutPaisa: otherOut,
        totalOutPaisa: supPay + expenses + transOut + otherOut,
      },
      closingBalancePaisa: running,
      movements: enriched,
    };
  }

  getMfsReport(accountId: string, filter: ReportFilter = {}): MfsReport {
    const db = getConnection();
    const account = db.prepare('SELECT * FROM mfs_accounts WHERE id = ?').get(accountId) as any;
    if (!account) throw new Error('MFS হিসাব পাওয়া যায়নি');
    const provider = db.prepare('SELECT * FROM mfs_providers WHERE id = ?').get(account.provider_id) as any;

    const range = resolveDateRange(filter);
    let opening = account.opening_balance_paisa || 0;
    if (range) {
      const beforeRow = db.prepare(`SELECT COALESCE(SUM(net_amount_paisa),0) as total FROM mfs_transactions WHERE mfs_account_id = ? AND created_at < ?`).get(accountId, range.start) as any;
      opening += beforeRow.total || 0;
    }

    const params: any[] = [accountId];
    let where = ' WHERE mfs_account_id = ? ';
    if (range) {
      where += ' AND created_at >= ? AND created_at <= ? ';
      params.push(range.start, range.end);
    }

    const movements = db.prepare(`
      SELECT * FROM mfs_transactions
      ${where}
      ORDER BY created_at ASC, rowid ASC
    `).all(...params) as any[];

    let cashIn = 0, cashOut = 0, sales = 0, custPay = 0, charges = 0, commission = 0, transIn = 0, transOut = 0;

    let running = opening;
    const enriched = movements.map(m => {
      running += m.net_amount_paisa;
      if (m.transaction_type === 'cash_in') cashIn += m.net_amount_paisa;
      else if (m.transaction_type === 'cash_out') cashOut += Math.abs(m.net_amount_paisa);
      else if (m.transaction_type === 'sale') sales += m.net_amount_paisa;
      else if (m.transaction_type === 'customer_payment') custPay += m.net_amount_paisa;
      else if (m.transaction_type === 'charge') charges += Math.abs(m.net_amount_paisa);
      else if (m.transaction_type === 'commission') commission += m.net_amount_paisa;
      else if (m.transaction_type === 'transfer_in') transIn += m.net_amount_paisa;
      else if (m.transaction_type === 'transfer_out') transOut += Math.abs(m.net_amount_paisa);

      const typeBnMap: Record<string, string> = {
        cash_in: 'ক্যাশ-ইন',
        cash_out: 'ক্যাশ-আউট',
        sale: 'বিক্রয়',
        customer_payment: 'গ্রাহক আদায়',
        charge: 'চার্জ',
        commission: 'কমিশন',
        transfer_in: 'স্থানান্তর ইন',
        transfer_out: 'স্থানান্তর আউট',
        sale_return_refund: 'বিক্রয় ফেরত',
      };

      return {
        id: m.id,
        date: m.created_at,
        type: m.transaction_type,
        typeBn: typeBnMap[m.transaction_type] || m.transaction_type,
        amountPaisa: m.amount_paisa,
        netAmountPaisa: m.net_amount_paisa,
        commissionPaisa: m.commission_paisa,
        chargePaisa: m.customer_charge_paisa,
        balanceAfterPaisa: running,
        notes: m.notes,
      };
    });

    return {
      accountId,
      accountName: account.account_name || account.account_number,
      accountNumber: account.account_number,
      providerId: account.provider_id,
      providerName: provider?.name || account.provider_id,
      providerNameBn: provider?.name_bn,
      openingBalancePaisa: opening,
      cashInPaisa: cashIn,
      cashOutPaisa: cashOut,
      salesPaisa: sales,
      customerPaymentsPaisa: custPay,
      chargesPaisa: charges,
      commissionPaisa: commission,
      transfersInPaisa: transIn,
      transfersOutPaisa: transOut,
      closingBalancePaisa: running,
      movements: enriched,
    };
  }

  // ========== EXPENSE REPORTS ==========

  getExpenseSummary(filter: ReportFilter = {}): ExpenseSummary {
    const db = getConnection();
    const params: any[] = [];
    let where = ' WHERE 1=1 ';
    if (filter.businessId) {
      where += ' AND business_id = ? ';
      params.push(filter.businessId);
    }
    const range = resolveDateRange(filter);
    if (range) {
      where += ' AND expense_date >= ? AND expense_date <= ? ';
      params.push(range.start, range.end);
    }

    const activeRow = db.prepare(`
      SELECT COUNT(*) as cnt, COALESCE(SUM(amount_paisa),0) as total
      FROM expenses
      ${where} AND status != 'voided'
    `).get(...params) as any;

    const voidedRow = db.prepare(`
      SELECT COUNT(*) as cnt, COALESCE(SUM(amount_paisa),0) as total
      FROM expenses
      ${where} AND status = 'voided'
    `).get(...params) as any;

    const totalRow = db.prepare(`
      SELECT COUNT(*) as cnt, COALESCE(SUM(amount_paisa),0) as total
      FROM expenses
      ${where}
    `).get(...params) as any;

    return {
      expenseCount: totalRow.cnt || 0,
      totalExpensePaisa: totalRow.total || 0,
      voidedCount: voidedRow.cnt || 0,
      voidedAmountPaisa: voidedRow.total || 0,
      activeExpensePaisa: activeRow.total || 0,
    };
  }

  getExpenseByCategory(filter: ReportFilter = {}): ExpenseByCategoryRow[] {
    const db = getConnection();
    const params: any[] = [];
    let where = ' WHERE 1=1 ';
    if (filter.businessId) {
      where += ' AND e.business_id = ? ';
      params.push(filter.businessId);
    }
    const range = resolveDateRange(filter);
    if (range) {
      where += ' AND e.expense_date >= ? AND e.expense_date <= ? ';
      params.push(range.start, range.end);
    }
    where += " AND e.status != 'voided' ";

    const rows = db.prepare(`
      SELECT
        c.id as categoryId,
        c.name as categoryName,
        c.name_bn as categoryNameBn,
        COUNT(e.id) as cnt,
        COALESCE(SUM(e.amount_paisa),0) as amount
      FROM expenses e
      JOIN expense_categories c ON c.id = e.category_id
      ${where}
      GROUP BY c.id
      ORDER BY amount DESC
    `).all(...params) as any[];

    const total = rows.reduce((sum: number, r: any) => sum + (r.amount || 0), 0);

    return rows.map(r => ({
      categoryId: r.categoryId,
      categoryName: r.categoryName,
      categoryNameBn: r.categoryNameBn,
      count: r.cnt,
      amountPaisa: r.amount,
      percentage: total > 0 ? Math.round((r.amount / total) * 10000) / 100 : 0,
    }));
  }

  getExpenseReport(filter: ReportFilter = {}): ExpenseReportRow[] {
    const db = getConnection();
    const params: any[] = [];
    let where = ' WHERE 1=1 ';
    if (filter.businessId) {
      where += ' AND e.business_id = ? ';
      params.push(filter.businessId);
    }
    const range = resolveDateRange(filter);
    if (range) {
      where += ' AND e.expense_date >= ? AND e.expense_date <= ? ';
      params.push(range.start, range.end);
    }

    const rows = db.prepare(`
      SELECT
        e.id as id,
        e.expense_number as expenseNumber,
        e.expense_date as date,
        c.name as categoryName,
        e.amount_paisa as amountPaisa,
        e.payment_method as paymentMethod,
        e.status as status,
        e.notes as notes,
        ca.name as cashAccountName,
        ba.bank_name as bankAccountName,
        ma.account_number as mfsAccountName
      FROM expenses e
      JOIN expense_categories c ON c.id = e.category_id
      LEFT JOIN cash_accounts ca ON ca.id = e.cash_account_id
      LEFT JOIN bank_accounts ba ON ba.id = e.bank_account_id
      LEFT JOIN mfs_accounts ma ON ma.id = e.mfs_account_id
      ${where}
      ORDER BY e.expense_date DESC
      LIMIT ? OFFSET ?
    `).all(...params, filter.limit || 200, filter.offset || 0) as any[];

    return rows.map(r => ({
      id: r.id,
      expenseNumber: r.expenseNumber,
      date: r.date,
      categoryName: r.categoryName,
      amountPaisa: r.amountPaisa,
      paymentMethod: r.paymentMethod,
      status: r.status,
      notes: r.notes,
      cashAccountName: r.cashAccountName,
      bankAccountName: r.bankAccountName,
      mfsAccountName: r.mfsAccountName,
    }));
  }

  // ========== SHIFT REPORTS ==========

  getShiftReport(filter: ReportFilter = {}): ShiftReportRow[] {
    const db = getConnection();
    const params: any[] = [];
    let where = ' WHERE 1=1 ';
    if (filter.businessId) {
      where += ' AND s.business_id = ? ';
      params.push(filter.businessId);
    }
    const range = resolveDateRange(filter);
    if (range) {
      where += ' AND s.opened_at >= ? AND s.opened_at <= ? ';
      params.push(range.start, range.end);
    }
    if (filter.userId) {
      where += ' AND s.opened_by_user_id = ? ';
      params.push(filter.userId);
    }

    const rows = db.prepare(`
      SELECT
        s.id as id,
        s.shift_number as shiftNumber,
        s.opened_by_user_id as cashierId,
        u.name as cashierName,
        s.cash_account_id as cashAccountId,
        ca.name as cashAccountName,
        s.opened_at as openedAt,
        s.closed_at as closedAt,
        s.opening_cash_paisa as openingCash,
        s.expected_cash_paisa as expectedCash,
        s.actual_cash_paisa as actualCash,
        s.variance_paisa as variance,
        s.total_sales_paisa as totalSales,
        s.status as status,
        s.notes as notes
      FROM shifts s
      LEFT JOIN users u ON u.id = s.opened_by_user_id
      LEFT JOIN cash_accounts ca ON ca.id = s.cash_account_id
      ${where}
      ORDER BY s.opened_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, filter.limit || 100, filter.offset || 0) as any[];

    return rows.map(r => ({
      id: r.id,
      shiftNumber: r.shiftNumber,
      cashierId: r.cashierId,
      cashierName: r.cashierName || r.cashierId,
      cashAccountId: r.cashAccountId,
      cashAccountName: r.cashAccountName,
      openedAt: r.openedAt,
      closedAt: r.closedAt,
      openingCashPaisa: r.openingCash,
      expectedCashPaisa: r.expectedCash,
      actualCashPaisa: r.actualCash,
      variancePaisa: r.variance,
      totalSalesPaisa: r.totalSales,
      status: r.status,
      notes: r.notes,
    }));
  }

  // ========== PROFITABILITY ==========

  getProfitLoss(filter: ReportFilter = {}): ProfitLossReport {
    const db = getConnection();
    const salesSummary = this.getSalesSummary(filter);
    const expenseSummary = this.getExpenseSummary(filter);
    const expenseByCat = this.getExpenseByCategory(filter);

    // COGS from sale_items immutable cost snapshots
    const params: any[] = [];
    let where = ' WHERE 1=1 ';
    if (filter.businessId) {
      where += ' AND s.business_id = ? ';
      params.push(filter.businessId);
    }
    const range = resolveDateRange(filter);
    if (range) {
      where += ' AND s.sale_date >= ? AND s.sale_date <= ? ';
      params.push(range.start, range.end);
    }
    where += " AND s.status NOT IN ('cancelled','voided') ";

    const cogsRow = db.prepare(`
      SELECT COALESCE(SUM(si.line_cost_total_paisa),0) as cogs
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      ${where}
    `).get(...params) as any;

    // COGS for returns (should reduce COGS? Actually return restocks, but for P&L, return reduces revenue and COGS)
    const retCogsParams: any[] = [];
    let retWhere = ' WHERE 1=1 ';
    if (filter.businessId) {
      retWhere += ' AND sr.business_id = ? ';
      retCogsParams.push(filter.businessId);
    }
    if (range) {
      retWhere += ' AND sr.return_date >= ? AND sr.return_date <= ? ';
      retCogsParams.push(range.start, range.end);
    }
    const retCogsRow = db.prepare(`
      SELECT COALESCE(SUM(sri.cost_paisa * (sri.base_quantity_milli / 1000.0)),0) as retCogs
      FROM sale_return_items sri
      JOIN sale_returns sr ON sr.id = sri.return_id
      ${retWhere}
    `).get(...retCogsParams) as any;

    const grossSales = salesSummary.grossSalesPaisa;
    const discounts = salesSummary.discountPaisa;
    const returns = salesSummary.returnPaisa;
    const netSales = salesSummary.netSalesPaisa - returns; // net after returns
    // For P&L, revenue = gross - discounts - returns? Let's define clearly:
    // gross sales = sum subtotal (before sale discount)
    // net sales = gross - sale discounts - returns? Our sales table already has discount subtracted in total. So:
    // Let's use: gross = subtotal, net = total - returns
    const cogs = Math.round((cogsRow.cogs || 0) - (retCogsRow.retCogs || 0));
    const grossProfit = netSales - cogs;
    const operatingExpenses = expenseSummary.activeExpensePaisa;
    const netProfit = grossProfit - operatingExpenses;

    const grossMargin = netSales > 0 ? (grossProfit / netSales) * 100 : null;
    const netMargin = netSales > 0 ? (netProfit / netSales) * 100 : null;

    const period = filter.dateRange || getDateRange('thisMonth');

    return {
      revenue: {
        grossSalesPaisa: grossSales,
        discountsPaisa: discounts,
        returnsPaisa: returns,
        netSalesPaisa: netSales,
      },
      cogs: {
        cogsPaisa: cogs,
      },
      grossProfit: {
        grossProfitPaisa: grossProfit,
        marginPercent: grossMargin !== null ? Math.round(grossMargin * 100) / 100 : null,
      },
      expenses: {
        operatingExpensesPaisa: operatingExpenses,
        expenseByCategory: expenseByCat,
      },
      netProfit: {
        netProfitPaisa: netProfit,
        marginPercent: netMargin !== null ? Math.round(netMargin * 100) / 100 : null,
      },
      period,
    };
  }

  // ========== DASHBOARD ==========

  getDashboardMetrics(filter: ReportFilter = {}): DashboardMetrics {
    const db = getConnection();
    const businessId = filter.businessId;

    // Today range
    const todayRange = getDateRange('today');
    const todayFilter: ReportFilter = { ...filter, dateRange: todayRange };

    const salesSummaryToday = this.getSalesSummary(todayFilter);
    const expenseSummaryToday = this.getExpenseSummary(todayFilter);

    // COGS today for gross profit
    const params: any[] = [];
    let where = ' WHERE 1=1 ';
    if (businessId) {
      where += ' AND s.business_id = ? ';
      params.push(businessId);
    }
    where += ' AND s.sale_date >= ? AND s.sale_date <= ? ';
    params.push(todayRange.start, todayRange.end);
    where += " AND s.status NOT IN ('cancelled','voided') ";

    const cogsRow = db.prepare(`
      SELECT COALESCE(SUM(si.line_cost_total_paisa),0) as cogs
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      ${where}
    `).get(...params) as any;

    const grossProfitToday = (salesSummaryToday.netSalesPaisa - salesSummaryToday.returnPaisa) - (cogsRow.cogs || 0);

    // Receivable / Payable
    const receivableParams: any[] = [];
    let receivableWhere = ' WHERE deleted_at IS NULL ';
    if (businessId) {
      receivableWhere += ' AND business_id = ? ';
      receivableParams.push(businessId);
    }
    const receivableRow = db.prepare(`
      SELECT COALESCE(SUM(current_due_paisa),0) as total FROM customers
      ${receivableWhere}
    `).get(...receivableParams) as any;

    const payableParams: any[] = [];
    let payableWhere = ' WHERE deleted_at IS NULL ';
    if (businessId) {
      payableWhere += ' AND business_id = ? ';
      payableParams.push(businessId);
    }
    const payableRow = db.prepare(`
      SELECT COALESCE(SUM(current_payable_paisa),0) as total FROM suppliers
      ${payableWhere}
    `).get(...payableParams) as any;

    // Low stock count
    const lowStock = this.getLowStock({ businessId, limit: 10000 });
    const stockValuation = this.getStockValuation({ businessId });

    // Cash balance total
    const cashParams: any[] = [];
    let cashWhere = ' WHERE is_active = 1 ';
    if (businessId) {
      cashWhere += ' AND business_id = ? ';
      cashParams.push(businessId);
    }
    const cashRow = db.prepare(`
      SELECT COALESCE(SUM(current_balance_paisa),0) as total FROM cash_accounts
      ${cashWhere}
    `).get(...cashParams) as any;

    // Counts
    const prodParams: any[] = [];
    let prodWhere = ' WHERE deleted_at IS NULL ';
    if (businessId) {
      prodWhere += ' AND business_id = ? ';
      prodParams.push(businessId);
    }
    const prodCountRow = db.prepare(`SELECT COUNT(*) as cnt FROM products ${prodWhere}`).get(...prodParams) as any;
    const custCountRow = db.prepare(`SELECT COUNT(*) as cnt FROM customers ${receivableWhere}`).get(...receivableParams) as any;
    const supCountRow = db.prepare(`SELECT COUNT(*) as cnt FROM suppliers ${payableWhere}`).get(...payableParams) as any;

    // Recent sales
    const recentSalesParams: any[] = [];
    let recentSalesWhere = " WHERE s.status NOT IN ('cancelled','voided') ";
    if (businessId) {
      recentSalesWhere += ' AND s.business_id = ? ';
      recentSalesParams.push(businessId);
    }
    const recentSales = db.prepare(`
      SELECT s.id as id, s.sale_number as saleNumber, s.total_paisa as totalPaisa, s.created_at as createdAt, c.name as customerName
      FROM sales s
      LEFT JOIN customers c ON c.id = s.customer_id
      ${recentSalesWhere}
      ORDER BY s.created_at DESC LIMIT 5
    `).all(...recentSalesParams) as any[];

    // Recent expenses
    const recentExpParams: any[] = [];
    let recentExpWhere = ' WHERE 1=1 ';
    if (businessId) {
      recentExpWhere += ' AND e.business_id = ? ';
      recentExpParams.push(businessId);
    }
    const recentExpenses = db.prepare(`
      SELECT e.id as id, e.expense_number as expenseNumber, e.amount_paisa as amountPaisa, e.created_at as createdAt, c.name as categoryName
      FROM expenses e
      JOIN expense_categories c ON c.id = e.category_id
      ${recentExpWhere}
      ORDER BY e.created_at DESC LIMIT 5
    `).all(...recentExpParams) as any[];

    // Sales trend last 7 days
    const trend: DashboardMetrics['salesTrend'] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(d);
      dayEnd.setHours(23, 59, 59, 999);
      const dayParams: any[] = [dayStart.getTime(), dayEnd.getTime()];
      let dayWhere = ' WHERE sale_date >= ? AND sale_date <= ? AND status NOT IN (\'cancelled\',\'voided\') ';
      if (businessId) {
        dayWhere = ' WHERE business_id = ? AND sale_date >= ? AND sale_date <= ? AND status NOT IN (\'cancelled\',\'voided\') ';
        dayParams.unshift(businessId);
      }
      const dayRow = db.prepare(`
        SELECT COALESCE(SUM(total_paisa),0) as sales, COUNT(*) as cnt
        FROM sales
        ${dayWhere}
      `).get(...dayParams) as any;
      trend.push({
        date: dayStart.toISOString().split('T')[0],
        label: dayStart.toLocaleDateString('bn-BD', { weekday: 'short' }),
        salesPaisa: dayRow.sales || 0,
        transactionCount: dayRow.cnt || 0,
      });
    }

    const paymentMix = this.getSalesByPaymentMethod({ businessId, dateRange: getDateRange('thisMonth') });
    const topProducts = this.getSalesByProduct({ businessId, dateRange: getDateRange('thisMonth') }).slice(0, 5);

    return {
      today: {
        salesPaisa: salesSummaryToday.netSalesPaisa,
        transactionCount: salesSummaryToday.transactionCount,
        grossProfitPaisa: grossProfitToday,
        expensePaisa: expenseSummaryToday.activeExpensePaisa,
        cashBalancePaisa: cashRow.total || 0,
      },
      receivablePaisa: receivableRow.total || 0,
      payablePaisa: payableRow.total || 0,
      lowStockCount: lowStock.length,
      totalStockValuePaisa: stockValuation.totalValuePaisa,
      totalProducts: prodCountRow.cnt || 0,
      totalCustomers: custCountRow.cnt || 0,
      totalSuppliers: supCountRow.cnt || 0,
      recentSales: recentSales.map(r => ({
        id: r.id,
        saleNumber: r.saleNumber,
        totalPaisa: r.totalPaisa,
        createdAt: r.createdAt,
        customerName: r.customerName,
      })),
      recentExpenses: recentExpenses.map(r => ({
        id: r.id,
        expenseNumber: r.expenseNumber,
        amountPaisa: r.amountPaisa,
        createdAt: r.createdAt,
        categoryName: r.categoryName,
      })),
      salesTrend: trend,
      paymentMix,
      topProducts,
      lowStockProducts: lowStock.slice(0, 5),
    };
  }
}
