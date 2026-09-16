import React from 'react';
import { useFinanceDashboard } from '../../hooks/useFinance';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { CardSkeleton, ErrorState, EmptyState } from '../../components/ui/States';
import { formatBDTEn } from '../../lib/format';
import { Wallet, Building2, Smartphone, TrendingUp, TrendingDown, Banknote } from 'lucide-react';

export const FinanceOverview: React.FC<{ businessId: string }> = ({ businessId }) => {
  const { data, isLoading, error, refetch } = useFinanceDashboard(businessId) as any;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} lines={2} />
          ))}
        </div>
      </div>
    );
  }
  if (error) return <ErrorState message={String(error)} onRetry={() => refetch?.()} />;
  if (!data) return <EmptyState title="কোনো তথ্য নেই" description="এই সময়সীমায় কোনো তথ্য পাওয়া যায়নি।" />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-h3 font-semibold tracking-tight">অর্থ — সারসংক্ষেপ</h1>
          <p className="text-body-sm text-text-secondary mt-0.5">নগদ • ব্যাংক • MFS • খরচ • শিফট — লাইভ ব্যালেন্স</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="hover:shadow-sm transition-shadow">
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-caption font-medium uppercase tracking-wider flex items-center gap-1.5">
              <Wallet size={12} className="text-text-tertiary" /> মোট নগদ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-h3 font-bold tabular-nums tracking-tight">{formatBDTEn(data.totalCash)}</p>
            <p className="text-caption text-text-tertiary mt-1">{data.accounts.cash} টি হিসাব</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-sm transition-shadow">
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-caption font-medium uppercase tracking-wider flex items-center gap-1.5">
              <Building2 size={12} className="text-text-tertiary" /> মোট ব্যাংক
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-h3 font-bold tabular-nums tracking-tight">{formatBDTEn(data.totalBank)}</p>
            <p className="text-caption text-text-tertiary mt-1">{data.accounts.bank} টি হিসাব</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-sm transition-shadow">
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-caption font-medium uppercase tracking-wider flex items-center gap-1.5">
              <Smartphone size={12} className="text-text-tertiary" /> মোট MFS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-h3 font-bold tabular-nums tracking-tight">{formatBDTEn(data.totalMfs)}</p>
            <p className="text-caption text-text-tertiary mt-1">{data.accounts.mfs} টি হিসাব</p>
          </CardContent>
        </Card>
        <Card className="bg-primary-50/50 border-primary-100 hover:shadow-sm transition-shadow">
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-caption font-medium uppercase tracking-wider flex items-center gap-1.5">
              <Banknote size={12} className="text-primary-600" /> মোট ব্যালেন্স
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-h3 font-bold tabular-nums tracking-tight text-primary-700">{formatBDTEn(data.totalBalance)}</p>
            <p className="text-caption text-text-tertiary mt-1">নগদ+ব্যাংক+MFS</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-body-sm flex items-center gap-2">
              <TrendingUp size={14} className="text-success-600" /> আজকের আয়
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-body-sm">
            <div className="flex justify-between">
              <span className="text-text-secondary">নগদ</span>
              <span className="tabular-nums font-medium text-success-600">{formatBDTEn(data.today.cashInflow)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">ব্যাংক</span>
              <span className="tabular-nums font-medium">{formatBDTEn(data.today.bankInflow)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">MFS</span>
              <span className="tabular-nums font-medium">{formatBDTEn(data.today.mfsInflow)}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-body-sm flex items-center gap-2">
              <TrendingDown size={14} className="text-danger-600" /> আজকের ব্যয়
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-body-sm">
            <div className="flex justify-between">
              <span className="text-text-secondary">নগদ</span>
              <span className="tabular-nums font-medium text-danger-600">{formatBDTEn(data.today.cashOutflow)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">ব্যাংক</span>
              <span className="tabular-nums font-medium">{formatBDTEn(data.today.bankOutflow)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">MFS</span>
              <span className="tabular-nums font-medium">{formatBDTEn(data.today.mfsOutflow)}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-subtle/50">
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-body-sm">দ্রুত অ্যাকশন</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-body-sm text-text-secondary leading-relaxed">
            <p>• নগদ হিসাব তৈরি</p>
            <p>• ব্যাংক হিসাব যোগ</p>
            <p>• বিকাশ/নগদ/রকেট হিসাব</p>
            <p>• খরচ যোগ</p>
            <p>• হিসাব স্থানান্তর</p>
            <p>• শিফট খোলা/বন্ধ</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-body-sm">ব্যাখ্যা</CardTitle>
        </CardHeader>
        <CardContent className="text-caption text-text-tertiary space-y-1 leading-relaxed">
          <p>• সব ব্যালেন্স লোকাল লেনদেন থেকে গণনা — কোনো হার্ডকোড নেই</p>
          <p>• নগদ = ওপেনিং + ইনফ্লো - আউটফ্লো (অপরিবর্তনীয় লেজার)</p>
          <p>• ব্যাংক/MFS একই নিয়ম</p>
          <p>• আজকের হিসাব ০০:০০ থেকে ২৩:৫৯ পর্যন্ত</p>
        </CardContent>
      </Card>
    </div>
  );
};
