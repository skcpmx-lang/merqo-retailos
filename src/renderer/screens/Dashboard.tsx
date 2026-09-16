import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { formatBDTEn, formatDate } from '../lib/format';
import { TrendingUp, ShoppingCart, Wallet, Users, Building2, Package, AlertTriangle, Receipt, DollarSign, BarChart3 } from 'lucide-react';

interface DashboardMetrics {
  today: { salesPaisa: number; transactionCount: number; grossProfitPaisa: number; expensePaisa: number; cashBalancePaisa: number };
  receivablePaisa: number;
  payablePaisa: number;
  lowStockCount: number;
  totalStockValuePaisa: number;
  totalProducts: number;
  totalCustomers: number;
  totalSuppliers: number;
  recentSales: { id: string; saleNumber: string; totalPaisa: number; createdAt: number; customerName?: string }[];
  recentExpenses: { id: string; expenseNumber: string; amountPaisa: number; createdAt: number; categoryName: string }[];
  salesTrend: { date: string; label: string; salesPaisa: number; transactionCount: number }[];
  paymentMix: { method: string; methodLabelBn: string; count: number; amountPaisa: number; percentage: number }[];
  topProducts: { productId: string; productName: string; quantityUnits: number; netSalesPaisa: number; grossProfitPaisa: number }[];
  lowStockProducts: { productId: string; productName: string; currentQuantityMilli: number; minStockMilli: number }[];
}

