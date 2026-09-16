import React, { useState } from 'react';
import { usePurchases } from '../../hooks/usePurchases';
import { useSuppliers } from '../../hooks/useSuppliers';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Search, Plus, Eye, XCircle } from 'lucide-react';

function formatPaisa(paisa: number): string {
  return `৳ ${(paisa / 100).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('bn-BD', { year: 'numeric', month: 'short', day: 'numeric' });
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'default' | 'danger'> = {
  paid: 'success',
  partially_paid: 'warning',
  received: 'default',
  draft: 'default',
  cancelled: 'danger',
};
const STATUS_LABEL: Record<string, string> = {
  paid: 'পরিশোধিত',
  partially_paid: 'আংশিক',
  received: 'গ্রহণ',
  draft: 'খসড়া',
  cancelled: 'বাতিল',
};

export const PurchaseList: React.FC<{ businessId: string; onSelect: (id: string) => void; onCreate: () => void }> = ({ businessId, onSelect, onCreate }) => {
  const [filters, setFilters] = useState<{ supplierId?: string; status?: string; search?: string; fromDate?: number; toDate?: number }>({});
  const [searchInput, setSearchInput] = useState('');

  const { data: purchases, isLoading } = usePurchases(businessId, filters, 100, 0);
  const { data: suppliers } = useSuppliers(businessId);

  const supplierMap = React.useMemo(() => {
    const m: Record<string, string> = {};
    (suppliers || []).forEach((s: any) => (m[s.id] = s.name));
    return m;
  }, [suppliers]);

  const handleSearch = () => {
    setFilters({ ...filters, search: searchInput });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-text-primary">ক্রয় তালিকা</h1>
          <p className="text-body-sm text-text-secondary mt-1">ক্রয় আদেশ ও পেমেন্ট ট্র্যাকিং</p>
        </div>
        <Button onClick={onCreate}><Plus size={16} className="mr-2" /> নতুন ক্রয়</Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="text-caption text-text-tertiary block mb-1">খুঁজুন</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                  <Input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="ক্রয় নম্বর..." className="pl-9" onKeyDown={e => e.key === 'Enter' && handleSearch()} />
                </div>
                <Button variant="secondary" size="sm" onClick={handleSearch}>খুঁজুন</Button>
              </div>
            </div>
            <div>
              <label className="text-caption text-text-tertiary block mb-1">সাপ্লায়ার</label>
              <select value={filters.supplierId || ''} onChange={e => setFilters({ ...filters, supplierId: e.target.value || undefined })} className="h-9 px-3 rounded-sm border border-border bg-surface text-body-sm min-w-[160px]">
                <option value="">সব সাপ্লায়ার</option>
                {(suppliers || []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-caption text-text-tertiary block mb-1">অবস্থা</label>
              <select value={filters.status || ''} onChange={e => setFilters({ ...filters, status: e.target.value || undefined })} className="h-9 px-3 rounded-sm border border-border bg-surface text-body-sm">
                <option value="">সব</option>
                <option value="received">গ্রহণ</option>
                <option value="partially_paid">আংশিক</option>
                <option value="paid">পরিশোধিত</option>
                <option value="cancelled">বাতিল</option>
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
                  <th className="text-left text-caption font-medium text-text-tertiary px-4 py-2.5">ক্রয় নম্বর</th>
                  <th className="text-left text-caption font-medium text-text-tertiary px-4 py-2.5">সাপ্লায়ার</th>
                  <th className="text-left text-caption font-medium text-text-tertiary px-4 py-2.5">তারিখ</th>
                  <th className="text-right text-caption font-medium text-text-tertiary px-4 py-2.5">মোট</th>
                  <th className="text-right text-caption font-medium text-text-tertiary px-4 py-2.5">পরিশোধ</th>
                  <th className="text-right text-caption font-medium text-text-tertiary px-4 py-2.5">বকেয়া</th>
                  <th className="text-left text-caption font-medium text-text-tertiary px-4 py-2.5">অবস্থা</th>
                  <th className="text-right text-caption font-medium text-text-tertiary px-4 py-2.5">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center"><div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" /></td></tr>
                ) : !purchases?.length ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-body-sm text-text-tertiary">কোন ক্রয় নেই</td></tr>
                ) : (
                  purchases.map((p: any) => (
                    <tr key={p.id} className="border-b border-border hover:bg-subtle/50">
                      <td className="px-4 py-3 text-body-sm font-mono font-medium">{p.purchaseNumber}</td>
                      <td className="px-4 py-3 text-body-sm">{supplierMap[p.supplierId] || p.supplierId.slice(0, 8)}</td>
                      <td className="px-4 py-3 text-body-sm">{formatDate(p.purchaseDate)}</td>
                      <td className="px-4 py-3 text-right font-mono text-body-sm">{formatPaisa(p.totalPaisa)}</td>
                      <td className="px-4 py-3 text-right font-mono text-body-sm text-success-600">{formatPaisa(p.paidPaisa)}</td>
                      <td className="px-4 py-3 text-right font-mono text-body-sm font-medium"><span className={p.duePaisa > 0 ? 'text-danger-600' : ''}>{formatPaisa(p.duePaisa)}</span></td>
                      <td className="px-4 py-3"><Badge variant={STATUS_VARIANT[p.status] || 'default'}>{STATUS_LABEL[p.status] || p.status}</Badge></td>
                      <td className="px-4 py-3 text-right"><Button variant="ghost" size="sm" onClick={() => onSelect(p.id)}><Eye size={14} className="mr-1" /> দেখুন</Button></td>
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
