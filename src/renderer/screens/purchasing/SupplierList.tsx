import React, { useState, useMemo } from 'react';
import { useSuppliers, useSupplierSearch, useCreateSupplier, useUpdateSupplier, useDeactivateSupplier } from '../../hooks/useSuppliers';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/Badge';
import { Modal, ConfirmDialog } from '../../components/ui/Modal';
import { SupplierForm } from '../../components/purchasing/SupplierForm';
import { EmptyState, TableLoadingState, TableErrorState } from '../../components/ui/States';
import { Search, Plus, Eye, Edit, Power, Building } from 'lucide-react';
import { formatBDTEn } from '../../lib/format';

interface Props {
  businessId: string;
  onSelectSupplier?: (id: string) => void;
}

export const SupplierList: React.FC<Props> = ({ businessId, onSelectSupplier }) => {
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [deactivating, setDeactivating] = useState<any>(null);

  const { data: allSuppliers, isLoading: loadingAll, error: errAll, refetch: refetchAll } = useSuppliers(businessId);
  const { data: searchResults, isLoading: loadingSearch, error: errSearch, refetch: refetchSearch } = useSupplierSearch(businessId, query, includeInactive);

  const suppliers = useMemo(() => {
    if (query.length >= 1) return searchResults || [];
    return allSuppliers || [];
  }, [query, searchResults, allSuppliers]);

  const isLoading = query ? loadingSearch : loadingAll;
  const error = query ? errSearch : errAll;

  const createMut = useCreateSupplier();
  const updateMut = useUpdateSupplier();
  const deactivateMut = useDeactivateSupplier();

  const handleCreate = async (data: any) => {
    try {
      await createMut.mutateAsync({ businessId, ...data });
      setShowForm(false);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleUpdate = async (data: any) => {
    try {
      await updateMut.mutateAsync({ id: editing.id, data });
      setEditing(null);
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-h3 font-semibold tracking-tight">সরবরাহকারী</h1>
          <p className="text-body-sm text-text-secondary mt-0.5">সরবরাহকারী তালিকা ও পাওনা ব্যবস্থাপনা</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="shrink-0">
          <Plus size={14} className="mr-1.5" /> নতুন সরবরাহকারী
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center gap-3 p-3 border-b border-border">
            <div className="relative flex-1 max-w-md min-w-0">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="নাম, কোম্পানি, ফোন দিয়ে খুঁজুন..."
                className="w-full h-8 pl-8 pr-3 rounded-sm border border-border bg-surface text-body-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100 focus-visible:border-primary-400 placeholder:text-text-tertiary"
                aria-label="সরবরাহকারী খুঁজুন"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-sm hover:bg-subtle flex items-center justify-center text-text-tertiary"
                  aria-label="খোঁজা মুছুন"
                >
                  ×
                </button>
              )}
            </div>
            <label className="flex items-center gap-2 text-body-sm shrink-0 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={e => setIncludeInactive(e.target.checked)}
                className="w-4 h-4 rounded-sm border-border text-primary-600 focus:ring-primary-100"
              />
              নিষ্ক্রিয় সহ
            </label>
          </div>

          <div className="overflow-auto">
            <table className="w-full">
              <thead className="bg-subtle border-b border-border sticky top-0 z-10">
                <tr>
                  <th className="text-left text-caption font-medium text-text-tertiary px-4 py-2.5">সরবরাহকারী</th>
                  <th className="text-left text-caption font-medium text-text-tertiary px-4 py-2.5 hidden md:table-cell">যোগাযোগ</th>
                  <th className="text-right text-caption font-medium text-text-tertiary px-4 py-2.5">বর্তমান পাওনা</th>
                  <th className="text-left text-caption font-medium text-text-tertiary px-4 py-2.5">অবস্থা</th>
                  <th className="text-right text-caption font-medium text-text-tertiary px-4 py-2.5 w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="p-0">
                      <TableLoadingState />
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={5} className="p-0">
                      <TableErrorState message={String(error)} onRetry={() => (query ? refetchSearch() : refetchAll())} />
                    </td>
                  </tr>
                ) : suppliers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-0">
                      {query ? (
                        <EmptyState
                          icon={Building}
                          title="কোনো সরবরাহকারী পাওয়া যায়নি"
                          description={`"${query}" দিয়ে কোনো সরবরাহকারী পাওয়া যায়নি।`}
                          actionLabel="খোঁজা মুছুন"
                          onAction={() => setQuery('')}
                        />
                      ) : (
                        <EmptyState
                          icon={Building}
                          title="কোনো সরবরাহকারী নেই"
                          description="এখনো কোনো সরবরাহকারী যোগ করা হয়নি। প্রথম সরবরাহকারী যোগ করে শুরু করুন।"
                          actionLabel="নতুন সরবরাহকারী"
                          onAction={() => setShowForm(true)}
                        />
                      )}
                    </td>
                  </tr>
                ) : (
                  suppliers.map((s: any) => (
                    <tr key={s.id} className="hover:bg-subtle/50 transition-colors">
                      <td className="px-4 py-3 min-w-0">
                        <p className="text-body-sm font-medium truncate max-w-[220px]" title={s.name}>
                          {s.name}
                        </p>
                        {s.companyName && (
                          <p className="text-caption text-text-tertiary flex items-center gap-1 truncate max-w-[220px]" title={s.companyName}>
                            <Building size={12} className="shrink-0" /> {s.companyName}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="space-y-0.5 min-w-0">
                          {s.phone && <p className="text-body-sm text-text-secondary tabular-nums">{s.phone}</p>}
                          {s.email && (
                            <p className="text-caption text-text-tertiary truncate max-w-[180px]" title={s.email}>
                              {s.email}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-body-sm tabular-nums font-medium ${s.currentPayablePaisa > 0 ? 'text-danger-600' : 'text-text-primary'}`}>
                          {formatBDTEn(s.currentPayablePaisa)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={s.isActive ? 'active' : 'inactive'} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => onSelectSupplier?.(s.id)}
                            className="w-7 h-7 rounded-sm hover:bg-subtle flex items-center justify-center text-text-tertiary hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
                            aria-label={`বিস্তারিত ${s.name}`}
                            title="বিস্তারিত"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() => setEditing(s)}
                            className="w-7 h-7 rounded-sm hover:bg-subtle flex items-center justify-center text-text-tertiary hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
                            aria-label={`সম্পাদনা ${s.name}`}
                            title="সম্পাদনা"
                          >
                            <Edit size={14} />
                          </button>
                          {s.isActive && (
                            <button
                              onClick={() => setDeactivating(s)}
                              className="w-7 h-7 rounded-sm hover:bg-danger-50 flex items-center justify-center text-text-tertiary hover:text-danger-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-100"
                              aria-label={`নিষ্ক্রিয় ${s.name}`}
                              title="নিষ্ক্রিয়"
                            >
                              <Power size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="নতুন সরবরাহকারী যোগ করুন" size="lg">
        <SupplierForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} loading={createMut.isPending} />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="সরবরাহকারী সম্পাদনা" size="lg">
        {editing && <SupplierForm initialData={editing} onSubmit={handleUpdate} onCancel={() => setEditing(null)} loading={updateMut.isPending} />}
      </Modal>

      <ConfirmDialog
        open={!!deactivating}
        onClose={() => setDeactivating(null)}
        onConfirm={async () => {
          try {
            await deactivateMut.mutateAsync(deactivating.id);
            setDeactivating(null);
          } catch (e: any) {
            alert(e.message);
          }
        }}
        title="সরবরাহকারী নিষ্ক্রিয় করুন"
        description={`"${deactivating?.name}" সরবরাহকারীকে নিষ্ক্রিয় করতে চান? নিষ্ক্রিয় সরবরাহকারী নতুন ক্রয়ে দেখা যাবে না, তবে পুরনো রেকর্ড অক্ষত থাকবে।`}
        confirmLabel="নিষ্ক্রিয় করুন"
        variant="danger"
        loading={deactivateMut.isPending}
      />
    </div>
  );
};
