import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { formatBDT, formatBDTEn, formatQtyEn, formatDate, formatPercent } from '../../lib/format';
import { BarChart3, Calendar, Download, Printer, TrendingUp, ShoppingCart, Package, Users, Building2, Wallet, Receipt, Clock, AlertTriangle, DollarSign } from 'lucide-react';

type TabKey = 'sales' | 'purchase' | 'inventory' | 'customer' | 'supplier' | 'finance' | 'expense' | 'profit' | 'shift';
type DatePreset = 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'prevMonth' | 'custom';

interface ReportsScreenProps {
  businessId: string;
}

const PRESET_LABELS: Record<DatePreset, string> = {
  today: 'আজ',
  yesterday: 'গতকাল',
  thisWeek: 'এই সপ্তাহ',
  thisMonth: 'এই মাস',
  prevMonth: 'গত মাস',
  custom: 'কাস্টম',
};

function getRangeMs(preset: DatePreset, customFrom?: string, customTo?: string) {
  const now = new Date();
  let start: Date, end: Date;
  switch (preset) {
    case 'today': start = new Date(now); start.setHours(0,0,0,0); end = new Date(now); end.setHours(23,59,59,999); break;
    case 'yesterday': { const y = new Date(now); y.setDate(y.getDate()-1); start = new Date(y); start.setHours(0,0,0,0); end = new Date(y); end.setHours(23,59,59,999); break; }
    case 'thisWeek': { start = new Date(now); const day = start.getDay(); const diff = start.getDate() - day + (day===0?-6:1); start.setDate(diff); start.setHours(0,0,0,0); end = new Date(now); end.setHours(23,59,59,999); break; }
    case 'thisMonth': start = new Date(now.getFullYear(), now.getMonth(), 1,0,0,0,0); end = new Date(now.getFullYear(), now.getMonth()+1, 0,23,59,59,999); break;
    case 'prevMonth': start = new Date(now.getFullYear(), now.getMonth()-1, 1,0,0,0,0); end = new Date(now.getFullYear(), now.getMonth(), 0,23,59,59,999); break;
    case 'custom': {
      if (customFrom && customTo) { start = new Date(customFrom); start.setHours(0,0,0,0); end = new Date(customTo); end.setHours(23,59,59,999); }
      else { start = new Date(now); start.setHours(0,0,0,0); end = new Date(now); end.setHours(23,59,59,999); }
      break;
    }
    default: start = new Date(now); start.setHours(0,0,0,0); end = new Date(now); end.setHours(23,59,59,999);
  }
  return { from: start.getTime(), to: end.getTime() };
}

const EmptyState: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <BarChart3 size={32} className="text-text-tertiary mb-3" />
    <p className="text-body text-text-secondary">এই সময়সীমায় কোনো তথ্য পাওয়া যায়নি।</p>
    <p className="text-caption text-text-tertiary mt-1">ফিল্টার পরিবর্তন করে আবার চেষ্টা করুন</p>
  </div>
);

