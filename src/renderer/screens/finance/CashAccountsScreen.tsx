import React, { useState } from 'react';
import { useCashAccounts, useCreateCashAccount, useCashStatement } from '../../hooks/useFinance';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { formatPaisa } from '../../components/pos/POSCartTypes';
import { Badge } from '../../components/ui/Badge';
import { Plus, Wallet, Eye } from 'lucide-react';

export const CashAccountsScreen: React.FC<{ businessId: string }> = ({ businessId }) => {
  const { data: accounts, isLoading } = useCashAccounts(businessId);
  const createMut = useCreateCashAccount();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', openingBalance: '0', isDefault: false });
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [error, setError] = useState('');

  const { data: statement } = useCashStatement(selectedAccount);

  const handleCreate = async () => {
    try {
      if (!form.name.trim()) { setError('হিসাবের নাম প্রয়োজন'); return; }
      const openingPaisa = Math.round((parseFloat(form.openingBalance) || 0) * 100);
      await createMut.mutateAsync({ businessId, name: form.name, openingBalancePaisa: openingPaisa, isDefault: form.isDefault });
      setShowCreate(false);
      setForm({ name: '', openingBalance: '0', isDefault: false });
      setError('');
    } catch (e: any) { setError(e.message); }
  };

  if (isLoading) return <div className="p-6">লোড হচ্ছে...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-h2 font-bold flex items-center gap-2"><Wallet size={20} /> নগদ হিসাব</h1>
        <Button onClick={() => setShowCreate(true)}><Plus size={16} className="mr-1" /> নতুন হিসাব</Button>
      </div>

      {error && <div className="bg-danger-50 border border-danger-200 p-3 rounded text-danger-600 text-body-sm">{error}</div>}

      <div className="grid grid-cols-3 gap-3">
        {(accounts || []).map((acc: any) => (
          <Card key={acc.id} className={`${selectedAccount === acc.id ? 'border-primary-300 bg-primary-50' : ''} cursor-pointer`} >
            <CardHeader className="pb-2 flex flex-row justify-between items-start">
              <CardTitle className="text-body-sm">{acc.name}</CardTitle>
              <div className="flex gap-1">
                {acc.isDefault && <Badge variant="default">ডিফল্ট</Badge>}
                {!acc.isActive && <Badge variant="danger">নিষ্ক্রিয়</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-h3 font-mono">{formatPaisa(acc.currentBalancePaisa)}</p>
              <p className="text-caption text-text-tertiary">ওপেনিং: {formatPaisa(acc.openingBalancePaisa)}</p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setSelectedAccount(acc.id)}><Eye size={14} className="mr-1" /> লেনদেন</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedAccount && (
        <Card>
          <CardHeader><CardTitle className="text-body-sm">লেনদেন ইতিহাস — {selectedAccount}</CardTitle></CardHeader>
          <CardContent className="p-0 overflow-auto max-h-[400px]">
            <table className="w-full">
              <thead className="bg-subtle sticky top-0 border-y">
                <tr>
                  <th className="text-left text-caption px-3 py-2">তারিখ</th>
                  <th className="text-left text-caption px-3 py-2">ধরন</th>
                  <th className="text-right text-caption px-3 py-2">পরিমাণ</th>
                  <th className="text-right text-caption px-3 py-2">ব্যালেন্স</th>
                  <th className="text-left text-caption px-3 py-2">নোট</th>
                </tr>
              </thead>
              <tbody>
                {(statement || []).map((row: any) => (
                  <tr key={row.movement.id} className="border-b hover:bg-subtle/50">
                    <td className="px-3 py-2 text-caption">{new Date(row.movement.createdAt).toLocaleString('bn-BD')}</td>
                    <td className="px-3 py-2 text-caption"><Badge variant="default">{row.movement.movementType}</Badge></td>
                    <td className={`px-3 py-2 text-right font-mono text-body-sm ${row.movement.amountPaisa > 0 ? 'text-success-600' : 'text-danger-600'}`}>{formatPaisa(row.movement.amountPaisa)}</td>
                    <td className="px-3 py-2 text-right font-mono text-body-sm">{formatPaisa(row.runningBalance)}</td>
                    <td className="px-3 py-2 text-caption">{row.movement.notes || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="নতুন নগদ হিসাব" size="md">
        <div className="space-y-3">
          <div><label className="text-label block mb-1">নাম *</label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Main Cash" /></div>
          <div><label className="text-label block mb-1">ওপেনিং ব্যালেন্স (৳)</label><Input type="number" step="0.01" value={form.openingBalance} onChange={e => setForm({ ...form, openingBalance: e.target.value })} /></div>
          <div className="flex items-center gap-2"><input type="checkbox" checked={form.isDefault} onChange={e => setForm({ ...form, isDefault: e.target.checked })} /><span className="text-body-sm">ডিফল্ট হিসাব</span></div>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setShowCreate(false)}>বাতিল</Button><Button onClick={handleCreate} loading={createMut.isPending}>তৈরি করুন</Button></div>
        </div>
      </Modal>
    </div>
  );
};
