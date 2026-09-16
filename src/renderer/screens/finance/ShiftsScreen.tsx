import React, { useState } from 'react';
import { useShifts, useCurrentShift, useOpenShift, useCloseShift, useShiftReconciliation } from '../../hooks/useFinance';
import { useFinanceAccounts } from '../../hooks/useSales';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { formatPaisa } from '../../components/pos/POSCartTypes';
import { Clock, Plus, XCircle, CheckCircle } from 'lucide-react';

export const ShiftsScreen: React.FC<{ businessId: string }> = ({ businessId }) => {
  const { data: shifts } = useShifts(businessId);
  const { data: currentShift } = useCurrentShift(businessId);
  const { cashQuery } = useFinanceAccounts(businessId);
  const openMut = useOpenShift();
  const closeMut = useCloseShift();
  const [showOpen, setShowOpen] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [selectedShift, setSelectedShift] = useState<string>('');
  const [formOpen, setFormOpen] = useState({ cashAccountId: '', openingCash: '', notes: '' });
  const [formClose, setFormClose] = useState({ actualCash: '', notes: '' });
  const [error, setError] = useState('');
  const { data: reconciliation } = useShiftReconciliation(selectedShift);

  const handleOpen = async () => {
    try {
      const openingPaisa = Math.round((parseFloat(formOpen.openingCash) || 0) * 100);
      if (!formOpen.cashAccountId) { setError('নগদ হিসাব প্রয়োজন'); return; }
      await openMut.mutateAsync({ businessId, cashAccountId: formOpen.cashAccountId, openingCashPaisa: openingPaisa, openedByUserId: 'system', notes: formOpen.notes });
      setShowOpen(false);
      setFormOpen({ cashAccountId: '', openingCash: '', notes: '' });
      setError('');
    } catch (e: any) { setError(e.message); }
  };

  const handleClose = async () => {
    try {
      if (!selectedShift) { setError('শিফট নির্বাচন করুন'); return; }
      const actualPaisa = Math.round((parseFloat(formClose.actualCash) || 0) * 100);
      await closeMut.mutateAsync({ shiftId: selectedShift, actualCashPaisa: actualPaisa, notes: formClose.notes });
      setShowClose(false);
      setFormClose({ actualCash: '', notes: '' });
      setError('');
    } catch (e: any) { setError(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-h2 font-bold flex items-center gap-2"><Clock size={20} /> শিফট / ক্যাশ ড্রয়ার</h1>
        <div className="flex gap-2">
          {currentShift ? (
            <Button variant="secondary" onClick={() => { setSelectedShift(currentShift.id); setShowClose(true); }}><XCircle size={16} className="mr-1" /> শিফট বন্ধ করুন</Button>
          ) : (
            <Button onClick={() => setShowOpen(true)}><Plus size={16} className="mr-1" /> শিফট শুরু করুন</Button>
          )}
        </div>
      </div>

      {error && <div className="bg-danger-50 border border-danger-200 p-3 rounded text-danger-600 text-body-sm">{error}</div>}

      {currentShift && (
        <Card className="border-success-200 bg-success-50">
          <CardHeader><CardTitle className="text-body-sm flex items-center gap-2"><CheckCircle size={16} className="text-success-600" /> বর্তমান শিফট — {currentShift.shiftNumber}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-3 gap-3 text-body-sm">
            <div><span className="text-caption">ওপেনিং</span><p className="font-mono font-bold">{formatPaisa(currentShift.openingCashPaisa)}</p></div>
            <div><span className="text-caption">শুরু</span><p>{new Date(currentShift.openedAt).toLocaleString('bn-BD')}</p></div>
            <div><span className="text-caption">হিসাব</span><p>{currentShift.cashAccountId.slice(0,8)}</p></div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-body-sm">শিফট তালিকা</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-auto">
          <table className="w-full">
            <thead className="bg-subtle border-y sticky top-0">
              <tr><th className="text-left text-caption px-3 py-2">নম্বর</th><th className="text-left text-caption px-3 py-2">শুরু</th><th className="text-left text-caption px-3 py-2">শেষ</th><th className="text-right text-caption px-3 py-2">ওপেনিং</th><th className="text-right text-caption px-3 py-2">প্রত্যাশিত</th><th className="text-right text-caption px-3 py-2">গণনা</th><th className="text-right text-caption px-3 py-2">ঘাটতি/অতিরিক্ত</th><th className="text-left text-caption px-3 py-2">স্ট্যাটাস</th><th className="text-right text-caption px-3 py-2"></th></tr>
            </thead>
            <tbody>
              {(shifts || []).map((s: any) => (
                <tr key={s.id} className={`border-b hover:bg-subtle/50 ${selectedShift === s.id ? 'bg-primary-50' : ''}`} onClick={() => setSelectedShift(s.id)}>
                  <td className="px-3 py-2 font-mono text-body-sm">{s.shiftNumber}</td>
                  <td className="px-3 py-2 text-caption">{new Date(s.openedAt).toLocaleString('bn-BD')}</td>
                  <td className="px-3 py-2 text-caption">{s.closedAt ? new Date(s.closedAt).toLocaleString('bn-BD') : '-'}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatPaisa(s.openingCashPaisa)}</td>
                  <td className="px-3 py-2 text-right font-mono">{s.expectedCashPaisa ? formatPaisa(s.expectedCashPaisa) : '-'}</td>
                  <td className="px-3 py-2 text-right font-mono">{s.actualCashPaisa ? formatPaisa(s.actualCashPaisa) : '-'}</td>
                  <td className={`px-3 py-2 text-right font-mono ${s.variancePaisa && s.variancePaisa < 0 ? 'text-danger-600' : s.variancePaisa && s.variancePaisa > 0 ? 'text-success-600' : ''}`}>{s.variancePaisa ? formatPaisa(s.variancePaisa) : '-'}</td>
                  <td className="px-3 py-2"><Badge variant={s.status === 'open' ? 'success' : 'default'}>{s.status === 'open' ? 'খোলা' : 'বন্ধ'}</Badge></td>
                  <td className="px-3 py-2 text-right"><Button variant="ghost" size="sm" onClick={() => setSelectedShift(s.id)}>বিস্তারিত</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {selectedShift && reconciliation && (
        <Card>
          <CardHeader><CardTitle className="text-body-sm">রিকনসিলিয়েশন — {reconciliation.shiftNumber}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-body-sm">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-subtle p-3 rounded"><p className="text-caption">ওপেনিং</p><p className="font-mono font-bold">{formatPaisa(reconciliation.openingCashPaisa)}</p></div>
              <div className="bg-subtle p-3 rounded"><p className="text-caption">প্রত্যাশিত নগদ</p><p className="font-mono font-bold">{formatPaisa(reconciliation.expectedCashPaisa)}</p></div>
              <div className="bg-subtle p-3 rounded"><p className="text-caption">গণনা করা নগদ</p><p className="font-mono font-bold">{reconciliation.actualCashPaisa ? formatPaisa(reconciliation.actualCashPaisa) : '—'}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><p className="text-caption font-medium">ব্রেকডাউন</p>
                <div className="flex justify-between"><span>বিক্রয় নগদ</span><span className="font-mono">{formatPaisa(reconciliation.breakdown.salesCash)}</span></div>
                <div className="flex justify-between"><span>গ্রাহক আদায়</span><span className="font-mono">{formatPaisa(reconciliation.breakdown.collections)}</span></div>
                <div className="flex justify-between"><span>সাপ্লায়ার পেমেন্ট</span><span className="font-mono text-danger-600">-{formatPaisa(reconciliation.breakdown.supplierPayments)}</span></div>
                <div className="flex justify-between"><span>খরচ</span><span className="font-mono text-danger-600">-{formatPaisa(reconciliation.breakdown.expenses)}</span></div>
                <div className="flex justify-between"><span>ফেরত/রিফান্ড</span><span className="font-mono text-danger-600">-{formatPaisa(reconciliation.breakdown.refunds)}</span></div>
                <div className="flex justify-between"><span>ট্রান্সফার ইন</span><span className="font-mono text-success-600">{formatPaisa(reconciliation.breakdown.transfersIn)}</span></div>
                <div className="flex justify-between"><span>ট্রান্সফার আউট</span><span className="font-mono text-danger-600">-{formatPaisa(reconciliation.breakdown.transfersOut)}</span></div>
              </div>
              <div className="space-y-1">
                <p className="text-caption font-medium">সারাংশ</p>
                <div className="flex justify-between"><span>ইনফ্লো</span><span className="font-mono text-success-600">{formatPaisa(reconciliation.inflows)}</span></div>
                <div className="flex justify-between"><span>আউটফ্লো</span><span className="font-mono text-danger-600">{formatPaisa(reconciliation.outflows)}</span></div>
                <div className="flex justify-between font-bold border-t pt-1"><span>প্রত্যাশিত</span><span className="font-mono">{formatPaisa(reconciliation.expectedCashPaisa)}</span></div>
                {reconciliation.variancePaisa !== null && (
                  <div className={`flex justify-between p-2 rounded ${reconciliation.variancePaisa < 0 ? 'bg-danger-50 text-danger-600' : reconciliation.variancePaisa > 0 ? 'bg-success-50 text-success-600' : 'bg-subtle'}`}>
                    <span>{reconciliation.variancePaisa < 0 ? 'ঘাটতি' : reconciliation.variancePaisa > 0 ? 'অতিরিক্ত' : 'মিলেছে'}</span><span className="font-mono font-bold">{formatPaisa(reconciliation.variancePaisa)}</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Modal open={showOpen} onClose={() => setShowOpen(false)} title="শিফট শুরু করুন" size="md">
        <div className="space-y-3">
          <div><label className="text-label block mb-1">নগদ হিসাব *</label>
            <select value={formOpen.cashAccountId} onChange={e => setFormOpen({ ...formOpen, cashAccountId: e.target.value })} className="w-full h-9 px-3 rounded-sm border border-border bg-surface text-body-sm">
              <option value="">হিসাব নির্বাচন করুন</option>
              {(cashQuery.data || []).map((a: any) => <option key={a.id} value={a.id}>{a.name} — {formatPaisa(a.currentBalancePaisa)}</option>)}
            </select>
          </div>
          <div><label className="text-label block mb-1">ওপেনিং ক্যাশ (৳) *</label><Input type="number" step="0.01" value={formOpen.openingCash} onChange={e => setFormOpen({ ...formOpen, openingCash: e.target.value })} /></div>
          <div><label className="text-label block mb-1">নোট</label><Input value={formOpen.notes} onChange={e => setFormOpen({ ...formOpen, notes: e.target.value })} placeholder="শিফট শুরুর নোট" /></div>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setShowOpen(false)}>বাতিল</Button><Button onClick={handleOpen} loading={openMut.isPending}>শুরু করুন</Button></div>
        </div>
      </Modal>

      <Modal open={showClose} onClose={() => setShowClose(false)} title="শিফট বন্ধ করুন" size="md">
        <div className="space-y-3">
          {reconciliation && (
            <div className="bg-subtle p-3 rounded space-y-1 text-body-sm">
              <div className="flex justify-between"><span>প্রত্যাশিত নগদ</span><span className="font-mono font-bold">{formatPaisa(reconciliation.expectedCashPaisa)}</span></div>
            </div>
          )}
          <div><label className="text-label block mb-1">গণনা করা নগদ (৳) *</label><Input type="number" step="0.01" value={formClose.actualCash} onChange={e => setFormClose({ ...formClose, actualCash: e.target.value })} autoFocus /></div>
          <div><label className="text-label block mb-1">নোট (ঘাটতি/অতিরিক্তের কারণ)</label><Input value={formClose.notes} onChange={e => setFormClose({ ...formClose, notes: e.target.value })} placeholder="কারণ লিখুন" /></div>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setShowClose(false)}>বাতিল</Button><Button onClick={handleClose} loading={closeMut.isPending}>বন্ধ করুন</Button></div>
        </div>
      </Modal>
    </div>
  );
};