export const Dashboard: React.FC<{ businessId?: string }> = ({ businessId }) => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dbStatus, setDbStatus] = useState<any>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const bizRes = await (window as any).merqo.business.get();
        const bId = businessId || (bizRes.success ? bizRes.data?.id : null) || 'default-biz';

        const dbRes = await (window as any).merqo.db.getStatus();
        if (dbRes.success) setDbStatus(dbRes.data);

        const res = await (window as any).merqo.report.dashboard({ businessId: bId });
        if (!res.success) throw new Error(res.error?.messageBn || res.error?.message || 'ড্যাশবোর্ড লোড ব্যর্থ');
        setMetrics(res.data);
      } catch (e: any) {
        setError(e.message || String(e));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [businessId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-body-sm text-text-secondary">ড্যাশবোর্ড লোড হচ্ছে...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-danger-200 bg-danger-50">
        <CardContent className="pt-4 flex items-start gap-3">
          <AlertTriangle className="text-danger-500 mt-0.5" size={20} />
          <div>
            <p className="text-body font-medium text-danger-600">ত্রুটি</p>
            <p className="text-body-sm text-text-secondary mt-1">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return <div className="p-8 text-center text-text-secondary">কোনো তথ্য নেই</div>;
  }

  const maxTrend = Math.max(...metrics.salesTrend.map(t => t.salesPaisa), 1);

  return (
    <div className="space-y-6 max-w-[1600px]">
      {/* Header */}
      <div>
        <h1 className="text-h1 text-text-primary">ড্যাশবোর্ড</h1>
        <p className="text-body-sm text-text-secondary mt-1">আজকের ব্যবসার সারসংক্ষেপ — বাস্তব ডেটা</p>
      </div>

      {/* Today KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card className="border-primary-100 bg-primary-50/40">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between"><p className="text-caption text-text-tertiary">আজকের বিক্রয়</p><ShoppingCart size={16} className="text-primary-500" /></div>
            <p className="text-h2 font-bold mt-1">{formatBDTEn(metrics.today.salesPaisa)}</p>
            <p className="text-caption text-text-tertiary mt-1">{metrics.today.transactionCount} টি লেনদেন</p>
          </CardContent>
        </Card>
        <Card className="border-success-100 bg-success-50/40">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between"><p className="text-caption text-text-tertiary">আজকের মুনাফা</p><TrendingUp size={16} className="text-success-500" /></div>
            <p className="text-h2 font-bold mt-1 text-success-600">{formatBDTEn(metrics.today.grossProfitPaisa)}</p>
            <p className="text-caption text-text-tertiary mt-1">COGS স্ন্যাপশট</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between"><p className="text-caption text-text-tertiary">আজকের খরচ</p><Receipt size={16} className="text-text-tertiary" /></div>
            <p className="text-h2 font-bold mt-1">{formatBDTEn(metrics.today.expensePaisa)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between"><p className="text-caption text-text-tertiary">নগদ ব্যালেন্স</p><Wallet size={16} className="text-text-tertiary" /></div>
            <p className="text-h2 font-bold mt-1">{formatBDTEn(metrics.today.cashBalancePaisa)}</p>
          </CardContent>
        </Card>
        <Card className={metrics.lowStockCount > 0 ? 'border-warning-200 bg-warning-50/40' : ''}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between"><p className="text-caption text-text-tertiary">কম স্টক</p><AlertTriangle size={16} className={metrics.lowStockCount > 0 ? 'text-warning-500' : 'text-text-tertiary'} /></div>
            <p className={`text-h2 font-bold mt-1 ${metrics.lowStockCount > 0 ? 'text-warning-600' : ''}`}>{metrics.lowStockCount}</p>
            <p className="text-caption text-text-tertiary mt-1">পণ্য</p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card><CardContent className="pt-3"><p className="text-caption text-text-tertiary">প্রাপ্য</p><p className="text-body font-semibold mt-1">{formatBDTEn(metrics.receivablePaisa)}</p><p className="text-caption text-text-tertiary flex items-center gap-1 mt-1"><Users size={12} /> {metrics.totalCustomers} গ্রাহক</p></CardContent></Card>
        <Card><CardContent className="pt-3"><p className="text-caption text-text-tertiary">প্রদেয়</p><p className="text-body font-semibold mt-1">{formatBDTEn(metrics.payablePaisa)}</p><p className="text-caption text-text-tertiary flex items-center gap-1 mt-1"><Building2 size={12} /> {metrics.totalSuppliers} সরবরাহকারী</p></CardContent></Card>
        <Card><CardContent className="pt-3"><p className="text-caption text-text-tertiary">স্টক মূল্য</p><p className="text-body font-semibold mt-1">{formatBDTEn(metrics.totalStockValuePaisa)}</p><p className="text-caption text-text-tertiary flex items-center gap-1 mt-1"><Package size={12} /> {metrics.totalProducts} পণ্য</p></CardContent></Card>
        <Card><CardContent className="pt-3"><p className="text-caption text-text-tertiary">টেবিল</p><p className="text-body font-semibold mt-1">{dbStatus?.tableCount || '-'}</p><p className="text-caption text-text-tertiary">DB {dbStatus?.integrityOk ? 'সুস্থ' : 'ত্রুটি'}</p></CardContent></Card>
        <Card><CardContent className="pt-3"><p className="text-caption text-text-tertiary">পেমেন্ট মিক্স</p><p className="text-body font-semibold mt-1">{metrics.paymentMix.length} ধরন</p><p className="text-caption text-text-tertiary">{metrics.paymentMix[0]?.methodLabelBn || '-'}</p></CardContent></Card>
        <Card><CardContent className="pt-3"><p className="text-caption text-text-tertiary">টপ পণ্য</p><p className="text-body font-semibold mt-1">{metrics.topProducts[0]?.productName?.slice(0,12) || '-'}</p><p className="text-caption text-text-tertiary">{metrics.topProducts[0] ? formatBDTEn(metrics.topProducts[0].netSalesPaisa) : '-'}</p></CardContent></Card>
      </div>

      {/* Charts row - actual data only */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 size={18} /> গত ৭ দিনের বিক্রয়</CardTitle></CardHeader>
          <CardContent>
            {metrics.salesTrend.length === 0 ? <p className="text-body-sm text-text-tertiary py-8 text-center">এই সময়সীমায় কোনো তথ্য পাওয়া যায়নি।</p> : (
              <div className="space-y-2">
                {metrics.salesTrend.map((t) => (
                  <div key={t.date} className="flex items-center gap-3">
                    <div className="w-12 text-caption text-text-tertiary">{t.label}</div>
                    <div className="flex-1 h-6 bg-subtle rounded-sm overflow-hidden relative">
                      <div className="h-full bg-primary-500 transition-all" style={{ width: `${Math.max(4, (t.salesPaisa / maxTrend) * 100)}%` }} />
                    </div>
                    <div className="w-28 text-right text-body-sm font-medium">{formatBDTEn(t.salesPaisa)}</div>
                    <div className="w-12 text-right text-caption text-text-tertiary">{t.transactionCount} টি</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>পেমেন্ট পদ্ধতি</CardTitle></CardHeader>
          <CardContent>
            {metrics.paymentMix.length === 0 ? <p className="text-body-sm text-text-tertiary py-8 text-center">এই সময়সীমায় কোনো তথ্য পাওয়া যায়নি।</p> : (
              <div className="space-y-3">
                {metrics.paymentMix.map(p => (
                  <div key={p.method} className="flex items-center justify-between">
                    <div><p className="text-body-sm font-medium">{p.methodLabelBn}</p><p className="text-caption text-text-tertiary">{p.count} টি • {p.percentage}%</p></div>
                    <p className="text-body-sm font-semibold">{formatBDTEn(p.amountPaisa)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle>টপ পণ্য (এই মাস)</CardTitle></CardHeader>
          <CardContent>
            {metrics.topProducts.length === 0 ? <p className="text-body-sm text-text-tertiary py-8 text-center">এই সময়সীমায় কোনো তথ্য পাওয়া যায়নি।</p> : (
              <div className="space-y-2">
                {metrics.topProducts.map(p => (
                  <div key={p.productId} className="flex items-center justify-between border-b border-border py-2 last:border-0">
                    <div><p className="text-body-sm font-medium truncate max-w-[140px]">{p.productName}</p><p className="text-caption text-text-tertiary">{p.quantityUnits} ইউনিট</p></div>
                    <div className="text-right"><p className="text-body-sm font-semibold">{formatBDTEn(p.netSalesPaisa)}</p><p className="text-caption text-success-600">{formatBDTEn(p.grossProfitPaisa)}</p></div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>সাম্প্রতিক বিক্রয়</CardTitle></CardHeader>
          <CardContent>
            {metrics.recentSales.length === 0 ? <p className="text-body-sm text-text-tertiary py-8 text-center">এই সময়সীমায় কোনো তথ্য পাওয়া যায়নি।</p> : (
              <div className="space-y-2">
                {metrics.recentSales.map(s => (
                  <div key={s.id} className="flex items-center justify-between border-b border-border py-2 last:border-0">
                    <div><p className="text-body-sm font-medium">{s.saleNumber}</p><p className="text-caption text-text-tertiary">{s.customerName || 'খুচরা'} • {formatDate(s.createdAt)}</p></div>
                    <p className="text-body-sm font-semibold">{formatBDTEn(s.totalPaisa)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>কম স্টক সতর্কতা</CardTitle></CardHeader>
          <CardContent>
            {metrics.lowStockProducts.length === 0 ? (
              <div className="flex flex-col items-center py-8"><Package size={24} className="text-success-500 mb-2" /><p className="text-body-sm text-text-secondary">সব পণ্য পর্যাপ্ত আছে</p></div>
            ) : (
              <div className="space-y-2">
                {metrics.lowStockProducts.map(p => (
                  <div key={p.productId} className="flex items-center justify-between border-b border-border py-2 last:border-0">
                    <p className="text-body-sm font-medium truncate max-w-[140px]">{p.productName}</p>
                    <Badge variant="warning">{(p.currentQuantityMilli/1000).toFixed(1)} / {(p.minStockMilli/1000).toFixed(0)}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
