
import React, { useState } from 'react';
import { useExpenses, useExpenseCategories, useCreateExpense, useVoidExpense } from '../../hooks/useFinance';
import { useFinanceAccounts } from '../../hooks/useSales';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal, ConfirmDialog } from '../../components/ui/Modal';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { EmptyState, TableLoadingState, TableErrorState } from '../../components/ui/States';
import { formatBDTEn } from '../../lib/format';
import { Plus, Receipt, Trash2 } from 'lucide-react';

export const ExpensesScreen: React.FC<{ businessId: string }> = ({ businessId }) => {
  const { data: expenses, isLoading, error, refetch } = useExpenses(businessId, 100, 0) as any;
  const { data: categories } = useExpenseCategories(businessId);
  const { cashQuery, bankQuery, mfsQuery } = useFinanceAccounts(businessId);
  const createMut = useCreateExpense();
  const voidMut = useVoidExpense();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ categoryId: '', amount: '', paymentMethod: 'cash', cashAccountId: '', bankAccountId: '', mfsAccountId: '', reference: '', notes: '' });
  const [errMsg, setErrMsg] = useState('');
  const [voiding, setVoiding] = useState<any>(null);
  const [voidReason, setVoidReason] = useState('');

  const handleCreate = async () => {
    try {
      if (!form.categoryId) { setErrMsg('খরচের ক্যাটাগরি আবশ্যক'); return; }
      const amountPaisa = Math.round((parseFloat(form.amount) || 0) * 100);
      if (amountPaisa <= 0) { setErrMsg('পরিমাণ ০ এর বেশি হতে হবে'); return; }
      await createMut.mutateAsync({ businessId, categoryId: form.categoryId, amountPaisa, paymentMethod: form.paymentMethod, cashAccountId: form.cashAccountId || undefined, bankAccountId: form.bankAccountId || undefined, mfsAccountId: form.mfsAccountId || undefined, reference: form.reference, notes: form.notes });
      setShowCreate(false);
      setForm({ categoryId: '', amount: '', paymentMethod: 'cash', cashAccountId: '', bankAccountId: '', mfsAccountId: '', reference: '', notes: '' });
      setErrMsg('');
    } catch (e: any) { setErrMsg(e.message); }
  };

  if (isLoading) return <TableLoadingState />;
  if (error) return <TableErrorState message={String(error)} onRetry={() => refetch?.()} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0"><h1 className="text-h3 font-semibold tracking-tight flex items-center gap-2"><Receipt size={18} className="text-text-tertiary" /> খরচ</h1><p className="text-body-sm text-text-secondary mt-0.5">ব্যবসার খরচ ব্যবস্থাপনা</p></div>
        <Button onClick={() => setShowCreate(true)} className="shrink-0"><Plus size={14} className="mr-1.5" /> খরচ যোগ</Button>
      </div>
      {errMsg && <div className="bg-danger-50 border border-danger-200 p-2.5 rounded-sm text-danger-700 text-body-sm">{errMsg}</div>}

      <Card>
        <CardHeader className="pb-2 pt-3"><CardTitle className="text-body-sm">খরচ তালিকা</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-auto">
          {!expenses?.length ? <EmptyState icon={Receipt} title="কোনো খরচ নেই" description="এই সময়সীমায় কোনো তথ্য পাওয়া যায়নি।" actionLabel="খরচ যোগ" onAction={() => setShowCreate(true)} /> : (
            <table className="w-full">
              <thead className="bg-subtle border-y border-border sticky top-0"><tr><th className="text-left text-caption font-medium text-text-tertiary px-3 py-2">নম্বর</th><th className="text-left text-caption font-medium text-text-tertiary px-3 py-2">তারিখ</th><th className="text-left text-caption font-medium text-text-tertiary px-3 py-2">ক্যাটাগরি</th><th className="text-right text-caption font-medium text-text-tertiary px-3 py-2">পরিমাণ</th><th className="text-left text-caption font-medium text-text-tertiary px-3 py-2">পদ্ধতি</th><th className="text-left text-caption font-medium text-text-tertiary px-3 py-2">অবস্থা</th><th className="text-right text-caption font-medium text-text-tertiary px-3 py-2 w-16"></th></tr></thead>
              <tbody className="divide-y divide-border">
                {(expenses || []).map((exp: any) => (
                  <tr key={exp.id} className="hover:bg-subtle/50"><td className="px-3 py-2.5 font-mono text-body-sm tabular-nums">{exp.expenseNumber}</td><td className="px-3 py-2.5 text-caption tabular-nums">{new Date(exp.expenseDate).toLocaleDateString('bn-BD')}</td><td className="px-3 py-2.5 text-body-sm truncate max-w-[160px]" title={(categories || []).find((c: any) => c.id === exp.categoryId)?.name}>{(categories || []).find((c: any) => c.id === exp.categoryId)?.name || exp.categoryId}</td><td className="px-3 py-2.5 text-right tabular-nums text-body-sm font-medium">{formatBDTEn(exp.amountPaisa)}</td><td className="px-3 py-2.5"><Badge variant="outline" className="text-[11px]">{exp.paymentMethod}</Badge></td><td className="px-3 py-2.5"><StatusBadge status={exp.status === 'voided' ? 'cancelled' : 'completed'} /></td><td className="px-3 py-2.5 text-right">{exp.status !== 'voided' && <button onClick={() => setVoiding(exp)} className="w-7 h-7 rounded-sm hover:bg-danger-50 text-text-tertiary hover:text-danger-600 flex items-center justify-center ml-auto"><Trash2 size={14} /></button>}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="খরচ যোগ করুন" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-label block mb-1.5">ক্যাটাগরি <span className="text-danger-500">*</span></label><select value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })} className="w-full h-9 px-2.5 rounded-sm border border-border bg-surface text-body-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"><option value="">ক্যাটাগরি নির্বাচন</option>{(categories || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <Input label="পরিমাণ (৳)" required type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div><label className="text-label block mb-1.5">পেমেন্ট পদ্ধতি <span className="text-danger-500">*</span></label><select value={form.paymentMethod} onChange={e => setForm({ ...form, paymentMethod: e.target.value })} className="w-full h-9 px-2.5 rounded-sm border border-border bg-surface text-body-sm"><option value="cash">নগদ</option><option value="bank">ব্যাংক</option><option value="card">কার্ড</option><option value="cheque">চেক</option><option value="bkash">বিকাশ</option><option value="nagad">নগদ</option><option value="rocket">রকেট</option><option value="upay">উপায়</option></select></div>
          {form.paymentMethod === 'cash' && (<div><label className="text-label block mb-1.5">নগদ হিসাব <span className="text-danger-500">*</span></label><select value={form.cashAccountId} onChange={e => setForm({ ...form, cashAccountId: e.target.value })} className="w-full h-9 px-2.5 rounded-sm border border-border bg-surface text-body-sm"><option value="">হিসাব নির্বাচন</option>{(cashQuery.data || []).map((a: any) => <option key={a.id} value={a.id}>{a.name} — {formatBDTEn(a.currentBalancePaisa)}</option>)}</select></div>)}
          {['bank', 'card', 'cheque'].includes(form.paymentMethod) && (<div><label className="text-label block mb-1.5">ব্যাংক হিসাব <span className="text-danger-500">*</span></label><select value={form.bankAccountId} onChange={e => setForm({ ...form, bankAccountId: e.target.value })} className="w-full h-9 px-2.5 rounded-sm border border-border bg-surface text-body-sm"><option value="">হিসাব নির্বাচন</option>{(bankQuery.data || []).map((a: any) => <option key={a.id} value={a.id}>{a.bankName} — {a.accountName}</option>)}</select></div>)}
          {['bkash', 'nagad', 'rocket', 'upay', 'mfs'].includes(form.paymentMethod) && (<div><label className="text-label block mb-1.5">MFS হিসাব <span className="text-danger-500">*</span></label><select value={form.mfsAccountId} onChange={e => setForm({ ...form, mfsAccountId: e.target.value })} className="w-full h-9 px-2.5 rounded-sm border border-border bg-surface text-body-sm"><option value="">হিসাব নির্বাচন</option>{(mfsQuery.data || []).map((a: any) => <option key={a.id} value={a.id}>{a.accountName} — {a.accountNumber}</option>)}</select></div>)}
          <div className="grid grid-cols-2 gap-3"><Input label="রেফারেন্স" value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} placeholder="INV-123" /><Input label="নোট" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="বিবরণ" /></div>
          <div className="flex justify-end gap-2 pt-3 border-t border-border"><Button variant="secondary" onClick={() => setShowCreate(false)}>বাতিল</Button><Button onClick={handleCreate} loading={createMut.isPending}>যোগ করুন</Button></div>
        </div>
      </Modal>

      <Modal open={!!voiding} onClose={() => { setVoiding(null); setVoidReason(''); }} title="খরচ বাতিল করুন" size="md">
        <div className="space-y-4">
          <p className="text-body-sm text-text-secondary">"{voiding?.expenseNumber}" খরচটি বাতিল করতে চান? এই কাজটি লেজারে বিপরীত এন্ট্রি তৈরি করবে, মূল রেকর্ড মুছবে না।</p>
          <Input label="বাতিলের কারণ" required value={voidReason} onChange={e => setVoidReason(e.target.value)} placeholder="কারণ লিখুন..." autoFocus />
          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button variant="secondary" onClick={() => { setVoiding(null); setVoidReason(''); }}>বাতিল</Button>
            <Button variant="danger" onClick={() => { if (!voidReason.trim()) return; voidMut.mutate({ id: voiding.id, reason: voidReason, businessId }); setVoiding(null); setVoidReason(''); }} disabled={!voidReason.trim()} loading={voidMut.isPending}>বাতিল করুন</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
