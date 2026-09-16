import React, { useState } from 'react';
import { useMfsAccounts, useMfsProviders, useCreateMfsAccount, useMfsStatement } from '../../hooks/useFinance';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { formatPaisa } from '../../components/pos/POSCartTypes';
import { Badge } from '../../components/ui/Badge';
import { Plus, Smartphone, Eye } from 'lucide-react';

export const MfsAccountsScreen: React.FC<{ businessId: string }> = ({ businessId }) => {
  const { data: accounts, isLoading } = useMfsAccounts(businessId);
  const { data: providers } = useMfsProviders();
  const createMut = useCreateMfsAccount();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ providerId: '', accountNumber: '', accountName: '', openingBalance: '0', commissionRate: '0', isAgent: true });
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [error, setError] = useState('');
  const { data: statement } = useMfsStatement(selectedAccount);

  const handleCreate = async () => {
    try {
      if (!form.providerId) { setError('প্রোভাইডার প্রয়োজন'); return; }
      if (!form.accountNumber.trim()) { setError('অ্যাকাউন্ট নম্বর প্রয়োজন'); return; }
      const openingPaisa = Math.round((parseFloat(form.openingBalance) || 0) * 100);
      const commissionRate = parseFloat(form.commissionRate) || 0;
      await createMut.mutateAsync({ businessId, providerId: form.providerId, accountNumber: form.accountNumber, accountName: form.accountName, openingBalancePaisa: openingPaisa, commissionRate, isAgent: form.isAgent });
      setShowCreate(false);
      setForm({ providerId: '', accountNumber: '', accountName: '', openingBalance: '0', commissionRate: '0', isAgent: true });
      setError('');
    } catch (e: any) { setError(e.message); }
  };

  if (isLoading) return <div className="p-6">লোড হচ্ছে...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-h2 font-bold flex items-center gap-2"><Smartphone size={20} /> মোবাইল ফাইন্যান্স (MFS)</h1>
        <Button onClick={() => setShowCreate(true)}><Plus size={16} className="mr-1" /> নতুন MFS হিসাব</Button>
      </div>
      {error && <div className="bg-danger-50 border border-danger-200 p-3 rounded text-danger-600 text-body-sm">{error}</div>}
      <div className="grid grid-cols-3 gap-3">
        {(accounts || []).map((acc: any) => {
          const prov = (providers || []).find((p: any) => p.id === acc.providerId);
          return (
            <Card key={acc.id} className={selectedAccount === acc.id ? 'border-primary-300 bg-primary-50' : ''}>
              <CardHeader className="pb-2 flex flex-row justify-between">
                <CardTitle className="text-body-sm">{prov?.name || acc.providerId} {acc.accountName ? `— ${acc.accountName}` : ''}</CardTitle>
                <Badge variant={acc.isAgent ? 'primary' : 'muted'}>{acc.isAgent ? 'এজেন্ট' : 'পার্সোনাল'}</Badge>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-h3 font-mono">{formatPaisa(acc.currentBalancePaisa)}</p>
                <p className="text-caption font-mono text-text-tertiary">A/C: ****{acc.accountNumber.slice(-4)} • কমিশন: {acc.commissionRate}%</p>
                <Button variant="secondary" size="sm" onClick={() => setSelectedAccount(acc.id)}><Eye size={14} className="mr-1" /> লেনদেন</Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedAccount && (
        <Card>
          <CardHeader><CardTitle className="text-body-sm">MFS লেনদেন — চার্জ/কমিশন সহ</CardTitle></CardHeader>
          <CardContent className="p-0 overflow-auto max-h-[500px]">
            <table className="w-full">
              <thead className="bg-subtle sticky top-0 border-y">
                <tr><th className="text-left text-caption px-3 py-2">তারিখ</th><th className="text-left text-caption px-3 py-2">ধরন</th><th className="text-right text-caption px-3 py-2">পরিমাণ</th><th className="text-right text-caption px-3 py-2">চার্জ</th><th className="text-right text-caption px-3 py-2">কমিশন</th><th className="text-right text-caption px-3 py-2">নেট</th><th className="text-right text-caption px-3 py-2">ব্যালেন্স</th><th className="text-left text-caption px-3 py-2">নোট</th></tr>
              </thead>
              <tbody>
                {(statement || []).map((row: any) => (
                  <tr key={row.transaction.id} className="border-b hover:bg-subtle/50">
                    <td className="px-3 py-2 text-caption">{new Date(row.transaction.createdAt).toLocaleString('bn-BD')}</td>
                    <td className="px-3 py-2 text-caption"><Badge>{row.transaction.transactionType}</Badge></td>
                    <td className="px-3 py-2 text-right font-mono text-body-sm">{formatPaisa(row.transaction.amountPaisa)}</td>
                    <td className="px-3 py-2 text-right font-mono text-caption text-text-tertiary">{formatPaisa(row.transaction.customerChargePaisa)}</td>
                    <td className="px-3 py-2 text-right font-mono text-caption text-success-600">{formatPaisa(row.transaction.commissionPaisa)}</td>
                    <td className={`px-3 py-2 text-right font-mono text-body-sm ${row.transaction.netAmountPaisa > 0 ? 'text-success-600' : 'text-danger-600'}`}>{formatPaisa(row.transaction.netAmountPaisa)}</td>
                    <td className="px-3 py-2 text-right font-mono text-body-sm">{formatPaisa(row.runningBalance)}</td>
                    <td className="px-3 py-2 text-caption">{row.transaction.notes || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="নতুন MFS হিসাব" size="md">
        <div className="space-y-3">
          <div><label className="text-label block mb-1">প্রোভাইডার *</label>
            <select value={form.providerId} onChange={e => setForm({ ...form, providerId: e.target.value })} className="w-full h-9 px-3 rounded-sm border border-border bg-surface text-body-sm">
              <option value="">প্রোভাইডার নির্বাচন করুন</option>
              {(providers || []).map((p: any) => <option key={p.id} value={p.id}>{p.name} — {p.nameBn}</option>)}
            </select>
          </div>
          <div><label className="text-label block mb-1">অ্যাকাউন্ট নম্বর *</label><Input value={form.accountNumber} onChange={e => setForm({ ...form, accountNumber: e.target.value })} placeholder="017..." /></div>
          <div><label className="text-label block mb-1">হিসাবের নাম</label><Input value={form.accountName} onChange={e => setForm({ ...form, accountName: e.target.value })} placeholder="দোকানের bKash" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-label block mb-1">ওপেনিং (৳)</label><Input type="number" step="0.01" value={form.openingBalance} onChange={e => setForm({ ...form, openingBalance: e.target.value })} /></div>
            <div><label className="text-label block mb-1">কমিশন %</label><Input type="number" step="0.01" value={form.commissionRate} onChange={e => setForm({ ...form, commissionRate: e.target.value })} /></div>
          </div>
          <div className="flex items-center gap-2"><input type="checkbox" checked={form.isAgent} onChange={e => setForm({ ...form, isAgent: e.target.checked })} /><span className="text-body-sm">এজেন্ট হিসাব</span></div>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setShowCreate(false)}>বাতিল</Button><Button onClick={handleCreate} loading={createMut.isPending}>তৈরি করুন</Button></div>
        </div>
      </Modal>
    </div>
  );
};
