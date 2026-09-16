
import React, { useState } from 'react';
import { useTransfers, useCreateTransfer } from '../../hooks/useFinance';
import { useFinanceAccounts } from '../../hooks/useSales';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { EmptyState, TableLoadingState, TableErrorState } from '../../components/ui/States';
import { formatBDTEn } from '../../lib/format';
import { Plus, ArrowLeftRight } from 'lucide-react';

export const TransfersScreen: React.FC<{ businessId: string }> = ({ businessId }) => {
  const { data: transfers, isLoading, error, refetch } = useTransfers(businessId) as any;
  const { cashQuery, bankQuery, mfsQuery } = useFinanceAccounts(businessId);
  const createMut = useCreateTransfer();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ amount: '', fromType: 'cash', fromId: '', toType: 'cash', toId: '', notes: '' });
  const [errMsg, setErrMsg] = useState('');

  const getAccounts = (type: string) => {
    if (type === 'cash') return cashQuery.data || [];
    if (type === 'bank') return bankQuery.data || [];
    return mfsQuery.data || [];
  };

  const handleCreate = async () => {
    try {
      const amountPaisa = Math.round((parseFloat(form.amount) || 0) * 100);
      if (amountPaisa <= 0) { setErrMsg('পরিমাণ ০ এর বেশি হতে হবে'); return; }
      if (!form.fromId || !form.toId) { setErrMsg('উৎস ও গন্তব্য হিসাব আবশ্যক'); return; }
      if (form.fromId === form.toId) { setErrMsg('একই হিসাবে স্থানান্তর করা যায় না'); return; }
      await createMut.mutateAsync({ businessId, amountPaisa, fromAccountType: form.fromType, fromAccountId: form.fromId, toAccountType: form.toType, toAccountId: form.toId, notes: form.notes });
      setShowCreate(false);
      setForm({ amount: '', fromType: 'cash', fromId: '', toType: 'cash', toId: '', notes: '' });
      setErrMsg('');
    } catch (e: any) { setErrMsg(e.message); }
  };

  if (isLoading) return <TableLoadingState />;
  if (error) return <TableErrorState message={String(error)} onRetry={() => refetch?.()} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0"><h1 className="text-h3 font-semibold tracking-tight flex items-center gap-2"><ArrowLeftRight size={18} className="text-text-tertiary" /> স্থানান্তর</h1><p className="text-body-sm text-text-secondary mt-0.5">হিসাব থেকে হিসাবে স্থানান্তর</p></div>
        <Button onClick={() => setShowCreate(true)} className="shrink-0"><Plus size={14} className="mr-1.5" /> নতুন স্থানান্তর</Button>
      </div>
      {errMsg && <div className="bg-danger-50 border border-danger-200 p-2.5 rounded-sm text-danger-700 text-body-sm">{errMsg}</div>}

      <Card>
        <CardHeader className="pb-2 pt-3"><CardTitle className="text-body-sm">স্থানান্তর তালিকা</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-auto">
          {!transfers?.length ? <EmptyState icon={ArrowLeftRight} title="কোনো স্থানান্তর নেই" description="এই সময়সীমায় কোনো তথ্য পাওয়া যায়নি।" actionLabel="নতুন স্থানান্তর" onAction={() => setShowCreate(true)} /> : (
            <table className="w-full">
              <thead className="bg-subtle border-y border-border sticky top-0"><tr><th className="text-left text-caption font-medium text-text-tertiary px-3 py-2">নম্বর</th><th className="text-left text-caption font-medium text-text-tertiary px-3 py-2">তারিখ</th><th className="text-left text-caption font-medium text-text-tertiary px-3 py-2">থেকে</th><th className="text-left text-caption font-medium text-text-tertiary px-3 py-2">এ</th><th className="text-right text-caption font-medium text-text-tertiary px-3 py-2">পরিমাণ</th><th className="text-left text-caption font-medium text-text-tertiary px-3 py-2">অবস্থা</th></tr></thead>
              <tbody className="divide-y divide-border">
                {(transfers || []).map((t: any) => (
                  <tr key={t.id} className="hover:bg-subtle/50"><td className="px-3 py-2.5 font-mono text-body-sm tabular-nums">{t.transferNumber}</td><td className="px-3 py-2.5 text-caption tabular-nums">{new Date(t.transferDate).toLocaleDateString('bn-BD')}</td><td className="px-3 py-2.5 text-body-sm"><Badge variant="outline" className="text-[11px]">{t.fromAccountType}</Badge> <span className="font-mono text-caption">{t.fromAccountId.slice(0,8)}</span></td><td className="px-3 py-2.5 text-body-sm"><Badge variant="outline" className="text-[11px]">{t.toAccountType}</Badge> <span className="font-mono text-caption">{t.toAccountId.slice(0,8)}</span></td><td className="px-3 py-2.5 text-right tabular-nums font-medium">{formatBDTEn(t.amountPaisa)}</td><td className="px-3 py-2.5"><Badge variant={t.status === 'voided' ? 'danger' : 'success'}>{t.status === 'voided' ? 'বাতিল' : 'সম্পন্ন'}</Badge></td></tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="নতুন স্থানান্তর" size="lg">
        <div className="space-y-4">
          <Input label="পরিমাণ (৳)" required type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} autoFocus />
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-label block mb-1.5">থেকে — ধরন</label><select value={form.fromType} onChange={e => setForm({ ...form, fromType: e.target.value, fromId: '' })} className="w-full h-9 px-2.5 rounded-sm border border-border bg-surface text-body-sm"><option value="cash">নগদ</option><option value="bank">ব্যাংক</option><option value="mfs">MFS</option></select></div>
            <div><label className="text-label block mb-1.5">থেকে — হিসাব <span className="text-danger-500">*</span></label><select value={form.fromId} onChange={e => setForm({ ...form, fromId: e.target.value })} className="w-full h-9 px-2.5 rounded-sm border border-border bg-surface text-body-sm"><option value="">হিসাব নির্বাচন</option>{getAccounts(form.fromType).map((a: any) => <option key={a.id} value={a.id}>{a.name} — {formatBDTEn(a.currentBalancePaisa)}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-label block mb-1.5">এ — ধরন</label><select value={form.toType} onChange={e => setForm({ ...form, toType: e.target.value, toId: '' })} className="w-full h-9 px-2.5 rounded-sm border border-border bg-surface text-body-sm"><option value="cash">নগদ</option><option value="bank">ব্যাংক</option><option value="mfs">MFS</option></select></div>
            <div><label className="text-label block mb-1.5">এ — হিসাব <span className="text-danger-500">*</span></label><select value={form.toId} onChange={e => setForm({ ...form, toId: e.target.value })} className="w-full h-9 px-2.5 rounded-sm border border-border bg-surface text-body-sm"><option value="">হিসাব নির্বাচন</option>{getAccounts(form.toType).map((a: any) => <option key={a.id} value={a.id}>{a.name} — {formatBDTEn(a.currentBalancePaisa)}</option>)}</select></div>
          </div>
          <Input label="নোট" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="বিবরণ" />
          <div className="flex justify-end gap-2 pt-3 border-t border-border"><Button variant="secondary" onClick={() => setShowCreate(false)}>বাতিল</Button><Button onClick={handleCreate} loading={createMut.isPending}>স্থানান্তর করুন</Button></div>
        </div>
      </Modal>
    </div>
  );
};
