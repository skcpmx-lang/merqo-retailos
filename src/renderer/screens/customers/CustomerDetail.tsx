import React, { useState, useMemo } from 'react';
import { useCustomer, useCustomerStatement, useCustomerCollect } from '../../hooks/useCustomers';
import { useSales } from '../../hooks/useSales';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { ArrowLeft, Phone, Mail, MapPin, CreditCard, Wallet, Banknote, Building, Receipt } from 'lucide-react';

interface Props {
  customerId: string;
  businessId: string;
  onBack: () => void;
}

function formatPaisa(paisa: number): string {
  const bdt = paisa / 100;
  return `৳ ${bdt.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('bn-BD', { dateStyle: 'short', timeStyle: 'short' });
}

const TX_TYPE_LABELS: Record<string, string> = {
  opening_due: 'প্রারম্ভিক বকেয়া',
  sale: 'বিক্রয়',
  payment: 'পরিশোধ',
  return: 'ফেরত',
  adjustment: 'সমন্বয়',
  customer_payment: 'গ্রাহক পরিশোধ',
};

export const CustomerDetail: React.FC<Props> = ({ customerId, businessId, onBack }) => {
  const { data: customer, isLoading } = useCustomer(customerId);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showCollect, setShowCollect] = useState(false);
  const [collectForm, setCollectForm] = useState({ amount: '', method: 'cash', notes: '', cashAccountId: '', bankAccountId: '', mfsAccountId: '', chequeNumber: '', transactionRef: '' });

  const fromTs = fromDate ? new Date(fromDate).getTime() : undefined;
  const toTs = toDate ? new Date(toDate).getTime() : undefined;

  const { data: statement, isLoading: loadingStmt } = useCustomerStatement(customerId, fromTs, toTs);
  const { data: salesData } = useSales(businessId, { customerId }, 20, 0);
  const collectMut = useCustomerCollect();

  const handleCollect = async () => {
    const amount = parseFloat(collectForm.amount);
    if (!amount || amount <= 0) {
      alert('সঠিক পরিমাণ দিন');
      return;
    }
    try {
      await collectMut.mutateAsync({
        businessId,
        customerId,
        amountPaisa: Math.round(amount * 100),
        method: collectForm.method,
        cashAccountId: collectForm.cashAccountId || undefined,
        bankAccountId: collectForm.bankAccountId || undefined,
        mfsAccountId: collectForm.mfsAccountId || undefined,
        chequeNumber: collectForm.chequeNumber || undefined,
        transactionRef: collectForm.transactionRef || undefined,
        notes: collectForm.notes || undefined,
      });
      setShowCollect(false);
      setCollectForm({ amount: '', method: 'cash', notes: '', cashAccountId: '', bankAccountId: '', mfsAccountId: '', chequeNumber: '', transactionRef: '' });
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-20">
        <p className="text-body text-text-secondary">গ্রাহক পাওয়া যায়নি</p>
        <Button variant="secondary" className="mt-4" onClick={onBack}>ফিরে যান</Button>
      </div>
    );
  }

  const currentDue = statement?.currentDue ?? customer.currentDuePaisa;
  const openingBalance = statement?.openingBalance ?? 0;
  const transactions = statement?.transactions || [];

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft size={18} /></Button>
        <div className="flex-1">
          <h1 className="text-h2 text-text-primary">{customer.name}</h1>
          {customer.companyName && <p className="text-body-sm text-text-secondary">{customer.companyName}</p>}
        </div>
        <Button onClick={() => setShowCollect(true)}><Banknote size={16} className="mr-2" /> পরিশোধ করুন</Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-body-sm">বর্তমান বাকি</CardTitle></CardHeader>
          <CardContent>
            <p className="text-h2 font-mono text-danger-600">{formatPaisa(currentDue)}</p>
            <p className="text-caption text-text-tertiary mt-1">গ্রাহকের কাছে পাওনা</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-body-sm">প্রারম্ভিক বকেয়া</CardTitle></CardHeader>
          <CardContent>
            <p className="text-h3 font-mono text-text-primary">{formatPaisa(customer.openingDuePaisa)}</p>
            <p className="text-caption text-text-tertiary mt-1">শুরুতে</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-body-sm">যোগাযোগ</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {customer.phone && <p className="text-body-sm flex items-center gap-2"><Phone size={14} /> {customer.phone}</p>}
            {customer.email && <p className="text-body-sm flex items-center gap-2"><Mail size={14} /> {customer.email}</p>}
            {customer.address && <p className="text-body-sm flex items-center gap-2"><MapPin size={14} /> {customer.address}</p>}
            {!customer.phone && !customer.email && <p className="text-caption text-text-tertiary">কোন যোগাযোগ নেই</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>লেনদেন বিবরণী</CardTitle>
            <div className="flex items-center gap-2">
              <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="h-8 text-caption" />
              <span className="text-caption text-text-tertiary">থেকে</span>
              <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="h-8 text-caption" />
              {(fromDate || toDate) && <Button variant="ghost" size="sm" onClick={() => { setFromDate(''); setToDate(''); }}>রিসেট</Button>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto max-h-[400px]">
            <table className="w-full">
              <thead className="bg-subtle border-y border-border sticky top-0">
                <tr>
                  <th className="text-left text-caption font-medium text-text-tertiary px-4 py-2">তারিখ</th>
                  <th className="text-left text-caption font-medium text-text-tertiary px-4 py-2">ধরণ</th>
                  <th className="text-left text-caption font-medium text-text-tertiary px-4 py-2">রেফারেন্স</th>
                  <th className="text-right text-caption font-medium text-text-tertiary px-4 py-2">টাকা</th>
                  <th className="text-right text-caption font-medium text-text-tertiary px-4 py-2">চলমান বাকি</th>
                </tr>
              </thead>
              <tbody>
                {loadingStmt ? (
                  <tr><td colSpan={5} className="text-center py-8"><div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" /></td></tr>
                ) : transactions.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-body-sm text-text-tertiary">কোন লেনদেন নেই</td></tr>
                ) : (
                  <>
                    {fromDate && (
                      <tr className="bg-muted/30 border-b">
                        <td className="px-4 py-2 text-caption text-text-tertiary" colSpan={4}>প্রারম্ভিক বকেয়া</td>
                        <td className="px-4 py-2 text-right font-mono text-body-sm">{formatPaisa(openingBalance)}</td>
                      </tr>
                    )}
                    {transactions.map((tx: any) => (
                      <tr key={tx.id} className="border-b border-border hover:bg-subtle/30">
                        <td className="px-4 py-2 text-caption text-text-secondary">{formatDate(tx.createdAt)}</td>
                        <td className="px-4 py-2"><Badge variant={tx.amountPaisa > 0 ? 'default' : 'success'}>{TX_TYPE_LABELS[tx.transactionType] || tx.transactionType}</Badge></td>
                        <td className="px-4 py-2 text-caption text-text-secondary truncate max-w-[150px]">{tx.referenceType ? `${tx.referenceType} ${tx.referenceId?.slice(0, 8)}` : '-'}</td>
                        <td className={`px-4 py-2 text-right font-mono text-body-sm ${tx.amountPaisa > 0 ? 'text-danger-600' : 'text-success-600'}`}>{tx.amountPaisa > 0 ? '+' : ''}{formatPaisa(tx.amountPaisa)}</td>
                        <td className="px-4 py-2 text-right font-mono text-body-sm font-medium">{formatPaisa(tx.runningBalance)}</td>
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Receipt size={16} /> সাম্প্রতিক বিক্রয়</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <table className="w-full">
              <thead className="bg-subtle border-y border-border">
                <tr>
                  <th className="text-left text-caption font-medium text-text-tertiary px-4 py-2">নম্বর</th>
                  <th className="text-left text-caption font-medium text-text-tertiary px-4 py-2">তারিখ</th>
                  <th className="text-right text-caption font-medium text-text-tertiary px-4 py-2">মোট</th>
                  <th className="text-right text-caption font-medium text-text-tertiary px-4 py-2">পরিশোধিত</th>
                  <th className="text-right text-caption font-medium text-text-tertiary px-4 py-2">বাকি</th>
                  <th className="text-left text-caption font-medium text-text-tertiary px-4 py-2">অবস্থা</th>
                </tr>
              </thead>
              <tbody>
                {(salesData || []).length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-6 text-body-sm text-text-tertiary">কোন বিক্রয় নেই</td></tr>
                ) : (
                  (salesData || []).map((s: any) => (
                    <tr key={s.id} className="border-b border-border hover:bg-subtle/30">
                      <td className="px-4 py-2 font-mono text-body-sm">{s.saleNumber}</td>
                      <td className="px-4 py-2 text-caption">{formatDate(s.saleDate)}</td>
                      <td className="px-4 py-2 text-right font-mono text-body-sm">{formatPaisa(s.totalPaisa)}</td>
                      <td className="px-4 py-2 text-right font-mono text-body-sm text-success-600">{formatPaisa(s.paidPaisa)}</td>
                      <td className="px-4 py-2 text-right font-mono text-body-sm text-danger-600">{formatPaisa(s.duePaisa)}</td>
                      <td className="px-4 py-2"><Badge variant={s.status === 'paid' ? 'success' : s.status === 'partially_paid' ? 'default' : 'default'}>{s.status}</Badge></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Modal open={showCollect} onClose={() => setShowCollect(false)} title="বাকি পরিশোধ" size="md">
        <div className="space-y-4">
          <div className="bg-subtle p-3 rounded">
            <p className="text-caption text-text-tertiary">বর্তমান বাকি</p>
            <p className="text-h3 font-mono text-danger-600">{formatPaisa(currentDue)}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-label mb-1 block">পরিমাণ (৳) *</label>
              <Input type="number" step="0.01" value={collectForm.amount} onChange={e => setCollectForm({ ...collectForm, amount: e.target.value })} placeholder="0.00" autoFocus />
              {collectForm.amount && <p className="text-caption text-text-tertiary mt-1">অবশিষ্ট: {formatPaisa(currentDue - Math.round(parseFloat(collectForm.amount || '0') * 100))}</p>}
            </div>
            <div>
              <label className="text-label mb-1 block">পদ্ধতি</label>
              <select value={collectForm.method} onChange={e => setCollectForm({ ...collectForm, method: e.target.value })} className="w-full h-9 rounded-sm border border-border bg-surface px-3 text-body-sm">
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
          </div>

          <div>
            <label className="text-label mb-1 block">নোট</label>
            <Input value={collectForm.notes} onChange={e => setCollectForm({ ...collectForm, notes: e.target.value })} placeholder="রেফারেন্স, নোট" />
          </div>

          {(collectForm.method === 'cheque' || collectForm.method === 'bank') && (
            <div>
              <label className="text-label mb-1 block">চেক নম্বর / রেফারেন্স</label>
              <Input value={collectForm.chequeNumber} onChange={e => setCollectForm({ ...collectForm, chequeNumber: e.target.value })} placeholder="চেক নম্বর" />
            </div>
          )}

          {['bkash', 'nagad', 'rocket', 'upay'].includes(collectForm.method) && (
            <div>
              <label className="text-label mb-1 block">ট্রানজেকশন আইডি</label>
              <Input value={collectForm.transactionRef} onChange={e => setCollectForm({ ...collectForm, transactionRef: e.target.value })} placeholder="TrxID" />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowCollect(false)}>বাতিল</Button>
            <Button onClick={handleCollect} loading={collectMut.isPending}>পরিশোধ করুন</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
