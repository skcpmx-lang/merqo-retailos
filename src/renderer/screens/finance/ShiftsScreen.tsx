
import React, { useState } from 'react';
import { useShifts, useOpenShift, useCloseShift, useCurrentShift } from '../../hooks/useFinance';
import { useCashAccounts } from '../../hooks/useFinance';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { EmptyState, TableLoadingState, TableErrorState } from '../../components/ui/States';
import { formatBDTEn } from '../../lib/format';
import { Plus, Clock, Play, Square } from 'lucide-react';

export const ShiftsScreen: React.FC<{ businessId: string }> = ({ businessId }) => {
  const { data: shifts, isLoading, error, refetch } = useShifts(businessId) as any;
  const { data: currentShift } = useCurrentShift(businessId);
  const { data: cashAccounts } = useCashAccounts(businessId);
  const openMut = useOpenShift();
  const closeMut = useCloseShift();
  const [showOpen, setShowOpen] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [openForm, setOpenForm] = useState({ cashAccountId: '', openingCash: '0', notes: '' });
  const [closeForm, setCloseForm] = useState({ closingCash: '0', notes: '' });
  const [errMsg, setErrMsg] = useState('');

  const handleOpen = async () => {
    try {
      if (!openForm.cashAccountId) { setErrMsg('নগদ হিসাব আবশ্যক'); return; }
      const openingPaisa = Math.round((parseFloat(openForm.openingCash) || 0) * 100);
      await openMut.mutateAsync({ businessId, cashAccountId: openForm.cashAccountId, openingCashPaisa: openingPaisa, notes: openForm.notes });
      setShowOpen(false);
      setOpenForm({ cashAccountId: '', openingCash: '0', notes: '' });
      setErrMsg('');
    } catch (e: any) { setErrMsg(e.message); }
  };

  const handleClose = async () => {
    try {
      if (!currentShift) return;
      const closingPaisa = Math.round((parseFloat(closeForm.closingCash) || 0) * 100);
      await closeMut.mutateAsync({ shiftId: (currentShift as any).id, actualCashPaisa: closingPaisa, notes: closeForm.notes });
      setShowClose(false);
      setCloseForm({ closingCash: '0', notes: '' });
      setErrMsg('');
    } catch (e: any) { setErrMsg(e.message); }
  };

  if (isLoading) return <TableLoadingState />;
  if (error) return <TableErrorState message={String(error)} onRetry={() => refetch?.()} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0"><h1 className="text-h3 font-semibold tracking-tight flex items-center gap-2"><Clock size={18} className="text-text-tertiary" /> শিফট</h1><p className="text-body-sm text-text-secondary mt-0.5">ক্যাশিয়ার শিফট ও মিলকরণ</p></div>
        <div className="flex gap-2 shrink-0">
          {!currentShift ? <Button onClick={() => setShowOpen(true)}><Play size={14} className="mr-1.5" /> শিফট খুলুন</Button> : <Button variant="secondary" onClick={() => setShowClose(true)}><Square size={14} className="mr-1.5" /> শিফট বন্ধ করুন</Button>}
        </div>
      </div>

      {errMsg && <div className="bg-danger-50 border border-danger-200 p-2.5 rounded-sm text-danger-700 text-body-sm">{errMsg}</div>}

      {currentShift && (
        <Card className="border-success-200 bg-success-50/30">
          <CardHeader className="pb-2 pt-3"><CardTitle className="text-body-sm flex items-center gap-2"><Badge variant="success">খোলা</Badge> বর্তমান শিফট — {(currentShift as any).shift_number || (currentShift as any).id.slice(0,8)}</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-4 text-body-sm">
            <span>ওপেনিং: <span className="tabular-nums font-medium">{formatBDTEn((currentShift as any).opening_cash_paisa || 0)}</span></span>
            <span>শুরু: <span className="tabular-nums">{new Date((currentShift as any).opened_at || (currentShift as any).openedAt).toLocaleString('bn-BD')}</span></span>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2 pt-3"><CardTitle className="text-body-sm">শিফট ইতিহাস</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-auto">
          {!shifts?.length ? <EmptyState icon={Clock} title="কোনো শিফট নেই" description="এই সময়সীমায় কোনো তথ্য পাওয়া যায়নি।" actionLabel="শিফট খুলুন" onAction={() => setShowOpen(true)} /> : (
            <table className="w-full">
              <thead className="bg-subtle border-y border-border sticky top-0"><tr><th className="text-left text-caption font-medium text-text-tertiary px-3 py-2">শিফট</th><th className="text-left text-caption font-medium text-text-tertiary px-3 py-2">শুরু</th><th className="text-left text-caption font-medium text-text-tertiary px-3 py-2">শেষ</th><th className="text-right text-caption font-medium text-text-tertiary px-3 py-2">ওপেনিং</th><th className="text-right text-caption font-medium text-text-tertiary px-3 py-2">ক্লোজিং</th><th className="text-left text-caption font-medium text-text-tertiary px-3 py-2">অবস্থা</th></tr></thead>
              <tbody className="divide-y divide-border">
                {(shifts || []).map((s: any) => (
                  <tr key={s.id} className="hover:bg-subtle/50"><td className="px-3 py-2.5 font-mono text-body-sm tabular-nums">{s.shift_number || s.id.slice(0,8)}</td><td className="px-3 py-2.5 text-caption tabular-nums">{new Date(s.opened_at || s.openedAt).toLocaleString('bn-BD')}</td><td className="px-3 py-2.5 text-caption tabular-nums">{s.closed_at || s.closedAt ? new Date(s.closed_at || s.closedAt).toLocaleString('bn-BD') : '-'}</td><td className="px-3 py-2.5 text-right tabular-nums text-body-sm">{formatBDTEn(s.opening_cash_paisa || s.openingCashPaisa || 0)}</td><td className="px-3 py-2.5 text-right tabular-nums text-body-sm">{s.closing_cash_paisa || s.closingCashPaisa ? formatBDTEn(s.closing_cash_paisa || s.closingCashPaisa) : '-'}</td><td className="px-3 py-2.5"><StatusBadge status={s.status === 'open' ? 'open' : 'closed'} /></td></tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Modal open={showOpen} onClose={() => setShowOpen(false)} title="শিফট খুলুন" size="md">
        <div className="space-y-4">
          <div><label className="text-label block mb-1.5">নগদ হিসাব <span className="text-danger-500">*</span></label><select value={openForm.cashAccountId} onChange={e => setOpenForm({ ...openForm, cashAccountId: e.target.value })} className="w-full h-9 px-2.5 rounded-sm border border-border bg-surface text-body-sm"><option value="">হিসাব নির্বাচন</option>{(cashAccounts || []).map((a: any) => <option key={a.id} value={a.id}>{a.name} — {formatBDTEn(a.currentBalancePaisa)}</option>)}</select></div>
          <Input label="ওপেনিং ক্যাশ (৳)" type="number" step="0.01" value={openForm.openingCash} onChange={e => setOpenForm({ ...openForm, openingCash: e.target.value })} />
          <Input label="নোট" value={openForm.notes} onChange={e => setOpenForm({ ...openForm, notes: e.target.value })} placeholder="বিবরণ" />
          <div className="flex justify-end gap-2 pt-3 border-t border-border"><Button variant="secondary" onClick={() => setShowOpen(false)}>বাতিল</Button><Button onClick={handleOpen} loading={openMut.isPending}>শিফট খুলুন</Button></div>
        </div>
      </Modal>

      <Modal open={showClose} onClose={() => setShowClose(false)} title="শিফট বন্ধ করুন" size="md">
        <div className="space-y-4">
          <div className="bg-subtle border border-border p-3 rounded-sm text-body-sm"><p>ওপেনিং: <span className="tabular-nums font-medium">{currentShift ? formatBDTEn((currentShift as any).opening_cash_paisa || (currentShift as any).openingCashPaisa || 0) : '-'}</span></p></div>
          <Input label="ক্লোজিং ক্যাশ (৳)" required type="number" step="0.01" value={closeForm.closingCash} onChange={e => setCloseForm({ ...closeForm, closingCash: e.target.value })} autoFocus />
          <Input label="নোট" value={closeForm.notes} onChange={e => setCloseForm({ ...closeForm, notes: e.target.value })} placeholder="মিলকরণ নোট" />
          <div className="flex justify-end gap-2 pt-3 border-t border-border"><Button variant="secondary" onClick={() => setShowClose(false)}>বাতিল</Button><Button onClick={handleClose} loading={closeMut.isPending}>শিফট বন্ধ করুন</Button></div>
        </div>
      </Modal>
    </div>
  );
};
