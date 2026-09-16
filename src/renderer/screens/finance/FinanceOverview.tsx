import React from 'react';
import { useFinanceDashboard } from '../../hooks/useFinance';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { formatPaisa } from '../../components/pos/POSCartTypes';
import { Wallet, Building2, Smartphone, TrendingUp, TrendingDown, Banknote } from 'lucide-react';

export const FinanceOverview: React.FC<{ businessId: string }> = ({ businessId }) => {
  const { data, isLoading, error } = useFinanceDashboard(businessId);

  if (isLoading) return <div className="p-6 text-body-sm">লোড হচ্ছে...</div>;
  if (error) return <div className="p-6 text-danger-600 text-body-sm">{String(error)}</div>;
  if (!data) return <div className="p-6 text-body-sm">কোন তথ্য নেই</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-h2 font-bold">ফাইন্যান্স ওভারভিউ</h1>
        <Badge variant="default">লাইভ ব্যালেন্স</Badge>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-caption flex items-center gap-2"><Wallet size={14} /> মোট নগদ</CardTitle></CardHeader>
          <CardContent><p className="text-h2 font-mono">{formatPaisa(data.totalCash)}</p><p className="text-caption text-text-tertiary">{data.accounts.cash} টি হিসাব</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-caption flex items-center gap-2"><Building2 size={14} /> মোট ব্যাংক</CardTitle></CardHeader>
          <CardContent><p className="text-h2 font-mono">{formatPaisa(data.totalBank)}</p><p className="text-caption text-text-tertiary">{data.accounts.bank} টি হিসাব</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-caption flex items-center gap-2"><Smartphone size={14} /> মোট MFS</CardTitle></CardHeader>
          <CardContent><p className="text-h2 font-mono">{formatPaisa(data.totalMfs)}</p><p className="text-caption text-text-tertiary">{data.accounts.mfs} টি হিসাব</p></CardContent>
        </Card>
        <Card className="bg-primary-50 border-primary-200">
          <CardHeader className="pb-2"><CardTitle className="text-caption flex items-center gap-2"><Banknote size={14} /> মোট ব্যালেন্স</CardTitle></CardHeader>
          <CardContent><p className="text-h2 font-mono font-bold text-primary-700">{formatPaisa(data.totalBalance)}</p><p className="text-caption text-text-tertiary">নগদ+ব্যাংক+MFS</p></CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-body-sm flex items-center gap-2"><TrendingUp size={14} className="text-success-600" /> আজকের আয়</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-body-sm">
            <div className="flex justify-between"><span>নগদ</span><span className="font-mono text-success-600">{formatPaisa(data.today.cashInflow)}</span></div>
            <div className="flex justify-between"><span>ব্যাংক</span><span className="font-mono">{formatPaisa(data.today.bankInflow)}</span></div>
            <div className="flex justify-between"><span>MFS</span><span className="font-mono">{formatPaisa(data.today.mfsInflow)}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-body-sm flex items-center gap-2"><TrendingDown size={14} className="text-danger-600" /> আজকের ব্যয়</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-body-sm">
            <div className="flex justify-between"><span>নগদ</span><span className="font-mono text-danger-600">{formatPaisa(data.today.cashOutflow)}</span></div>
            <div className="flex justify-between"><span>ব্যাংক</span><span className="font-mono">{formatPaisa(data.today.bankOutflow)}</span></div>
            <div className="flex justify-between"><span>MFS</span><span className="font-mono">{formatPaisa(data.today.mfsOutflow)}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-body-sm">দ্রুত অ্যাকশন</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-caption">
            <p>• নগদ হিসাব তৈরি করুন</p>
            <p>• ব্যাংক হিসাব যোগ করুন</p>
            <p>• bKash/Nagad হিসাব</p>
            <p>• খরচ যোগ করুন</p>
            <p>• হিসাব স্থানান্তর</p>
            <p>• শিফট খুলুন/বন্ধ করুন</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-body-sm">ব্যাখ্যা</CardTitle></CardHeader>
        <CardContent className="text-caption text-text-tertiary space-y-1">
          <p>• সব ব্যালেন্স লোকাল লেনদেন থেকে গণনা করা — কোন হার্ডকোড নেই</p>
          <p>• নগদ = ওপেনিং + ইনফ্লো - আউটফ্লো (অপরিবর্তনীয় লেজার)</p>
          <p>• ব্যাংক/MFS একই নিয়ম</p>
          <p>• আজকের হিসাব ০০:০০ থেকে ২৩:৫৯ পর্যন্ত</p>
        </CardContent>
      </Card>
    </div>
  );
};
