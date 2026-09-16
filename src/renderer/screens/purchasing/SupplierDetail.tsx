import React, { useState } from 'react';
import { useSupplier, useSupplierStatement, useSupplierPay } from '../../hooks/useSuppliers';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { ArrowLeft, CreditCard, Banknote, Smartphone, FileText } from 'lucide-react';

function formatPaisa(paisa: number): string {
  const bdt = paisa / 100;
  return `৳ ${bdt.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('bn-BD', { dateStyle: 'medium', timeStyle: 'short' });
}

const TX_TYPE_LABELS: Record<string, { bn: string; en: string }> = {
  opening_payable: { bn: 'প্রারম্ভিক বকেয়া', en: 'Opening' },
  purchase: { bn: 'ক্রয়', en: 'Purchase' },
  payment: { bn: 'পরিশোধ', en: 'Payment' },
  return: { bn: 'ফেরত', en: 'Return' },
  adjustment: { bn: 'সমন্বয়', en: 'Adjustment' },
  supplier_payment: { bn: 'পরিশোধ', en: 'Payment' },
  purchase_payment: { bn: 'ক্রয় পরিশোধ', en: 'Purchase Payment' },
  purchase_return: { bn: 'ক্রয় ফেরত', en: 'Purchase Return' },
};

export const SupplierDetail: React.FC<{ supplierId: string; businessId: string; onBack: () => void }> = ({ supplierId, businessId, onBack }) => {
  const { data: supplier, isLoading } = useSupplier(supplierId);
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [showPay, setShowPay] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payNote, setPayNote] = useState('');

  const fromTs = fromDate ? new Date(fromDate).getTime() : undefined;
  const toTs = toDate ? new Date(toDate).getTime() + 86400000 - 1 : undefined;

  const { data: statement, isLoading: stmtLoading } = useSupplierStatement(supplierId, fromTs, toTs);
  const payMut = useSupplierPay();

  const handlePay = async () => {
    const amount = Math.round(parseFloat(payAmount) * 100);
    if (!amount || amount <= 0) {
      alert('সঠিক পরিমাণ লিখুন');
      return;
    }
    try {
      await payMut.mutateAsync({
        businessId,
        supplierId,
        amountPaisa: amount,
        method: payMethod,
        notes: payNote,
      });
      setShowPay(false);
      setPayAmount('');
      setPayNote('');
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="text-center py-12">
        <p className="text-body text-text-secondary">সাপ্লায়ার পাওয়া যায়নি</p>
        <Button variant="secondary" className="mt-4" onClick={onBack}>ফিরে যান</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft size={18} /></Button>
        <div>
          <h1 className="text-h1 text-text-primary">{supplier.name}</h1>
          <p className="text-body-sm text-text-secondary">{supplier.companyName || supplier.phone || ''}</p>
        </div>
        <div className="ml-auto flex gap-2">
          <Badge variant={supplier.isActive ? 'success' : 'default'}>{supplier.isActive ? 'সক্রিয়' : 'নিষ্ক্রিয়'}</Badge>
          <Button size="sm" onClick={() => setShowPay(true)}><Banknote size={16} className="mr-1" /> পরিশোধ</Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-body-sm">বর্তমান বকেয়া</CardTitle></CardHeader>
          <CardContent><p className="text-h2 font-mono text-danger-600">{formatPaisa(statement?.currentPayable || supplier.currentPayablePaisa || 0)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-body-sm">প্রারম্ভিক বকেয়া</CardTitle></CardHeader>
          <CardContent><p className="text-h3 font-mono">{formatPaisa(supplier.openingPayablePaisa || 0)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-body-sm">যোগাযোগ</CardTitle></CardHeader>
          <CardContent className="text-body-sm space-y-1">
            {supplier.phone && <p>📞 {supplier.phone}</p>}
            {supplier.alternatePhone && <p>📞 {supplier.alternatePhone} (বিকল্প)</p>}
            {supplier.email && <p>✉️ {supplier.email}</p>}
            {supplier.address && <p>📍 {supplier.address}</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>লেনদেন বিবরণী</CardTitle>
            <div className="flex items-center gap-2">
              <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-36" />
              <span className="text-caption">থেকে</span>
              <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-36" />
              <span className="text-caption">পর্যন্ত</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto max-h-[60vh]">
            <table className="w-full">
              <thead className="bg-subtle border-y border-border sticky top-0">
                <tr>
                  <th className="text-left text-caption font-medium text-text-tertiary px-4 py-2">তারিখ</th>
                  <th className="text-left text-caption font-medium text-text-tertiary px-4 py-2">ধরন</th>
                  <th className="text-left text-caption font-medium text-text-tertiary px-4 py-2">রেফারেন্স</th>
                  <th className="text-right text-caption font-medium text-text-tertiary px-4 py-2">পরিমাণ</th>
                  <th className="text-right text-caption font-medium text-text-tertiary px-4 py-2">চলমান বকেয়া</th>
                </tr>
              </thead>
              <tbody>
                {statement?.openingBalance !== undefined && statement.openingBalance !== 0 && (
                  <tr className="border-b border-border bg-muted/50">
                    <td className="px-4 py-2 text-body-sm" colSpan={3}>প্রারম্ভিক জের</td>
                    <td className="px-4 py-2"></td>
                    <td className="px-4 py-2 text-right font-mono text-body-sm font-medium">{formatPaisa(statement.openingBalance)}</td>
                  </tr>
                )}
                {stmtLoading ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-body-sm">লোড হচ্ছে...</td></tr>
                ) : !statement?.transactions?.length ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-body-sm text-text-tertiary">কোন লেনদেন নেই</td></tr>
                ) : (
                  statement.transactions.map((tx: any) => {
                    const label = TX_TYPE_LABELS[tx.transactionType] || { bn: tx.transactionType, en: tx.transactionType };
                    const isPositive = tx.amountPaisa > 0;
                    return (
                      <tr key={tx.id} className="border-b border-border hover:bg-subtle/30">
                        <td className="px-4 py-2.5 text-body-sm">{formatDate(tx.createdAt)}</td>
                        <td className="px-4 py-2.5"><Badge variant={isPositive ? 'danger' : 'success'}>{label.bn}</Badge></td>
                        <td className="px-4 py-2.5 text-body-sm">
                          <span className="flex items-center gap-1"><FileText size={12} /> {tx.referenceType || '-'} {tx.referenceId ? `#${tx.referenceId.slice(-6)}` : ''}</span>
                          {tx.notes && <p className="text-caption text-text-tertiary">{tx.notes}</p>}
                        </td>
                        <td className={`px-4 py-2.5 text-right font-mono text-body-sm font-medium ${isPositive ? 'text-danger-600' : 'text-success-600'}`}>
                          {isPositive ? '+' : ''}{formatPaisa(tx.amountPaisa)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-body-sm font-medium">{formatPaisa(tx.runningBalance)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Modal open={showPay} onClose={() => setShowPay(false)} title="সাপ্লায়ার পরিশোধ" size="md">
        <div className="space-y-4">
          <div>
            <label className="text-label block mb-1">পরিমাণ (৳) *</label>
            <Input type="number" step="0.01" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="0.00" autoFocus />
            <p className="text-caption text-text-tertiary mt-1">বর্তমান বকেয়া: {formatPaisa(supplier.currentPayablePaisa)}</p>
          </div>
          <div>
            <label className="text-label block mb-1">পেমেন্ট পদ্ধতি</label>
            <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className="w-full h-9 px-3 rounded-sm border border-border bg-surface text-body-sm">
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
          <div>
            <label className="text-label block mb-1">নোট</label>
            <Input value={payNote} onChange={e => setPayNote(e.target.value)} placeholder="অতিরিক্ত তথ্য" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowPay(false)}>বাতিল</Button>
            <Button onClick={handlePay} loading={payMut.isPending}>পরিশোধ করুন</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
