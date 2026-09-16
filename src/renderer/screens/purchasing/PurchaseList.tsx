import React, { useState, useMemo } from 'react';
import { usePurchases } from '../../hooks/usePurchases';
import { useSuppliers } from '../../hooks/useSuppliers';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/Badge';
import { EmptyState, TableLoadingState, TableErrorState } from '../../components/ui/States';
import { Search, Plus, Eye, ShoppingBag } from 'lucide-react';
import { formatBDTEn, formatDate } from '../../lib/format';

export const PurchaseList: React.FC<{ businessId: string; onSelect: (id: string) => void; onCreate: () => void }> = ({ businessId, onSelect, onCreate }) => {
  const [filters, setFilters] = useState<{ supplierId?: string; status?: string; search?: string; fromDate?: number; toDate?: number }>({});
  const [searchInput, setSearchInput] = useState('');

  const { data: purchases, isLoading, error, refetch } = usePurchases(businessId, filters, 100, 0);
  const { data: suppliers } = useSuppliers(businessId);

  const supplierMap = useMemo(() => {
    const m: Record<string, string> = {};
    (suppliers || []).forEach((s: any) => (m[s.id] = s.name));
    return m;
  }, [suppliers]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-h3 font-semibold tracking-tight">ক্রয়</h1>
          <p className="text-body-sm text-text-secondary mt-0.5">ক্রয় তালিকা ও পাওনা ব্যবস্থাপনা</p>
        </div>
        <Button onClick={onCreate} className="shrink-0">
          <Plus size={14} className="mr-1.5" /> নতুন ক্রয়
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-wrap items-end gap-3 p-3 border-b border-border">
            <div className="flex-1 min-w-[200px]">
              <label className="text-caption font-medium text-text-secondary block mb-1">খুঁজুন</label>
              <div className="flex gap-1.5">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
                  <input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="ক্রয় নম্বর..." className="w-full h-8 pl-8 pr-2 rounded-sm border border-border bg-surface text-body-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100 placeholder:text-text-tertiary" onKeyDown={e => e.key === 'Enter' && setFilters({ ...filters, search: searchInput })} />
                </div>
                <Button variant="secondary" size="sm" onClick={() => setFilters({ ...filters, search: searchInput })} className="h-8 shrink-0">
                  খুঁজুন
                </Button>
              </div>
            </div>
            <div>
              <label className="text-caption font-medium text-text-secondary block mb-1">সরবরাহকারী</label>
              <select value={filters.supplierId || ''} onChange={e => setFilters({ ...filters, supplierId: e.target.value || undefined })} className="h-8 px-2.5 rounded-sm border border-border bg-surface text-body-sm min-w-[140px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100">
                <option value="">সব সরবরাহকারী</option>
                {(suppliers || []).map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-caption font-medium text-text-secondary block mb-1">অবস্থা</label>
              <select value={filters.status || ''} onChange={e => setFilters({ ...filters, status: e.target.value || undefined })} className="h-8 px-2.5 rounded-sm border border-border bg-surface text-body-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100">
                <option value="">সব</option>
                <option value="received">গৃহীত</option>
                <option value="partially_paid">আংশিক</option>
                <option value="paid">পরিশোধিত</option>
                <option value="cancelled">বাতিল</option>
              </select>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilters({});
                setSearchInput('');
              }}
              className="h-8"
            >
              রিসেট
            </Button>
          </div>

          <div className="overflow-auto">
            <table className="w-full">
              <thead className="bg-subtle border-b border-border sticky top-0 z-10">
                <tr>
                  <th className="text-left text-caption font-medium text-text-tertiary px-4 py-2.5">ক্রয় নম্বর</th>
                  <th className="text-left text-caption font-medium text-text-tertiary px-4 py-2.5">সরবরাহকারী</th>
                  <th className="text-left text-caption font-medium text-text-tertiary px-4 py-2.5 hidden lg:table-cell">তারিখ</th>
                  <th className="text-right text-caption font-medium text-text-tertiary px-4 py-2.5">মোট</th>
                  <th className="text-right text-caption font-medium text-text-tertiary px-4 py-2.5 hidden md:table-cell">পরিশোধ</th>
                  <th className="text-right text-caption font-medium text-text-tertiary px-4 py-2.5">বাকি</th>
                  <th className="text-left text-caption font-medium text-text-tertiary px-4 py-2.5">অবস্থা</th>
                  <th className="text-right text-caption font-medium text-text-tertiary px-4 py-2.5 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="p-0">
                      <TableLoadingState />
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={8} className="p-0">
                      <TableErrorState message={String(error)} onRetry={() => refetch()} />
                    </td>
                  </tr>
                ) : !purchases?.length ? (
                  <tr>
                    <td colSpan={8} className="p-0">
                      <EmptyState icon={ShoppingBag} title="কোনো ক্রয় নেই" description="এই সময়সীমায় কোনো তথ্য পাওয়া যায়নি।" actionLabel="নতুন ক্রয়" onAction={onCreate} />
                    </td>
                  </tr>
                ) : (
                  purchases.map((p: any) => (
                    <tr key={p.id} className="hover:bg-subtle/50 transition-colors">
                      <td className="px-4 py-3 text-body-sm font-mono font-medium tabular-nums">{p.purchaseNumber}</td>
                      <td className="px-4 py-3 text-body-sm truncate max-w-[160px]" title={supplierMap[p.supplierId]}>
                        {supplierMap[p.supplierId] || <span className="font-mono text-caption">{p.supplierId.slice(0, 8)}</span>}
                      </td>
                      <td className="px-4 py-3 text-body-sm hidden lg:table-cell tabular-nums">{formatDate(p.purchaseDate)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-body-sm font-medium">{formatBDTEn(p.totalPaisa)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-body-sm text-success-600 hidden md:table-cell">{formatBDTEn(p.paidPaisa)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-body-sm font-medium">
                        <span className={p.duePaisa > 0 ? 'text-danger-600' : ''}>{formatBDTEn(p.duePaisa)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => onSelect(p.id)} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-sm border border-border bg-surface hover:bg-subtle text-body-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100" aria-label={`দেখুন ${p.purchaseNumber}`}>
                          <Eye size={12} /> দেখুন
                        </button>
                      </td>
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
