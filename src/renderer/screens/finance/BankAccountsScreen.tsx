
import React, { useState } from 'react';
import { useBankAccounts, useCreateBankAccount, useBankStatement } from '../../hooks/useFinance';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { CardSkeleton, EmptyState, ErrorState, TableLoadingState } from '../../components/ui/States';
import { formatBDTEn } from '../../lib/format';
import { Plus, Building2, Eye } from 'lucide-react';

export const BankAccountsScreen: React.FC<{ businessId: string }> = ({ businessId }) => {
  const { data: accounts, isLoading, error, refetch } = useBankAccounts(businessId) as any;
  const createMut = useCreateBankAccount();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', bankName: '', accountNumber: '', openingBalance: '0' });
  const [selected, setSelected] = useState<string>('');
  const [errMsg, setErrMsg] = useState('');
  const { data: statement } = useBankStatement(selected);

  const handleCreate = async () => {
    try {
      if (!form.name.trim()) { setErrMsg('হিসাবের নাম আবশ্যক'); return; }
      const openingPaisa = Math.round((parseFloat(form.openingBalance) || 0) * 100);
      await createMut.mutateAsync({ businessId, name: form.name, bankName: form.bankName || undefined, accountNumber: form.accountNumber || undefined, openingBalancePaisa: openingPaisa });
      setShowCreate(false);
      setForm({ name: '', bankName: '', accountNumber: '', openingBalance: '0' });
      setErrMsg('');
    } catch (e: any) { setErrMsg(e.message); }
  };

  if (isLoading) return <div className="grid grid-cols-3 gap-3"><CardSkeleton lines={2} /><CardSkeleton lines={2} /></div>;
  if (error) return <ErrorState message={String(error)} onRetry={() => refetch?.()} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-h3 font-semibold tracking-tight flex items-center gap-2"><Building2 size={18} className="text-text-tertiary" /> ব্যাংক হিসাব</h1>
          <p className="text-body-sm text-text-secondary mt-0.5">ব্যাংক অ্যাকাউন্ট ও লেনদেন</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="shrink-0"><Plus size={14} className="mr-1.5" /> নতুন হিসাব</Button>
      </div>
      {errMsg && <div className="bg-danger-50 border border-danger-200 p-2.5 rounded-sm text-danger-700 text-body-sm">{errMsg}</div>}
      {(accounts || []).length === 0 ? <EmptyState icon={Building2} title="কোনো ব্যাংক হিসাব নেই" description="প্রথম ব্যাংক হিসাব তৈরি করুন।" actionLabel="নতুন হিসাব" onAction={() => setShowCreate(true)} /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {(accounts || []).map((acc: any) => (
            <Card key={acc.id} className={`${selected === acc.id ? 'border-primary-200 bg-primary-50/50' : 'hover:shadow-sm'} cursor-pointer transition-all`}>
              <CardHeader className="pb-2 pt-3 flex flex-row justify-between"><CardTitle className="text-body-sm truncate" title={acc.name}>{acc.name}</CardTitle>{!acc.isActive && <Badge variant="danger">নিষ্ক্রিয়</Badge>}</CardHeader>
              <CardContent className="space-y-2">
                <p className="text-h3 font-bold tabular-nums">{formatBDTEn(acc.currentBalancePaisa)}</p>
                <p className="text-caption text-text-tertiary">{acc.bankName || ''} {acc.accountNumber ? `• ${acc.accountNumber}` : ''}</p>
                <Button variant="secondary" size="sm" onClick={() => setSelected(acc.id)} className="h-7"><Eye size={12} className="mr-1" /> লেনদেন</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {selected && (
        <Card><CardHeader className="pb-2 pt-3"><CardTitle className="text-body-sm">লেনদেন ইতিহাস</CardTitle></CardHeader><CardContent className="p-0 overflow-auto max-h-[400px]">
          {!statement ? <TableLoadingState /> : statement.length === 0 ? <p className="text-body-sm text-text-tertiary py-8 text-center">এই সময়সীমায় কোনো তথ্য পাওয়া যায়নি।</p> : (
            <table className="w-full"><thead className="bg-subtle sticky top-0 border-y border-border"><tr><th className="text-left text-caption px-3 py-2">তারিখ</th><th className="text-left text-caption px-3 py-2">ধরন</th><th className="text-right text-caption px-3 py-2">পরিমাণ</th><th className="text-right text-caption px-3 py-2">ব্যালেন্স</th></tr></thead><tbody className="divide-y divide-border">{(statement || []).map((row: any) => (<tr key={row.movement.id} className="hover:bg-subtle/50"><td className="px-3 py-2 text-caption tabular-nums">{new Date(row.movement.createdAt).toLocaleString('bn-BD')}</td><td className="px-3 py-2"><Badge variant="outline" className="text-[11px]">{row.movement.movementType}</Badge></td><td className={`px-3 py-2 text-right tabular-nums text-body-sm font-medium ${row.movement.amountPaisa > 0 ? 'text-success-600' : 'text-danger-600'}`}>{formatBDTEn(row.movement.amountPaisa)}</td><td className="px-3 py-2 text-right tabular-nums text-body-sm">{formatBDTEn(row.runningBalance)}</td></tr>))}</tbody></table>
          )}
        </CardContent></Card>
      )}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="নতুন ব্যাংক হিসাব" size="md">
        <div className="space-y-4">
          <Input label="নাম" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="DBBL Current" autoFocus />
          <div className="grid grid-cols-2 gap-3"><Input label="ব্যাংকের নাম" value={form.bankName} onChange={e => setForm({ ...form, bankName: e.target.value })} placeholder="ডাচ বাংলা" /><Input label="অ্যাকাউন্ট নম্বর" value={form.accountNumber} onChange={e => setForm({ ...form, accountNumber: e.target.value })} placeholder="123..." /></div>
          <Input label="ওপেনিং ব্যালেন্স (৳)" type="number" step="0.01" value={form.openingBalance} onChange={e => setForm({ ...form, openingBalance: e.target.value })} />
          <div className="flex justify-end gap-2 pt-3 border-t border-border"><Button variant="secondary" onClick={() => setShowCreate(false)}>বাতিল</Button><Button onClick={handleCreate} loading={createMut.isPending}>তৈরি করুন</Button></div>
        </div>
      </Modal>
    </div>
  );
};
