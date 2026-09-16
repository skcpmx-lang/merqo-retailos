import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { formatBDTEn, formatDate } from '../lib/format';
import {
  TrendingUp,
  ShoppingCart,
  Wallet,
  Users,
  Building2,
  Package,
  Receipt,
  BarChart3,
} from 'lucide-react';
import { CardSkeleton, TableSkeleton, ErrorState, EmptyState } from '../components/ui/States';

interface DashboardMetrics {
  today: {
    salesPaisa: number;
    transactionCount: number;
    grossProfitPaisa: number;
    expensePaisa: number;
    cashBalancePaisa: number;
  };
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

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
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
  };

  useEffect(() => {
    load();
  }, [businessId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <CardSkeleton key={i} lines={3} />
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} lines={2} />
          ))}
        </div>
        <TableSkeleton rows={7} />
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={load} />;
  }

  if (!metrics) {
    return <EmptyState title="কোনো তথ্য নেই" description="এই সময়সীমায় কোনো তথ্য পাওয়া যায়নি।" actionLabel="রিফ্রেশ করুন" onAction={load} />;
  }

  const maxTrend = Math.max(...metrics.salesTrend.map(t => t.salesPaisa), 1);

  return (
    <div className="space-y-5">
      {/* KPI row — calm, dense, no neon */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card className="border-primary-100 bg-primary-50/30 hover:shadow-sm transition-shadow">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <p className="text-caption font-medium text-text-tertiary uppercase tracking-wider">আজকের বিক্রয়</p>
              <div className="w-7 h-7 rounded-sm bg-primary-50 border border-primary-100 flex items-center justify-center">
                <ShoppingCart size={14} className="text-primary-600" />
              </div>
            </div>
            <p className="text-h2 font-bold mt-2 tabular-nums">{formatBDTEn(metrics.today.salesPaisa)}</p>
            <p className="text-caption text-text-tertiary mt-1">{metrics.today.transactionCount} টি লেনদেন</p>
          </CardContent>
        </Card>

        <Card className="border-success-100 bg-success-50/30 hover:shadow-sm transition-shadow">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <p className="text-caption font-medium text-text-tertiary uppercase tracking-wider">আজকের লাভ</p>
              <div className="w-7 h-7 rounded-sm bg-success-50 border border-success-100 flex items-center justify-center">
                <TrendingUp size={14} className="text-success-600" />
              </div>
            </div>
            <p className="text-h2 font-bold mt-2 tabular-nums text-success-700">{formatBDTEn(metrics.today.grossProfitPaisa)}</p>
            <p className="text-caption text-text-tertiary mt-1">COGS স্ন্যাপশট</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-sm transition-shadow">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <p className="text-caption font-medium text-text-tertiary uppercase tracking-wider">আজকের খরচ</p>
              <div className="w-7 h-7 rounded-sm bg-subtle border border-border flex items-center justify-center">
                <Receipt size={14} className="text-text-tertiary" />
              </div>
            </div>
            <p className="text-h2 font-bold mt-2 tabular-nums">{formatBDTEn(metrics.today.expensePaisa)}</p>
            <p className="text-caption text-text-tertiary mt-1">ব্যয়</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-sm transition-shadow">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <p className="text-caption font-medium text-text-tertiary uppercase tracking-wider">নগদ ব্যালেন্স</p>
              <div className="w-7 h-7 rounded-sm bg-subtle border border-border flex items-center justify-center">
                <Wallet size={14} className="text-text-tertiary" />
              </div>
            </div>
            <p className="text-h2 font-bold mt-2 tabular-nums">{formatBDTEn(metrics.today.cashBalancePaisa)}</p>
            <p className="text-caption text-text-tertiary mt-1">উপলব্ধ</p>
          </CardContent>
        </Card>

        <Card className={metrics.lowStockCount > 0 ? 'border-warning-200 bg-warning-50/30 hover:shadow-sm transition-shadow' : 'hover:shadow-sm transition-shadow'}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <p className="text-caption font-medium text-text-tertiary uppercase tracking-wider">কম মজুত</p>
              <div className={`w-7 h-7 rounded-sm border flex items-center justify-center ${metrics.lowStockCount > 0 ? 'bg-warning-50 border-warning-200' : 'bg-subtle border-border'}`}>
                <Package size={14} className={metrics.lowStockCount > 0 ? 'text-warning-600' : 'text-text-tertiary'} />
              </div>
            </div>
            <p className={`text-h2 font-bold mt-2 tabular-nums ${metrics.lowStockCount > 0 ? 'text-warning-700' : ''}`}>{metrics.lowStockCount}</p>
            <p className="text-caption text-text-tertiary mt-1">পণ্য</p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary metrics — information-dense */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card className="hover:shadow-sm transition-shadow">
          <CardContent className="pt-3.5">
            <p className="text-caption text-text-tertiary">গ্রাহকের বকেয়া</p>
            <p className="text-body font-semibold mt-1 tabular-nums">{formatBDTEn(metrics.receivablePaisa)}</p>
            <p className="text-caption text-text-tertiary flex items-center gap-1 mt-1">
              <Users size={12} /> {metrics.totalCustomers} গ্রাহক
            </p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-sm transition-shadow">
          <CardContent className="pt-3.5">
            <p className="text-caption text-text-tertiary">সরবরাহকারীর পাওনা</p>
            <p className="text-body font-semibold mt-1 tabular-nums">{formatBDTEn(metrics.payablePaisa)}</p>
            <p className="text-caption text-text-tertiary flex items-center gap-1 mt-1">
              <Building2 size={12} /> {metrics.totalSuppliers} সরবরাহকারী
            </p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-sm transition-shadow">
          <CardContent className="pt-3.5">
            <p className="text-caption text-text-tertiary">মজুত মূল্য</p>
            <p className="text-body font-semibold mt-1 tabular-nums">{formatBDTEn(metrics.totalStockValuePaisa)}</p>
            <p className="text-caption text-text-tertiary flex items-center gap-1 mt-1">
              <Package size={12} /> {metrics.totalProducts} পণ্য
            </p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-sm transition-shadow">
          <CardContent className="pt-3.5">
            <p className="text-caption text-text-tertiary">ডাটাবেস</p>
            <p className="text-body font-semibold mt-1">{dbStatus?.tableCount || '-'} টেবিল</p>
            <p className="text-caption text-text-tertiary">DB {dbStatus?.integrityOk ? 'সুস্থ' : 'ত্রুটি'}</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-sm transition-shadow">
          <CardContent className="pt-3.5">
            <p className="text-caption text-text-tertiary">পেমেন্ট মিক্স</p>
            <p className="text-body font-semibold mt-1">{metrics.paymentMix.length} ধরন</p>
            <p className="text-caption text-text-tertiary truncate">{metrics.paymentMix[0]?.methodLabelBn || '-'}</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-sm transition-shadow">
          <CardContent className="pt-3.5">
            <p className="text-caption text-text-tertiary">টপ পণ্য</p>
            <p className="text-body font-semibold mt-1 truncate" title={metrics.topProducts[0]?.productName}>
              {metrics.topProducts[0]?.productName?.slice(0, 14) || '-'}
            </p>
            <p className="text-caption text-text-tertiary tabular-nums">
              {metrics.topProducts[0] ? formatBDTEn(metrics.topProducts[0].netSalesPaisa) : '-'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 size={16} className="text-text-tertiary" /> গত ৭ দিনের বিক্রয়
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.salesTrend.length === 0 ? (
              <p className="text-body-sm text-text-tertiary py-10 text-center">এই সময়সীমায় কোনো তথ্য পাওয়া যায়নি।</p>
            ) : (
              <div className="space-y-2.5">
                {metrics.salesTrend.map(t => (
                  <div key={t.date} className="flex items-center gap-3">
                    <div className="w-12 text-caption text-text-tertiary tabular-nums shrink-0">{t.label}</div>
                    <div className="flex-1 h-5 bg-subtle rounded-sm overflow-hidden relative">
                      <div className="h-full bg-primary-500 transition-all duration-300" style={{ width: `${Math.max(4, (t.salesPaisa / maxTrend) * 100)}%` }} />
                    </div>
                    <div className="w-28 text-right text-body-sm font-medium tabular-nums shrink-0">{formatBDTEn(t.salesPaisa)}</div>
                    <div className="w-12 text-right text-caption text-text-tertiary shrink-0">{t.transactionCount} টি</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>পেমেন্ট পদ্ধতি</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.paymentMix.length === 0 ? (
              <p className="text-body-sm text-text-tertiary py-10 text-center">এই সময়সীমায় কোনো তথ্য পাওয়া যায়নি।</p>
            ) : (
              <div className="space-y-3">
                {metrics.paymentMix.map(p => (
                  <div key={p.method} className="flex items-center justify-between py-1">
                    <div className="min-w-0">
                      <p className="text-body-sm font-medium truncate">{p.methodLabelBn}</p>
                      <p className="text-caption text-text-tertiary">{p.count} টি • {p.percentage}%</p>
                    </div>
                    <p className="text-body-sm font-semibold tabular-nums shrink-0 ml-3">{formatBDTEn(p.amountPaisa)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>টপ পণ্য (এই মাস)</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.topProducts.length === 0 ? (
              <p className="text-body-sm text-text-tertiary py-10 text-center">এই সময়সীমায় কোনো তথ্য পাওয়া যায়নি।</p>
            ) : (
              <div className="divide-y divide-border">
                {metrics.topProducts.map(p => (
                  <div key={p.productId} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0 flex-1 mr-3">
                      <p className="text-body-sm font-medium truncate" title={p.productName}>
                        {p.productName}
                      </p>
                      <p className="text-caption text-text-tertiary">{p.quantityUnits} ইউনিট</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-body-sm font-semibold tabular-nums">{formatBDTEn(p.netSalesPaisa)}</p>
                      <p className="text-caption text-success-600 tabular-nums">{formatBDTEn(p.grossProfitPaisa)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>সাম্প্রতিক বিক্রয়</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.recentSales.length === 0 ? (
              <p className="text-body-sm text-text-tertiary py-10 text-center">এই সময়সীমায় কোনো তথ্য পাওয়া যায়নি।</p>
            ) : (
              <div className="divide-y divide-border">
                {metrics.recentSales.map(s => (
                  <div key={s.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0 flex-1 mr-3">
                      <p className="text-body-sm font-medium tabular-nums">{s.saleNumber}</p>
                      <p className="text-caption text-text-tertiary truncate">
                        {s.customerName || 'খুচরা'} • {formatDate(s.createdAt)}
                      </p>
                    </div>
                    <p className="text-body-sm font-semibold tabular-nums shrink-0">{formatBDTEn(s.totalPaisa)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>কম মজুত সতর্কতা</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.lowStockProducts.length === 0 ? (
              <div className="flex flex-col items-center py-10">
                <div className="w-10 h-10 rounded-full bg-success-50 border border-success-100 flex items-center justify-center mb-2">
                  <Package size={20} className="text-success-600" />
                </div>
                <p className="text-body-sm text-text-secondary">সব পণ্য পর্যাপ্ত আছে</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {metrics.lowStockProducts.map(p => (
                  <div key={p.productId} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                    <p className="text-body-sm font-medium truncate flex-1 mr-3" title={p.productName}>
                      {p.productName}
                    </p>
                    <Badge variant="warning" className="shrink-0 tabular-nums">
                      {(p.currentQuantityMilli / 1000).toFixed(1)} / {(p.minStockMilli / 1000).toFixed(0)}
                    </Badge>
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
