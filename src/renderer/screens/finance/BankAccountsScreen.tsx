import React, { useState } from 'react';
import { useBankAccounts, useCreateBankAccount, useBankStatement } from '../../hooks/useFinance';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { formatPaisa } from '../../components/pos/POSCartTypes';
import { Badge } from '../../components/ui/Badge';
import { Plus, Building2, Eye } from 'lucide-react';

export const BankAccountsScreen: React.FC<{ businessId: string }> = ({ businessId }) => {
  const { data: accounts, isLoading } = useBankAccounts(businessId);
  const createMut = useCreateBankAccount();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ bankName: '', accountName: '', accountNumber: '', branch: '', openingBalance: '0' });
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [error, setError] = useState('');
  const { data: statement } = useBankStatement(selectedAccount);

  const handleCreate = async () => {
    try {
      if (!form.bankName.trim()) { setError('ব্যাংকের নাম প্রয়োজন'); return; }
      const openingPaisa = Math.round((parseFloat(form.openingBalance) || 0) * 100);
      await createMut.mutateAsync({ businessId, bankName: form.bankName, accountName: form.accountName, accountNumber: form.accountNumber, branch: form.branch, openingBalancePaisa: openingPaisa });
      setShowCreate(false);
      setForm({ bankName: '', accountName: '', accountNumber: '', branch: '', openingBalance: '0' });
      setError('');
    } catch (e: any) { setError(e.message); }
  };

  if (isLoading) return <div className="p-6">লোড হচ্ছে...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-h2 font-bold flex items-center gap-2"><Building2 size={20} /> ব্যাংক হিসাব</h1>
        <Button onClick={() => setShowCreate(true)}><Plus size={16} className="mr-1" /> নতুন ব্যাংক হিসাব</Button>
      </div>
      {error && <div className="bg-danger-50 border border-danger-200 p-3 rounded text-danger-600 text-body-sm">{error}</div>}
      <div className="grid grid-cols-3 gap-3">
        {(accounts || []).map((acc: any) => (
          <Card key={acc.id} className={selectedAccount === acc.id ? 'border-primary-300 bg-primary-50' : ''}>
            <CardHeader className="pb-2"><CardTitle className="text-body-sm">{acc.bankName} {acc.accountName ? `— ${acc.accountName}` : ''}</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              <p className="text-h3 font-mono">{formatPaisa(acc.currentBalancePaisa)}</p>
              <p className="text-caption font-mono text-text-tertiary">A/C: {acc.accountNumber ? `****${acc.accountNumber.slice(-4)}` : 'N/A'} {acc.branch ? `(${acc.branch})` : ''}</p>
              <Button variant="secondary" size="sm" onClick={() => setSelectedAccount(acc.id)}><Eye size={14} className="mr-1" /> লেনদেন</Button>
            </CardContent>
          </Card>
        ))}
      </div>
      {selectedAccount && (
        <Card>
          <CardHeader><CardTitle className="text-body-sm">লেনদেন ইতিহাস</CardTitle></CardHeader>
          <CardContent className="p-0 overflow-auto max-h-[400px]">
            <table className="w-full">
              <thead className="bg-subtle sticky top-0 border-y">
                <tr><th className="text-left text-caption px-3 py-2">তারিখ</th><th className="text-left text-caption px-3 py-2">ধরন</th><th className="text-right text-caption px-3 py-2">পরিমাণ</th><th className="text-right text-caption px-3 py-2">ব্যালেন্স</th><th className="text-left text-caption px-3 py-2">নোট</th></tr>
              </thead>
              <tbody>
                {(statement || []).map((row: any) => (
                  <tr key={row.transaction.id} className="border-b hover:bg-subtle/50">
                    <td className="px-3 py-2 text-caption">{new Date(row.transaction.createdAt).toLocaleString('bn-BD')}</td>
                    <td className="px-3 py-2 text-caption"><Badge>{row.transaction.transactionType}</Badge></td>
                    <td className={`px-3 py-2 text-right font-mono ${row.transaction.amountPaisa > 0 ? 'text-success-600' : 'text-danger-600'}`}>{formatPaisa(row.transaction.amountPaisa)}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatPaisa(row.runningBalance)}</td>
                    <td className="px-3 py-2 text-caption">{row.transaction.notes || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="নতুন ব্যাংক হিসাব" size="md">
        <div className="space-y-3">
          <div><label className="text-label block mb-1">ব্যাংকের নাম *</label><Input value={form.bankName} onChange={e => setForm({ ...form, bankName: e.target.value })} placeholder="DBBL" /></div>
          <div><label className="text-label block mb-1">হিসাবের নাম</label><Input value={form.accountName} onChange={e => setForm({ ...form, accountName: e.target.value })} placeholder="Main Account" /></div>
          <div><label className="text-label block mb-1">হিসাব নম্বর</label><Input value={form.accountNumber} onChange={e => setForm({ ...form, accountNumber: e.target.value })} placeholder="****" /></div>
          <div><label className="text-label block mb-1">শাখা</label><Input value={form.branch} onChange={e => setForm({ ...form, branch: e.target.value })} /></div>
          <div><label className="text-label block mb-1">ওপেনিং ব্যালেন্স (৳)</label><Input type="number" step="0.01" value={form.openingBalance} onChange={e => setForm({ ...form, openingBalance: e.target.value })} /></div>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setShowCreate(false)}>বাতিল</Button><Button onClick={handleCreate} loading={createMut.isPending}>তৈরি করুন</Button></div>
        </div>
      </Modal>
    </div>
  );
};
