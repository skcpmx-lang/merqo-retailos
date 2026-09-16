import React, { useState } from 'react';
import { useExpenses, useExpenseCategories, useCreateExpense, useVoidExpense } from '../../hooks/useFinance';
import { useFinanceAccounts } from '../../hooks/useSales';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { formatPaisa } from '../../components/pos/POSCartTypes';
import { Plus, Receipt, Trash2 } from 'lucide-react';

export const ExpensesScreen: React.FC<{ businessId: string }> = ({ businessId }) => {
  const { data: expenses, isLoading } = useExpenses(businessId, 100, 0);
  const { data: categories } = useExpenseCategories(businessId);
  const { cashQuery, bankQuery, mfsQuery } = useFinanceAccounts(businessId);
  const createMut = useCreateExpense();
  const voidMut = useVoidExpense();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ categoryId: '', amount: '', paymentMethod: 'cash', cashAccountId: '', bankAccountId: '', mfsAccountId: '', reference: '', notes: '' });
  const [error, setError] = useState('');

  const handleCreate = async () => {
    try {
      if (!form.categoryId) { setError('ক্যাটাগরি প্রয়োজন'); return; }
      const amountPaisa = Math.round((parseFloat(form.amount) || 0) * 100);
      if (amountPaisa <= 0) { setError('পরিমাণ ০ এর বেশি হতে হবে'); return; }
      await createMut.mutateAsync({
        businessId,
        categoryId: form.categoryId,
        amountPaisa,
        paymentMethod: form.paymentMethod,
        cashAccountId: form.cashAccountId || undefined,
        bankAccountId: form.bankAccountId || undefined,
        mfsAccountId: form.mfsAccountId || undefined,
        reference: form.reference,
        notes: form.notes,
      });
      setShowCreate(false);
      setForm({ categoryId: '', amount: '', paymentMethod: 'cash', cashAccountId: '', bankAccountId: '', mfsAccountId: '', reference: '', notes: '' });
      setError('');
    } catch (e: any) { setError(e.message); }
  };

  if (isLoading) return <div className="p-6">লোড হচ্ছে...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-h2 font-bold flex items-center gap-2"><Receipt size={20} /> খরচ ব্যবস্থাপনা</h1>
        <Button onClick={() => setShowCreate(true)}><Plus size={16} className="mr-1" /> খরচ যোগ করুন</Button>
      </div>
      {error && <div className="bg-danger-50 border border-danger-200 p-3 rounded text-danger-600 text-body-sm">{error}</div>}

      <Card>
        <CardHeader><CardTitle className="text-body-sm">খরচ তালিকা</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-auto">
          <table className="w-full">
            <thead className="bg-subtle border-y sticky top-0">
              <tr><th className="text-left text-caption px-3 py-2">নম্বর</th><th className="text-left text-caption px-3 py-2">তারিখ</th><th className="text-left text-caption px-3 py-2">ক্যাটাগরি</th><th className="text-right text-caption px-3 py-2">পরিমাণ</th><th className="text-left text-caption px-3 py-2">পদ্ধতি</th><th className="text-left text-caption px-3 py-2">স্ট্যাটাস</th><th className="text-right text-caption px-3 py-2">অ্যাকশন</th></tr>
            </thead>
            <tbody>
              {(expenses || []).map((exp: any) => (
                <tr key={exp.id} className="border-b hover:bg-subtle/50">
                  <td className="px-3 py-2 font-mono text-body-sm">{exp.expenseNumber}</td>
                  <td className="px-3 py-2 text-caption">{new Date(exp.expenseDate).toLocaleDateString('bn-BD')}</td>
                  <td className="px-3 py-2 text-body-sm">{(categories || []).find((c: any) => c.id === exp.categoryId)?.name || exp.categoryId}</td>
                  <td className="px-3 py-2 text-right font-mono text-body-sm">{formatPaisa(exp.amountPaisa)}</td>
                  <td className="px-3 py-2 text-caption"><Badge>{exp.paymentMethod}</Badge></td>
                  <td className="px-3 py-2 text-caption"><Badge variant={exp.status === 'voided' ? 'danger' : 'default'}>{exp.status === 'voided' ? 'বাতিল' : 'সম্পন্ন'}</Badge></td>
                  <td className="px-3 py-2 text-right">
                    {exp.status !== 'voided' && <Button variant="ghost" size="sm" onClick={() => { const reason = prompt('বাতিলের কারণ লিখুন'); if (reason) voidMut.mutate({ id: exp.id, reason, businessId }); }}><Trash2 size={14} /></Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="খরচ যোগ করুন" size="lg">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-label block mb-1">ক্যাটাগরি *</label>
              <select value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })} className="w-full h-9 px-3 rounded-sm border border-border bg-surface text-body-sm">
                <option value="">ক্যাটাগরি নির্বাচন করুন</option>
                {(categories || []).map((c: any) => <option key={c.id} value={c.id}>{c.name} — {c.nameBn}</option>)}
              </select>
            </div>
            <div><label className="text-label block mb-1">পরিমাণ (৳) *</label><Input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
          </div>
          <div><label className="text-label block mb-1">পেমেন্ট পদ্ধতি *</label>
            <select value={form.paymentMethod} onChange={e => setForm({ ...form, paymentMethod: e.target.value })} className="w-full h-9 px-3 rounded-sm border border-border bg-surface text-body-sm">
              <option value="cash">নগদ</option>
              <option value="bank">ব্যাংক</option>
              <option value="card">কার্ড</option>
              <option value="cheque">চেক</option>
              <option value="bkash">বিকাশ</option>
              <option value="nagad">নগদ</option>
              <option value="rocket">রকেট</option>
              <option value="upay">উপায়</option>
            </select>
          </div>
          {form.paymentMethod === 'cash' && (
            <div><label className="text-label block mb-1">নগদ হিসাব *</label>
              <select value={form.cashAccountId} onChange={e => setForm({ ...form, cashAccountId: e.target.value })} className="w-full h-9 px-3 rounded-sm border border-border bg-surface text-body-sm">
                <option value="">হিসাব নির্বাচন করুন</option>
                {(cashQuery.data || []).map((a: any) => <option key={a.id} value={a.id}>{a.name} — {formatPaisa(a.currentBalancePaisa)}</option>)}
              </select>
            </div>
          )}
          {['bank', 'card', 'cheque'].includes(form.paymentMethod) && (
            <div><label className="text-label block mb-1">ব্যাংক হিসাব *</label>
              <select value={form.bankAccountId} onChange={e => setForm({ ...form, bankAccountId: e.target.value })} className="w-full h-9 px-3 rounded-sm border border-border bg-surface text-body-sm">
                <option value="">হিসাব নির্বাচন করুন</option>
                {(bankQuery.data || []).map((a: any) => <option key={a.id} value={a.id}>{a.bankName} — {a.accountName}</option>)}
              </select>
            </div>
          )}
          {['bkash', 'nagad', 'rocket', 'upay', 'mfs'].includes(form.paymentMethod) && (
            <div><label className="text-label block mb-1">MFS হিসাব *</label>
              <select value={form.mfsAccountId} onChange={e => setForm({ ...form, mfsAccountId: e.target.value })} className="w-full h-9 px-3 rounded-sm border border-border bg-surface text-body-sm">
                <option value="">হিসাব নির্বাচন করুন</option>
                {(mfsQuery.data || []).map((a: any) => <option key={a.id} value={a.id}>{a.accountName} — {a.accountNumber}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-label block mb-1">রেফারেন্স</label><Input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} placeholder="INV-123" /></div>
            <div><label className="text-label block mb-1">নোট</label><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="বিবরণ" /></div>
          </div>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setShowCreate(false)}>বাতিল</Button><Button onClick={handleCreate} loading={createMut.isPending}>যোগ করুন</Button></div>
        </div>
      </Modal>
    </div>
  );
};
