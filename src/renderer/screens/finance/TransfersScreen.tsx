import React, { useState } from 'react';
import { useTransfers, useCreateTransfer } from '../../hooks/useFinance';
import { useFinanceAccounts } from '../../hooks/useSales';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { formatPaisa } from '../../components/pos/POSCartTypes';
import { ArrowLeftRight, Plus } from 'lucide-react';

export const TransfersScreen: React.FC<{ businessId: string }> = ({ businessId }) => {
  const { data: transfers } = useTransfers(businessId);
  const { cashQuery, bankQuery, mfsQuery } = useFinanceAccounts(businessId);
  const createMut = useCreateTransfer();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ sourceType: 'cash' as any, sourceAccountId: '', destType: 'cash' as any, destAccountId: '', amount: '', notes: '' });
  const [error, setError] = useState('');

  const allAccounts = (type: string) => {
    if (type === 'cash') return cashQuery.data || [];
    if (type === 'bank') return bankQuery.data || [];
    if (type === 'mfs') return mfsQuery.data || [];
    return [];
  };

  const handleCreate = async () => {
    try {
      const amountPaisa = Math.round((parseFloat(form.amount) || 0) * 100);
      if (amountPaisa <= 0) { setError('পরিমাণ ০ এর বেশি হতে হবে'); return; }
      if (form.sourceAccountId === form.destAccountId && form.sourceType === form.destType) { setError('একই হিসাবে স্থানান্তর করা যাবে না'); return; }
      await createMut.mutateAsync({ businessId, sourceType: form.sourceType, sourceAccountId: form.sourceAccountId, destType: form.destType, destAccountId: form.destAccountId, amountPaisa, notes: form.notes });
      setShowCreate(false);
      setForm({ sourceType: 'cash', sourceAccountId: '', destType: 'cash', destAccountId: '', amount: '', notes: '' });
      setError('');
    } catch (e: any) { setError(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-h2 font-bold flex items-center gap-2"><ArrowLeftRight size={20} /> হিসাব স্থানান্তর</h1>
        <Button onClick={() => setShowCreate(true)}><Plus size={16} className="mr-1" /> নতুন স্থানান্তর</Button>
      </div>
      {error && <div className="bg-danger-50 border border-danger-200 p-3 rounded text-danger-600 text-body-sm">{error}</div>}

      <Card>
        <CardHeader><CardTitle className="text-body-sm">স্থানান্তর ইতিহাস</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-auto">
          <table className="w-full">
            <thead className="bg-subtle border-y sticky top-0">
              <tr><th className="text-left text-caption px-3 py-2">নম্বর</th><th className="text-left text-caption px-3 py-2">তারিখ</th><th className="text-left text-caption px-3 py-2">উৎস</th><th className="text-left text-caption px-3 py-2">গন্তব্য</th><th className="text-right text-caption px-3 py-2">পরিমাণ</th><th className="text-left text-caption px-3 py-2">নোট</th></tr>
            </thead>
            <tbody>
              {(transfers || []).map((tr: any) => (
                <tr key={tr.id} className="border-b hover:bg-subtle/50">
                  <td className="px-3 py-2 font-mono text-body-sm">{tr.transferNumber}</td>
                  <td className="px-3 py-2 text-caption">{new Date(tr.createdAt).toLocaleString('bn-BD')}</td>
                  <td className="px-3 py-2 text-caption"><Badge>{tr.sourceType}</Badge> {tr.sourceAccountId.slice(0,8)}</td>
                  <td className="px-3 py-2 text-caption"><Badge>{tr.destType}</Badge> {tr.destAccountId.slice(0,8)}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatPaisa(tr.amountPaisa)}</td>
                  <td className="px-3 py-2 text-caption">{tr.notes || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="হিসাব স্থানান্তর" size="lg">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-label block mb-1">উৎস ধরন</label>
              <select value={form.sourceType} onChange={e => setForm({ ...form, sourceType: e.target.value })} className="w-full h-9 px-3 rounded-sm border border-border bg-surface text-body-sm">
                <option value="cash">নগদ</option><option value="bank">ব্যাংক</option><option value="mfs">MFS</option>
              </select>
            </div>
            <div><label className="text-label block mb-1">গন্তব্য ধরন</label>
              <select value={form.destType} onChange={e => setForm({ ...form, destType: e.target.value })} className="w-full h-9 px-3 rounded-sm border border-border bg-surface text-body-sm">
                <option value="cash">নগদ</option><option value="bank">ব্যাংক</option><option value="mfs">MFS</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-label block mb-1">উৎস হিসাব</label>
              <select value={form.sourceAccountId} onChange={e => setForm({ ...form, sourceAccountId: e.target.value })} className="w-full h-9 px-3 rounded-sm border border-border bg-surface text-body-sm">
                <option value="">নির্বাচন করুন</option>
                {allAccounts(form.sourceType).map((a: any) => <option key={a.id} value={a.id}>{a.name || a.bankName || a.accountName} — {formatPaisa(a.currentBalancePaisa)}</option>)}
              </select>
            </div>
            <div><label className="text-label block mb-1">গন্তব্য হিসাব</label>
              <select value={form.destAccountId} onChange={e => setForm({ ...form, destAccountId: e.target.value })} className="w-full h-9 px-3 rounded-sm border border-border bg-surface text-body-sm">
                <option value="">নির্বাচন করুন</option>
                {allAccounts(form.destType).map((a: any) => <option key={a.id} value={a.id}>{a.name || a.bankName || a.accountName} — {formatPaisa(a.currentBalancePaisa)}</option>)}
              </select>
            </div>
          </div>
          <div><label className="text-label block mb-1">পরিমাণ (৳) *</label><Input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
          <div><label className="text-label block mb-1">নোট</label><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="স্থানান্তরের কারণ" /></div>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setShowCreate(false)}>বাতিল</Button><Button onClick={handleCreate} loading={createMut.isPending}>স্থানান্তর করুন</Button></div>
        </div>
      </Modal>
    </div>
  );
};
