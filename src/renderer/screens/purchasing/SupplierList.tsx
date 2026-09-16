import React, { useState, useMemo } from 'react';
import { useSuppliers, useSupplierSearch, useCreateSupplier, useUpdateSupplier, useDeactivateSupplier } from '../../hooks/useSuppliers';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { SupplierForm } from '../../components/purchasing/SupplierForm';
import { Search, Plus, Eye, Edit, Power, Phone, Building } from 'lucide-react';

interface Props {
  businessId: string;
  onSelectSupplier?: (id: string) => void;
}

function formatPaisa(paisa: number): string {
  const bdt = paisa / 100;
  return `৳ ${bdt.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('bn-BD', { year: 'numeric', month: 'short', day: 'numeric' });
}

export const SupplierList: React.FC<Props> = ({ businessId, onSelectSupplier }) => {
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [includeInactive, setIncludeInactive] = useState(false);

  const { data: allSuppliers, isLoading: loadingAll } = useSuppliers(businessId);
  const { data: searchResults, isLoading: loadingSearch } = useSupplierSearch(businessId, query, includeInactive);

  const suppliers = useMemo(() => {
    if (query.length >= 1) return searchResults || [];
    return allSuppliers || [];
  }, [query, searchResults, allSuppliers]);

  const isLoading = query ? loadingSearch : loadingAll;

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

  const handleDeactivate = async (id: string) => {
    if (!confirm('এই সাপ্লায়ারকে নিষ্ক্রিয় করতে চান?')) return;
    try {
      await deactivateMut.mutateAsync(id);
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-text-primary">সাপ্লায়ার</h1>
          <p className="text-body-sm text-text-secondary mt-1">সাপ্লায়ার তালিকা ও বকেয়া ব্যবস্থাপনা</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus size={16} className="mr-2" /> নতুন সাপ্লায়ার
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
              <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="নাম, কোম্পানি, ফোন দিয়ে খুঁজুন..." className="pl-9" />
            </div>
            <label className="flex items-center gap-2 text-body-sm">
              <input type="checkbox" checked={includeInactive} onChange={e => setIncludeInactive(e.target.checked)} />
              নিষ্ক্রিয় সহ
            </label>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <table className="w-full">
              <thead className="bg-subtle border-y border-border">
                <tr>
                  <th className="text-left text-caption font-medium text-text-tertiary px-4 py-2.5">সাপ্লায়ার</th>
                  <th className="text-left text-caption font-medium text-text-tertiary px-4 py-2.5">যোগাযোগ</th>
                  <th className="text-right text-caption font-medium text-text-tertiary px-4 py-2.5">বর্তমান বকেয়া</th>
                  <th className="text-left text-caption font-medium text-text-tertiary px-4 py-2.5">অবস্থা</th>
                  <th className="text-right text-caption font-medium text-text-tertiary px-4 py-2.5">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-body-sm text-text-secondary">লোড হচ্ছে...</span>
                      </div>
                    </td>
                  </tr>
                ) : suppliers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Building size={32} className="text-text-tertiary" />
                        <p className="text-body-sm text-text-secondary">কোন সাপ্লায়ার নেই</p>
                        <p className="text-caption text-text-tertiary">নতুন সাপ্লায়ার যোগ করুন</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  suppliers.map((s: any) => (
                    <tr key={s.id} className="border-b border-border hover:bg-subtle/50 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-body-sm font-medium text-text-primary">{s.name}</p>
                          {s.companyName && <p className="text-caption text-text-tertiary flex items-center gap-1"><Building size={12} /> {s.companyName}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          {s.phone && <p className="text-body-sm text-text-secondary flex items-center gap-1"><Phone size={12} /> {s.phone}</p>}
                          {s.email && <p className="text-caption text-text-tertiary">{s.email}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-body-sm font-mono font-medium ${s.currentPayablePaisa > 0 ? 'text-danger-600' : 'text-text-primary'}`}>
                          {formatPaisa(s.currentPayablePaisa)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={s.isActive ? 'success' : 'default'}>{s.isActive ? 'সক্রিয়' : 'নিষ্ক্রিয়'}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => onSelectSupplier?.(s.id)} title="বিস্তারিত">
                            <Eye size={16} />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setEditing(s)} title="সম্পাদনা">
                            <Edit size={16} />
                          </Button>
                          {s.isActive && (
                            <Button variant="ghost" size="icon" onClick={() => handleDeactivate(s.id)} title="নিষ্ক্রিয়">
                              <Power size={16} />
                            </Button>
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

      <Modal open={showForm} onClose={() => setShowForm(false)} title="নতুন সাপ্লায়ার যোগ করুন" size="lg">
        <SupplierForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} loading={createMut.isPending} />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="সাপ্লায়ার সম্পাদনা" size="lg">
        {editing && <SupplierForm initialData={editing} onSubmit={handleUpdate} onCancel={() => setEditing(null)} loading={updateMut.isPending} />}
      </Modal>
    </div>
  );
};
