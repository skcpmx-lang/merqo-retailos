import React, { useState } from 'react';
import { useSales } from '../../hooks/useSales';
import { useCustomers } from '../../hooks/useCustomers';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Search, Plus, Eye } from 'lucide-react';

function formatPaisa(paisa: number): string {
  return `৳ ${(paisa / 100).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('bn-BD', { year: 'numeric', month: 'short', day: 'numeric' });
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'default' | 'danger'> = {
  paid: 'success',
  partially_paid: 'warning',
  completed: 'default',
  draft: 'default',
  cancelled: 'danger',
  voided: 'danger',
  partially_returned: 'warning',
  refunded: 'danger',
};
const STATUS_LABEL: Record<string, string> = {
  paid: 'পরিশোধিত',
  partially_paid: 'আংশিক',
  completed: 'সম্পন্ন',
  draft: 'খসড়া',
  cancelled: 'বাতিল',
  voided: 'বাতিল',
  partially_returned: 'আংশিক ফেরত',
  refunded: 'ফেরত',
};

export const SaleList: React.FC<{ businessId: string; onSelect: (id: string) => void; onCreate: () => void }> = ({ businessId, onSelect, onCreate }) => {
  const [filters, setFilters] = useState<{ customerId?: string; status?: string; search?: string; fromDate?: number; toDate?: number; isDue?: boolean }>({});
  const [searchInput, setSearchInput] = useState('');

  const { data: sales, isLoading } = useSales(businessId, filters, 100, 0);
  const { data: customers } = useCustomers(businessId);

  const customerMap = React.useMemo(() => {
    const m: Record<string, string> = {};
    (customers || []).forEach((c: any) => (m[c.id] = c.name));
    return m;
  }, [customers]);

  const handleSearch = () => {
    setFilters({ ...filters, search: searchInput });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-text-primary">বিক্রয় তালিকা</h1>
          <p className="text-body-sm text-text-secondary mt-1">বিক্রয় আদেশ ও বাকি ট্র্যাকিং</p>
        </div>
        <Button onClick={onCreate}><Plus size={16} className="mr-2" /> নতুন বিক্রয়</Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="text-caption text-text-tertiary block mb-1">খুঁজুন</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                  <Input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="বিক্রয় নম্বর..." className="pl-9" onKeyDown={e => e.key === 'Enter' && handleSearch()} />
                </div>
                <Button variant="secondary" size="sm" onClick={handleSearch}>খুঁজুন</Button>
              </div>
            </div>
            <div>
              <label className="text-caption text-text-tertiary block mb-1">গ্রাহক</label>
              <select value={filters.customerId || ''} onChange={e => setFilters({ ...filters, customerId: e.target.value || undefined })} className="h-9 px-3 rounded-sm border border-border bg-surface text-body-sm min-w-[160px]">
                <option value="">সব গ্রাহক</option>
                {(customers || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-caption text-text-tertiary block mb-1">অবস্থা</label>
              <select value={filters.status || ''} onChange={e => setFilters({ ...filters, status: e.target.value || undefined })} className="h-9 px-3 rounded-sm border border-border bg-surface text-body-sm">
                <option value="">সব</option>
                <option value="completed">সম্পন্ন</option>
                <option value="partially_paid">আংশিক</option>
                <option value="paid">পরিশোধিত</option>
                <option value="cancelled">বাতিল</option>
                <option value="partially_returned">আংশিক ফেরত</option>
                <option value="refunded">ফেরত</option>
              </select>
            </div>
            <div>
              <label className="text-caption text-text-tertiary block mb-1">বাকি</label>
              <select value={filters.isDue === undefined ? '' : filters.isDue ? 'due' : 'paid'} onChange={e => {
                const v = e.target.value;
                if (v === '') setFilters({ ...filters, isDue: undefined });
                else setFilters({ ...filters, isDue: v === 'due' });
              }} className="h-9 px-3 rounded-sm border border-border bg-surface text-body-sm">
                <option value="">সব</option>
                <option value="due">বাকি আছে</option>
                <option value="paid">পরিশোধিত</option>
              </select>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setFilters({}); setSearchInput(''); }}>রিসেট</Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <table className="w-full">
              <thead className="bg-subtle border-y border-border">
                <tr>
                  <th className="text-left text-caption font-medium text-text-tertiary px-4 py-2.5">বিক্রয় নম্বর</th>
                  <th className="text-left text-caption font-medium text-text-tertiary px-4 py-2.5">গ্রাহক</th>
                  <th className="text-left text-caption font-medium text-text-tertiary px-4 py-2.5">তারিখ</th>
                  <th className="text-right text-caption font-medium text-text-tertiary px-4 py-2.5">মোট</th>
                  <th className="text-right text-caption font-medium text-text-tertiary px-4 py-2.5">পরিশোধিত</th>
                  <th className="text-right text-caption font-medium text-text-tertiary px-4 py-2.5">বাকি</th>
                  <th className="text-left text-caption font-medium text-text-tertiary px-4 py-2.5">অবস্থা</th>
                  <th className="text-right text-caption font-medium text-text-tertiary px-4 py-2.5">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center"><div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" /></td></tr>
                ) : !sales?.length ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-body-sm text-text-tertiary">কোন বিক্রয় নেই</td></tr>
                ) : (
                  sales.map((s: any) => (
                    <tr key={s.id} className="border-b border-border hover:bg-subtle/50">
                      <td className="px-4 py-3 text-body-sm font-mono font-medium">{s.saleNumber}</td>
                      <td className="px-4 py-3 text-body-sm">{s.customerId ? (customerMap[s.customerId] || s.customerId.slice(0, 8)) : <span className="text-text-tertiary">ওয়াক-ইন</span>}</td>
                      <td className="px-4 py-3 text-body-sm">{formatDate(s.saleDate)}</td>
                      <td className="px-4 py-3 text-right font-mono text-body-sm">{formatPaisa(s.totalPaisa)}</td>
                      <td className="px-4 py-3 text-right font-mono text-body-sm text-success-600">{formatPaisa(s.paidPaisa)}</td>
                      <td className="px-4 py-3 text-right font-mono text-body-sm font-medium"><span className={s.duePaisa > 0 ? 'text-danger-600' : ''}>{formatPaisa(s.duePaisa)}</span></td>
                      <td className="px-4 py-3"><Badge variant={STATUS_VARIANT[s.status] || 'default'}>{STATUS_LABEL[s.status] || s.status}</Badge></td>
                      <td className="px-4 py-3 text-right"><Button variant="ghost" size="sm" onClick={() => onSelect(s.id)}><Eye size={14} className="mr-1" /> দেখুন</Button></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