export const ReportsScreen: React.FC<ReportsScreenProps> = ({ businessId }) => {
  const [activeTab, setActiveTab] = useState<TabKey>('sales');
  const [preset, setPreset] = useState<DatePreset>('thisMonth');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [salesSummary, setSalesSummary] = useState<any>(null);
  const [salesByProduct, setSalesByProduct] = useState<any[]>([]);
  const [salesByCategory, setSalesByCategory] = useState<any[]>([]);
  const [salesByCashier, setSalesByCashier] = useState<any[]>([]);
  const [salesByPayment, setSalesByPayment] = useState<any[]>([]);
  const [purchaseSummary, setPurchaseSummary] = useState<any>(null);
  const [purchaseBySupplier, setPurchaseBySupplier] = useState<any[]>([]);
  const [purchaseByProduct, setPurchaseByProduct] = useState<any[]>([]);
  const [stockRows, setStockRows] = useState<any[]>([]);
  const [lowStockRows, setLowStockRows] = useState<any[]>([]);
  const [stockValuation, setStockValuation] = useState<any>(null);
  const [stockMovements, setStockMovements] = useState<any[]>([]);
  const [customerDue, setCustomerDue] = useState<any[]>([]);
  const [supplierPayable, setSupplierPayable] = useState<any[]>([]);
  const [expenseSummary, setExpenseSummary] = useState<any>(null);
  const [expenseByCat, setExpenseByCat] = useState<any[]>([]);
  const [expenseList, setExpenseList] = useState<any[]>([]);
  const [shiftReport, setShiftReport] = useState<any[]>([]);
  const [profitLoss, setProfitLoss] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { from, to } = getRangeMs(preset, customFrom, customTo);
      const base = { businessId, fromDate: from, toDate: to };

      if (activeTab === 'sales') {
        const [sum, byProd, byCat, byCashier, byPay] = await Promise.all([
          (window as any).merqo.report.salesSummary(base),
          (window as any).merqo.report.salesByProduct(base),
          (window as any).merqo.report.salesByCategory(base),
          (window as any).merqo.report.salesByCashier(base),
          (window as any).merqo.report.salesByPayment(base),
        ]);
        if (!sum.success) throw new Error(sum.error?.messageBn || 'লোড ব্যর্থ');
        setSalesSummary(sum.data);
        setSalesByProduct(byProd.success ? byProd.data : []);
        setSalesByCategory(byCat.success ? byCat.data : []);
        setSalesByCashier(byCashier.success ? byCashier.data : []);
        setSalesByPayment(byPay.success ? byPay.data : []);
      } else if (activeTab === 'purchase') {
        const [sum, bySup, byProd] = await Promise.all([
          (window as any).merqo.report.purchaseSummary(base),
          (window as any).merqo.report.purchaseBySupplier(base),
          (window as any).merqo.report.purchaseByProduct(base),
        ]);
        if (!sum.success) throw new Error(sum.error?.messageBn || 'লোড ব্যর্থ');
        setPurchaseSummary(sum.data);
        setPurchaseBySupplier(bySup.success ? bySup.data : []);
        setPurchaseByProduct(byProd.success ? byProd.data : []);
      } else if (activeTab === 'inventory') {
        const [stock, low, valuation, movements] = await Promise.all([
          (window as any).merqo.report.inventoryStock({ businessId, limit: 500 }),
          (window as any).merqo.report.lowStock({ businessId, limit: 500 }),
          (window as any).merqo.report.stockValuation({ businessId }),
          (window as any).merqo.report.stockMovements({ ...base, limit: 200 }),
        ]);
        setStockRows(stock.success ? stock.data : []);
        setLowStockRows(low.success ? low.data : []);
        setStockValuation(valuation.success ? valuation.data : null);
        setStockMovements(movements.success ? movements.data : []);
      } else if (activeTab === 'customer') {
        const due = await (window as any).merqo.report.customerDue(base);
        setCustomerDue(due.success ? due.data : []);
      } else if (activeTab === 'supplier') {
        const pay = await (window as any).merqo.report.supplierPayable(base);
        setSupplierPayable(pay.success ? pay.data : []);
      } else if (activeTab === 'finance') {
        // Finance overview handled via cash/bank accounts screens; here show empty or note
      } else if (activeTab === 'expense') {
        const [sum, byCat, list] = await Promise.all([
          (window as any).merqo.report.expenseSummary(base),
          (window as any).merqo.report.expenseByCategory(base),
          (window as any).merqo.report.expenseList({ ...base, limit: 200 }),
        ]);
        setExpenseSummary(sum.success ? sum.data : null);
        setExpenseByCat(byCat.success ? byCat.data : []);
        setExpenseList(list.success ? list.data : []);
      } else if (activeTab === 'shift') {
        const shifts = await (window as any).merqo.report.shift({ ...base, limit: 100 });
        setShiftReport(shifts.success ? shifts.data : []);
      } else if (activeTab === 'profit') {
        const pl = await (window as any).merqo.report.profitLoss(base);
        if (!pl.success) throw new Error(pl.error?.messageBn || 'লোড ব্যর্থ');
        setProfitLoss(pl.data);
      }
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, preset, businessId]);

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    // Basic CSV export of current visible data — offline, no external lib
    let csv = '';
    const filename = `report-${activeTab}-${new Date().toISOString().split('T')[0]}.csv`;
    try {
      if (activeTab === 'sales' && salesByProduct.length > 0) {
        csv = 'পণ্য,SKU,পরিমাণ,নিট বিক্রয়,COGS,মুনাফা\n';
        salesByProduct.forEach((r: any) => {
          csv += `"${r.productName}","${r.sku || ''}",${r.quantityUnits},${r.netSalesPaisa/100},${r.cogsPaisa/100},${r.grossProfitPaisa/100}\n`;
        });
      } else if (activeTab === 'purchase' && purchaseByProduct.length > 0) {
        csv = 'পণ্য,SKU,পরিমাণ,ক্রয় খরচ,গড় খরচ\n';
        purchaseByProduct.forEach((r: any) => {
          csv += `"${r.productName}","${r.sku || ''}",${r.quantityUnits},${r.purchaseCostPaisa/100},${r.avgCostPaisa/100}\n`;
        });
      } else {
        csv = 'এই ট্যাবের জন্য CSV রপ্তানি প্রস্তুত নয়\n';
      }
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export failed', e);
    }
  };

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'sales', label: 'বিক্রয়', icon: <ShoppingCart size={16} /> },
    { key: 'purchase', label: 'ক্রয়', icon: <Building2 size={16} /> },
    { key: 'inventory', label: 'স্টক', icon: <Package size={16} /> },
    { key: 'customer', label: 'গ্রাহক বকেয়া', icon: <Users size={16} /> },
    { key: 'supplier', label: 'সরবরাহকারী দেনা', icon: <Building2 size={16} /> },
    { key: 'expense', label: 'খরচ', icon: <Receipt size={16} /> },
    { key: 'profit', label: 'লাভ-ক্ষতি', icon: <TrendingUp size={16} /> },
    { key: 'shift', label: 'শিফট', icon: <Clock size={16} /> },
  ];

  return (
    <div className="space-y-4 max-w-[1600px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-text-primary flex items-center gap-2"><BarChart3 size={24} /> রিপোর্ট ও বিশ্লেষণ</h1>
          <p className="text-body-sm text-text-secondary mt-1">অফলাইন রিড-অনলি রিপোর্ট — বাস্তব ডেটা, কোনো ডেমো নেই</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleExport}><Download size={16} /> রপ্তানি</Button>
          <Button variant="secondary" size="sm" onClick={handlePrint}><Printer size={16} /> প্রিন্ট</Button>
        </div>
      </div>

      {/* Date Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 text-body-sm text-text-secondary"><Calendar size={16} /> সময়সীমা:</div>
            {(Object.keys(PRESET_LABELS) as DatePreset[]).map(p => (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className={`px-3 py-1.5 rounded-sm text-body-sm font-medium transition-colors border ${preset === p ? 'bg-primary-500 text-white border-primary-500' : 'bg-surface border-border text-text-secondary hover:bg-subtle'}`}
              >
                {PRESET_LABELS[p]}
              </button>
            ))}
            {preset === 'custom' && (
              <>
                <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="w-40" />
                <span className="text-body-sm">থেকে</span>
                <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="w-40" />
                <Button size="sm" onClick={load}>প্রয়োগ</Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-border pb-1">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-t-sm text-body-sm font-medium transition-colors ${activeTab === t.key ? 'bg-primary-50 text-primary-600 border-b-2 border-primary-500' : 'text-text-secondary hover:bg-subtle'}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-body-sm text-text-secondary">লোড হচ্ছে...</span>
        </div>
      )}

      {error && (
        <Card className="border-danger-200 bg-danger-50">
          <CardContent className="pt-4 flex items-center gap-2 text-danger-600"><AlertTriangle size={18} /> {error}</CardContent>
        </Card>
      )}

      {!loading && !error && (
        <>
          {activeTab === 'sales' && (
            <div className="space-y-4">
              {salesSummary ? (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  <Card><CardContent className="pt-4"><p className="text-caption text-text-tertiary">মোট বিক্রয়</p><p className="text-h3 font-semibold mt-1">{formatBDT(salesSummary.netSalesPaisa)}</p><p className="text-caption text-text-tertiary mt-1">{salesSummary.transactionCount} টি লেনদেন</p></CardContent></Card>
                  <Card><CardContent className="pt-4"><p className="text-caption text-text-tertiary">ছাড়</p><p className="text-h3 font-semibold mt-1">{formatBDT(salesSummary.discountPaisa)}</p></CardContent></Card>
                  <Card><CardContent className="pt-4"><p className="text-caption text-text-tertiary">ফেরত</p><p className="text-h3 font-semibold mt-1">{formatBDT(salesSummary.returnPaisa)}</p></CardContent></Card>
                  <Card><CardContent className="pt-4"><p className="text-caption text-text-tertiary">নিট (ফেরত পর)</p><p className="text-h3 font-semibold mt-1 text-primary-600">{formatBDT(salesSummary.netSalesAfterReturnPaisa)}</p></CardContent></Card>
                  <Card><CardContent className="pt-4"><p className="text-caption text-text-tertiary">পরিশোধিত</p><p className="text-h3 font-semibold mt-1">{formatBDT(salesSummary.paidPaisa)}</p></CardContent></Card>
                  <Card><CardContent className="pt-4"><p className="text-caption text-text-tertiary">বকেয়া</p><p className="text-h3 font-semibold mt-1 text-warning-600">{formatBDT(salesSummary.duePaisa)}</p></CardContent></Card>
                </div>
              ) : <EmptyState />}

              {/* Sales by product */}
              <Card>
                <CardHeader><CardTitle>পণ্য অনুযায়ী বিক্রয় (COGS স্ন্যাপশট)</CardTitle></CardHeader>
                <CardContent>
                  {salesByProduct.length === 0 ? <EmptyState /> : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-body-sm">
                        <thead><tr className="border-b text-text-tertiary text-left"><th className="py-2 px-2">পণ্য</th><th className="py-2 px-2">পরিমাণ</th><th className="py-2 px-2">নিট বিক্রয়</th><th className="py-2 px-2">COGS</th><th className="py-2 px-2">মুনাফা</th><th className="py-2 px-2">মার্জিন</th></tr></thead>
                        <tbody>
                          {salesByProduct.map((r: any) => (
                            <tr key={r.productId} className="border-b hover:bg-subtle">
                              <td className="py-2 px-2"><div className="font-medium">{r.productName}</div><div className="text-caption text-text-tertiary">{r.sku}</div></td>
                              <td className="py-2 px-2">{formatQtyEn(r.quantityMilli)}</td>
                              <td className="py-2 px-2">{formatBDTEn(r.netSalesPaisa)}</td>
                              <td className="py-2 px-2">{formatBDTEn(r.cogsPaisa)}</td>
                              <td className="py-2 px-2 text-success-600">{formatBDTEn(r.grossProfitPaisa)}</td>
                              <td className="py-2 px-2">{formatPercent(r.marginPercent)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader><CardTitle>ক্যাটাগরি অনুযায়ী</CardTitle></CardHeader>
                  <CardContent>
                    {salesByCategory.length === 0 ? <EmptyState /> : (
                      <table className="w-full text-body-sm">
                        <thead><tr className="border-b text-text-tertiary text-left"><th className="py-2">ক্যাটাগরি</th><th className="py-2">বিক্রয়</th><th className="py-2">মুনাফা</th></tr></thead>
                        <tbody>{salesByCategory.map((r: any) => (<tr key={r.categoryId} className="border-b"><td className="py-2">{r.categoryName}</td><td className="py-2">{formatBDTEn(r.salesPaisa)}</td><td className="py-2">{formatBDTEn(r.grossProfitPaisa)}</td></tr>))}</tbody>
                      </table>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>ক্যাশিয়ার অনুযায়ী</CardTitle></CardHeader>
                  <CardContent>
                    {salesByCashier.length === 0 ? <EmptyState /> : (
                      <table className="w-full text-body-sm">
                        <thead><tr className="border-b text-text-tertiary text-left"><th className="py-2">ক্যাশিয়ার</th><th className="py-2">লেনদেন</th><th className="py-2">বিক্রয়</th><th className="py-2">ফেরত</th></tr></thead>
                        <tbody>{salesByCashier.map((r: any) => (<tr key={r.cashierId} className="border-b"><td className="py-2">{r.cashierName}</td><td className="py-2">{r.transactionCount}</td><td className="py-2">{formatBDTEn(r.salesPaisa)}</td><td className="py-2">{formatBDTEn(r.returnPaisa)}</td></tr>))}</tbody>
                      </table>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader><CardTitle>পেমেন্ট পদ্ধতি অনুযায়ী</CardTitle></CardHeader>
                <CardContent>
                  {salesByPayment.length === 0 ? <EmptyState /> : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {salesByPayment.map((r: any) => (
                        <div key={r.method} className="border border-border rounded-sm p-3">
                          <p className="text-caption text-text-tertiary">{r.methodLabelBn}</p>
                          <p className="text-h3 font-semibold mt-1">{formatBDTEn(r.amountPaisa)}</p>
                          <p className="text-caption text-text-tertiary mt-1">{r.count} টি • {formatPercent(r.percentage)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'purchase' && (
            <div className="space-y-4">
              {purchaseSummary ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card><CardContent className="pt-4"><p className="text-caption text-text-tertiary">মোট ক্রয়</p><p className="text-h3 font-semibold mt-1">{formatBDT(purchaseSummary.totalPaisa)}</p><p className="text-caption">{purchaseSummary.purchaseCount} টি</p></CardContent></Card>
                  <Card><CardContent className="pt-4"><p className="text-caption text-text-tertiary">পরিশোধ</p><p className="text-h3 font-semibold mt-1">{formatBDT(purchaseSummary.paidPaisa)}</p></CardContent></Card>
                  <Card><CardContent className="pt-4"><p className="text-caption text-text-tertiary">বকেয়া</p><p className="text-h3 font-semibold mt-1">{formatBDT(purchaseSummary.duePaisa)}</p></CardContent></Card>
                  <Card><CardContent className="pt-4"><p className="text-caption text-text-tertiary">ফেরত</p><p className="text-h3 font-semibold mt-1">{formatBDT(purchaseSummary.returnPaisa)}</p></CardContent></Card>
                </div>
              ) : <EmptyState />}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader><CardTitle>সরবরাহকারী অনুযায়ী</CardTitle></CardHeader>
                  <CardContent>
                    {purchaseBySupplier.length === 0 ? <EmptyState /> : (
                      <table className="w-full text-body-sm">
                        <thead><tr className="border-b text-text-tertiary text-left"><th className="py-2">সরবরাহকারী</th><th className="py-2">পরিমাণ</th><th className="py-2">পরিশোধ</th><th className="py-2">বকেয়া</th></tr></thead>
                        <tbody>{purchaseBySupplier.map((r: any) => (<tr key={r.supplierId} className="border-b"><td className="py-2">{r.supplierName}</td><td className="py-2">{formatBDTEn(r.purchaseAmountPaisa)}</td><td className="py-2">{formatBDTEn(r.paidPaisa)}</td><td className="py-2">{formatBDTEn(r.payablePaisa)}</td></tr>))}</tbody>
                      </table>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>পণ্য অনুযায়ী ক্রয়</CardTitle></CardHeader>
                  <CardContent>
                    {purchaseByProduct.length === 0 ? <EmptyState /> : (
                      <table className="w-full text-body-sm">
                        <thead><tr className="border-b text-text-tertiary text-left"><th className="py-2">পণ্য</th><th className="py-2">পরিমাণ</th><th className="py-2">মোট খরচ</th><th className="py-2">গড়</th></tr></thead>
                        <tbody>{purchaseByProduct.map((r: any) => (<tr key={r.productId} className="border-b"><td className="py-2">{r.productName}</td><td className="py-2">{formatQtyEn(r.quantityMilli)}</td><td className="py-2">{formatBDTEn(r.purchaseCostPaisa)}</td><td className="py-2">{formatBDTEn(r.avgCostPaisa)}</td></tr>))}</tbody>
                      </table>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {activeTab === 'inventory' && (
            <div className="space-y-4">
              {stockValuation && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card><CardContent className="pt-4"><p className="text-caption">মোট পণ্য</p><p className="text-h3 font-semibold">{stockValuation.totalProducts}</p></CardContent></Card>
                  <Card><CardContent className="pt-4"><p className="text-caption">মোট মূল্য (WAC)</p><p className="text-h3 font-semibold">{formatBDT(stockValuation.totalValuePaisa)}</p></CardContent></Card>
                  <Card><CardContent className="pt-4"><p className="text-caption">কম স্টক</p><p className="text-h3 font-semibold text-warning-600">{stockValuation.lowStockCount}</p></CardContent></Card>
                  <Card><CardContent className="pt-4"><p className="text-caption">স্টক নেই</p><p className="text-h3 font-semibold text-danger-600">{stockValuation.outOfStockCount}</p></CardContent></Card>
                </div>
              )}

              <Card>
                <CardHeader><CardTitle>বর্তমান স্টক</CardTitle></CardHeader>
                <CardContent>
                  {stockRows.length === 0 ? <EmptyState /> : (
                    <div className="overflow-x-auto max-h-[400px]">
                      <table className="w-full text-body-sm">
                        <thead className="sticky top-0 bg-surface"><tr className="border-b text-text-tertiary text-left"><th className="py-2 px-2">পণ্য</th><th className="py-2 px-2">SKU</th><th className="py-2 px-2">পরিমাণ</th><th className="py-2 px-2">মূল্য</th><th className="py-2 px-2">অবস্থা</th></tr></thead>
                        <tbody>{stockRows.slice(0,100).map((r: any) => (<tr key={r.productId} className="border-b"><td className="py-2 px-2">{r.productName}</td><td className="py-2 px-2">{r.sku}</td><td className="py-2 px-2">{formatQtyEn(r.currentQuantityMilli)}</td><td className="py-2 px-2">{formatBDTEn(r.stockValuePaisa)}</td><td className="py-2 px-2"><Badge variant={r.status==='in_stock'?'success':r.status==='low_stock'?'warning':'danger'}>{r.status==='in_stock'?'আছে':r.status==='low_stock'?'কম':'নেই'}</Badge></td></tr>))}</tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>কম স্টক</CardTitle></CardHeader>
                <CardContent>
                  {lowStockRows.length === 0 ? <EmptyState /> : (
                    <table className="w-full text-body-sm">
                      <thead><tr className="border-b text-text-tertiary text-left"><th className="py-2">পণ্য</th><th className="py-2">বর্তমান</th><th className="py-2">ন্যূনতম</th><th className="py-2">ঘাটতি</th></tr></thead>
                      <tbody>{lowStockRows.map((r: any) => (<tr key={r.productId} className="border-b"><td className="py-2">{r.productName}</td><td className="py-2">{formatQtyEn(r.currentQuantityMilli)}</td><td className="py-2">{formatQtyEn(r.minStockMilli)}</td><td className="py-2 text-danger-600">{formatQtyEn(r.deficitMilli)}</td></tr>))}</tbody>
                    </table>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>স্টক মুভমেন্ট</CardTitle></CardHeader>
                <CardContent>
                  {stockMovements.length === 0 ? <EmptyState /> : (
                    <table className="w-full text-body-sm">
                      <thead><tr className="border-b text-text-tertiary text-left"><th className="py-2">তারিখ</th><th className="py-2">পণ্য</th><th className="py-2">ধরন</th><th className="py-2">পরিমাণ</th><th className="py-2">রেফ</th></tr></thead>
                      <tbody>{stockMovements.map((r: any) => (<tr key={r.id} className="border-b"><td className="py-2">{formatDate(r.createdAt)}</td><td className="py-2">{r.productName}</td><td className="py-2">{r.movementTypeBn}</td><td className="py-2">{formatQtyEn(r.quantityMilli)}</td><td className="py-2">{r.referenceNumber || '-'}</td></tr>))}</tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'customer' && (
            <Card>
              <CardHeader><CardTitle>গ্রাহক বকেয়া</CardTitle></CardHeader>
              <CardContent>
                {customerDue.length === 0 ? <EmptyState /> : (
                  <table className="w-full text-body-sm">
                    <thead><tr className="border-b text-text-tertiary text-left"><th className="py-2">গ্রাহক</th><th className="py-2">ফোন</th><th className="py-2">বিক্রয়</th><th className="py-2">আদায়</th><th className="py-2">বর্তমান বকেয়া</th><th className="py-2">ক্রেডিট লিমিট</th></tr></thead>
                    <tbody>{customerDue.map((r: any) => (<tr key={r.customerId} className="border-b"><td className="py-2">{r.customerName}</td><td className="py-2">{r.phone || '-'}</td><td className="py-2">{formatBDTEn(r.salesPaisa)}</td><td className="py-2">{formatBDTEn(r.paymentsPaisa)}</td><td className="py-2 font-semibold">{formatBDTEn(r.currentDuePaisa)}</td><td className="py-2">{formatBDTEn(r.creditLimitPaisa)}</td></tr>))}</tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === 'supplier' && (
            <Card>
              <CardHeader><CardTitle>সরবরাহকারী দেনা</CardTitle></CardHeader>
              <CardContent>
                {supplierPayable.length === 0 ? <EmptyState /> : (
                  <table className="w-full text-body-sm">
                    <thead><tr className="border-b text-text-tertiary text-left"><th className="py-2">সরবরাহকারী</th><th className="py-2">ক্রয়</th><th className="py-2">পরিশোধ</th><th className="py-2">বর্তমান দেনা</th></tr></thead>
                    <tbody>{supplierPayable.map((r: any) => (<tr key={r.supplierId} className="border-b"><td className="py-2">{r.supplierName}</td><td className="py-2">{formatBDTEn(r.purchasesPaisa)}</td><td className="py-2">{formatBDTEn(r.paymentsPaisa)}</td><td className="py-2 font-semibold">{formatBDTEn(r.currentPayablePaisa)}</td></tr>))}</tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === 'expense' && (
            <div className="space-y-4">
              {expenseSummary && (
                <div className="grid grid-cols-3 gap-3">
                  <Card><CardContent className="pt-4"><p className="text-caption">মোট খরচ</p><p className="text-h3 font-semibold">{formatBDT(expenseSummary.totalExpensePaisa)}</p><p className="text-caption">{expenseSummary.expenseCount} টি</p></CardContent></Card>
                  <Card><CardContent className="pt-4"><p className="text-caption">সক্রিয়</p><p className="text-h3 font-semibold">{formatBDT(expenseSummary.activeExpensePaisa)}</p></CardContent></Card>
                  <Card><CardContent className="pt-4"><p className="text-caption">বাতিল</p><p className="text-h3 font-semibold">{formatBDT(expenseSummary.voidedAmountPaisa)}</p></CardContent></Card>
                </div>
              )}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader><CardTitle>ক্যাটাগরি অনুযায়ী</CardTitle></CardHeader>
                  <CardContent>
                    {expenseByCat.length === 0 ? <EmptyState /> : (
                      <table className="w-full text-body-sm">
                        <thead><tr className="border-b text-text-tertiary text-left"><th className="py-2">ক্যাটাগরি</th><th className="py-2">পরিমাণ</th><th className="py-2">%</th></tr></thead>
                        <tbody>{expenseByCat.map((r: any) => (<tr key={r.categoryId} className="border-b"><td className="py-2">{r.categoryName}</td><td className="py-2">{formatBDTEn(r.amountPaisa)}</td><td className="py-2">{formatPercent(r.percentage)}</td></tr>))}</tbody>
                      </table>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>সাম্প্রতিক খরচ</CardTitle></CardHeader>
                  <CardContent>
                    {expenseList.length === 0 ? <EmptyState /> : (
                      <table className="w-full text-body-sm">
                        <thead><tr className="border-b text-text-tertiary text-left"><th className="py-2">নম্বর</th><th className="py-2">ক্যাটাগরি</th><th className="py-2">পরিমাণ</th><th className="py-2">তারিখ</th></tr></thead>
                        <tbody>{expenseList.map((r: any) => (<tr key={r.id} className="border-b"><td className="py-2">{r.expenseNumber}</td><td className="py-2">{r.categoryName}</td><td className="py-2">{formatBDTEn(r.amountPaisa)}</td><td className="py-2">{formatDate(r.date)}</td></tr>))}</tbody>
                      </table>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {activeTab === 'profit' && (
            <div className="space-y-4">
              {profitLoss ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card><CardContent className="pt-4"><p className="text-caption">মোট বিক্রয়</p><p className="text-h3 font-semibold">{formatBDT(profitLoss.revenue.grossSalesPaisa)}</p></CardContent></Card>
                    <Card><CardContent className="pt-4"><p className="text-caption">ছাড়</p><p className="text-h3 font-semibold">{formatBDT(profitLoss.revenue.discountsPaisa)}</p></CardContent></Card>
                    <Card><CardContent className="pt-4"><p className="text-caption">ফেরত</p><p className="text-h3 font-semibold">{formatBDT(profitLoss.revenue.returnsPaisa)}</p></CardContent></Card>
                    <Card><CardContent className="pt-4"><p className="text-caption">নিট বিক্রয়</p><p className="text-h3 font-semibold text-primary-600">{formatBDT(profitLoss.revenue.netSalesPaisa)}</p></CardContent></Card>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Card className="border-primary-100 bg-primary-50/30"><CardContent className="pt-4"><p className="text-caption">COGS (স্ন্যাপশট)</p><p className="text-h2 font-bold">{formatBDT(profitLoss.cogs.cogsPaisa)}</p><p className="text-caption mt-1">sale_items.line_cost_total_paisa ব্যবহার</p></CardContent></Card>
                    <Card className="border-success-100 bg-success-50/30"><CardContent className="pt-4"><p className="text-caption">মোট মুনাফা</p><p className="text-h2 font-bold text-success-600">{formatBDT(profitLoss.grossProfit.grossProfitPaisa)}</p><p className="text-caption mt-1">মার্জিন {formatPercent(profitLoss.grossProfit.marginPercent)}</p></CardContent></Card>
                    <Card className="border-warning-100 bg-warning-50/30"><CardContent className="pt-4"><p className="text-caption">নিট মুনাফা</p><p className="text-h2 font-bold">{formatBDT(profitLoss.netProfit.netProfitPaisa)}</p><p className="text-caption mt-1">মার্জিন {formatPercent(profitLoss.netProfit.marginPercent)} • খরচ {formatBDT(profitLoss.expenses.operatingExpensesPaisa)}</p></CardContent></Card>
                  </div>
                  <Card>
                    <CardHeader><CardTitle>খরচ বিভাজন</CardTitle></CardHeader>
                    <CardContent>
                      {profitLoss.expenses.expenseByCategory.length === 0 ? <EmptyState /> : (
                        <table className="w-full text-body-sm">
                          <thead><tr className="border-b text-text-tertiary text-left"><th className="py-2">ক্যাটাগরি</th><th className="py-2">পরিমাণ</th><th className="py-2">%</th></tr></thead>
                          <tbody>{profitLoss.expenses.expenseByCategory.map((r: any) => (<tr key={r.categoryId} className="border-b"><td className="py-2">{r.categoryName}</td><td className="py-2">{formatBDTEn(r.amountPaisa)}</td><td className="py-2">{formatPercent(r.percentage)}</td></tr>))}</tbody>
                        </table>
                      )}
                    </CardContent>
                  </Card>
                </>
              ) : <EmptyState />}
            </div>
          )}

          {activeTab === 'shift' && (
            <Card>
              <CardHeader><CardTitle>শিফট রিপোর্ট</CardTitle></CardHeader>
              <CardContent>
                {shiftReport.length === 0 ? <EmptyState /> : (
                  <table className="w-full text-body-sm">
                    <thead><tr className="border-b text-text-tertiary text-left"><th className="py-2">শিফট</th><th className="py-2">ক্যাশিয়ার</th><th className="py-2">খোলা</th><th className="py-2">বন্ধ</th><th className="py-2">ওপেনিং</th><th className="py-2">বিক্রয়</th><th className="py-2">পার্থক্য</th><th className="py-2">অবস্থা</th></tr></thead>
                    <tbody>{shiftReport.map((r: any) => (<tr key={r.id} className="border-b"><td className="py-2">{r.shiftNumber}</td><td className="py-2">{r.cashierName}</td><td className="py-2">{formatDate(r.openedAt)}</td><td className="py-2">{r.closedAt ? formatDate(r.closedAt) : 'খোলা'}</td><td className="py-2">{formatBDTEn(r.openingCashPaisa)}</td><td className="py-2">{formatBDTEn(r.totalSalesPaisa)}</td><td className="py-2">{formatBDTEn(r.variancePaisa)}</td><td className="py-2"><Badge variant={r.status==='open'?'warning':'success'}>{r.status}</Badge></td></tr>))}</tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};
