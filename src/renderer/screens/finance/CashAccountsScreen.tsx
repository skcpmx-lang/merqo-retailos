
import React, { useState } from 'react';
import { useCashAccounts, useCreateCashAccount, useCashStatement } from '../../hooks/useFinance';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { CardSkeleton, EmptyState, ErrorState, TableLoadingState } from '../../components/ui/States';
import { formatBDTEn } from '../../lib/format';
import { Plus, Wallet, Eye } from 'lucide-react';

export const CashAccountsScreen: React.FC<{ businessId: string }> = ({ businessId }) => {
  const { data: accounts, isLoading, error, refetch } = useCashAccounts(businessId) as any;
  const createMut = useCreateCashAccount();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', openingBalance: '0', isDefault: false });
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [errMsg, setErrMsg] = useState('');
  const { data: statement } = useCashStatement(selectedAccount);

  const handleCreate = async () => {
    try {
      if (!form.name.trim()) { setErrMsg('হিসাবের নাম আবশ্যক'); return; }
      const openingPaisa = Math.round((parseFloat(form.openingBalance) || 0) * 100);
      await createMut.mutateAsync({ businessId, name: form.name, openingBalancePaisa: openingPaisa, isDefault: form.isDefault });
      setShowCreate(false);
      setForm({ name: '', openingBalance: '0', isDefault: false });
      setErrMsg('');
    } catch (e: any) { setErrMsg(e.message); }
  };

  if (isLoading) return <div className="grid grid-cols-3 gap-3"><CardSkeleton lines={2} /><CardSkeleton lines={2} /><CardSkeleton lines={2} /></div>;
  if (error) return <ErrorState message={String(error)} onRetry={() => refetch?.()} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-h3 font-semibold tracking-tight flex items-center gap-2"><Wallet size={18} className="text-text-tertiary" /> নগদ হিসাব</h1>
          <p className="text-body-sm text-text-secondary mt-0.5">ক্যাশ অ্যাকাউন্ট ও লেনদেন — অপরিবর্তনীয় লেজার</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="shrink-0"><Plus size={14} className="mr-1.5" /> নতুন হিসাব</Button>
      </div>

      {errMsg && <div className="bg-danger-50 border border-danger-200 p-2.5 rounded-sm text-danger-700 text-body-sm">{errMsg}</div>}

      {(accounts || []).length === 0 ? (
        <EmptyState icon={Wallet} title="কোনো নগদ হিসাব নেই" description="প্রথম নগদ হিসাব তৈরি করে শুরু করুন।" actionLabel="নতুন হিসাব" onAction={() => setShowCreate(true)} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {(accounts || []).map((acc: any) => (
            <Card key={acc.id} className={`${selectedAccount === acc.id ? 'border-primary-200 bg-primary-50/50' : 'hover:shadow-sm'} cursor-pointer transition-all`}>
              <CardHeader className="pb-2 pt-3 flex flex-row justify-between items-start">
                <CardTitle className="text-body-sm truncate pr-2" title={acc.name}>{acc.name}</CardTitle>
                <div className="flex gap-1 shrink-0">{acc.isDefault && <Badge variant="primary">ডিফল্ট</Badge>}{!acc.isActive && <Badge variant="danger">নিষ্ক্রিয়</Badge>}</div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-h3 font-bold tabular-nums tracking-tight">{formatBDTEn(acc.currentBalancePaisa)}</p>
                <p className="text-caption text-text-tertiary tabular-nums">ওপেনিং: {formatBDTEn(acc.openingBalancePaisa)}</p>
                <Button variant="secondary" size="sm" onClick={() => setSelectedAccount(acc.id)} className="h-7"><Eye size={12} className="mr-1" /> লেনদেন</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedAccount && (
        <Card>
          <CardHeader className="pb-2 pt-3"><CardTitle className="text-body-sm">লেনদেন ইতিহাস</CardTitle></CardHeader>
          <CardContent className="p-0 overflow-auto max-h-[400px]">
            {!statement ? <TableLoadingState /> : statement.length === 0 ? <p className="text-body-sm text-text-tertiary py-8 text-center">এই সময়সীমায় কোনো তথ্য পাওয়া যায়নি।</p> : (
              <table className="w-full">
                <thead className="bg-subtle sticky top-0 border-y border-border">
                  <tr><th className="text-left text-caption font-medium text-text-tertiary px-3 py-2">তারিখ</th><th className="text-left text-caption font-medium text-text-tertiary px-3 py-2">ধরন</th><th className="text-right text-caption font-medium text-text-tertiary px-3 py-2">পরিমাণ</th><th className="text-right text-caption font-medium text-text-tertiary px-3 py-2">ব্যালেন্স</th><th className="text-left text-caption font-medium text-text-tertiary px-3 py-2">নোট</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(statement || []).map((row: any) => (
                    <tr key={row.movement.id} className="hover:bg-subtle/50">
                      <td className="px-3 py-2 text-caption tabular-nums">{new Date(row.movement.createdAt).toLocaleString('bn-BD')}</td>
                      <td className="px-3 py-2"><Badge variant="outline" className="text-[11px]">{row.movement.movementType}</Badge></td>
                      <td className={`px-3 py-2 text-right tabular-nums text-body-sm font-medium ${row.movement.amountPaisa > 0 ? 'text-success-600' : 'text-danger-600'}`}>{formatBDTEn(row.movement.amountPaisa)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-body-sm">{formatBDTEn(row.runningBalance)}</td>
                      <td className="px-3 py-2 text-caption truncate max-w-[160px]" title={row.movement.notes}>{row.movement.notes || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="নতুন নগদ হিসাব" size="md">
        <div className="space-y-4">
          <Input label="নাম" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Main Cash" autoFocus />
          <Input label="ওপেনিং ব্যালেন্স (৳)" type="number" step="0.01" value={form.openingBalance} onChange={e => setForm({ ...form, openingBalance: e.target.value })} />
          <label className="flex items-center gap-2 text-body-sm cursor-pointer"><input type="checkbox" checked={form.isDefault} onChange={e => setForm({ ...form, isDefault: e.target.checked })} className="w-4 h-4 rounded-sm border-border" /> ডিফল্ট হিসাব</label>
          <div className="flex justify-end gap-2 pt-3 border-t border-border"><Button variant="secondary" onClick={() => setShowCreate(false)}>বাতিল</Button><Button onClick={handleCreate} loading={createMut.isPending}>তৈরি করুন</Button></div>
        </div>
      </Modal>
    </div>
  );
};
