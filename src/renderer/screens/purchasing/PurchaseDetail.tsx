import React, { useState } from 'react';
import { usePurchase, useCancelPurchase, useCreatePurchaseReturn } from '../../hooks/usePurchases';
import { useSuppliers } from '../../hooks/useSuppliers';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { ArrowLeft, XCircle, RotateCcw } from 'lucide-react';

function formatPaisa(paisa: number): string {
  return `৳ ${(paisa / 100).toLocaleString('en-BD', { minimumFractionDigits: 2 })}`;
}
function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('bn-BD', { dateStyle: 'medium', timeStyle: 'short' });
}

const STATUS_LABEL: Record<string, string> = {
  paid: 'পরিশোধিত',
  partially_paid: 'আংশিক পরিশোধিত',
  received: 'গ্রহণ করা হয়েছে',
  draft: 'খসড়া',
  cancelled: 'বাতিল',
};

export const PurchaseDetail: React.FC<{ purchaseId: string; businessId: string; onBack: () => void }> = ({ purchaseId, businessId, onBack }) => {
  const { data, isLoading } = usePurchase(purchaseId);
  const { data: suppliers } = useSuppliers(businessId);
  const cancelMut = useCancelPurchase();
  const returnMut = useCreatePurchaseReturn();

  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showReturn, setShowReturn] = useState(false);
  const [returnItems, setReturnItems] = useState<{ productId: string; quantity: string }[]>([]);
  const [returnReason, setReturnReason] = useState('');

  const supplierMap = React.useMemo(() => {
    const m: Record<string, string> = {};
    (suppliers || []).forEach((s: any) => (m[s.id] = s.name));
    return m;
  }, [suppliers]);

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!data) {
    return <div className="text-center py-12"><p>ক্রয় পাওয়া যায়নি</p><Button className="mt-4" onClick={onBack}>ফিরে যান</Button></div>;
  }

  const { purchase, items, payments, returns } = data as any;

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      alert('বাতিলের কারণ লিখুন');
      return;
    }
    try {
      await cancelMut.mutateAsync({ id: purchaseId, reason: cancelReason });
      setShowCancel(false);
      onBack();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleReturn = async () => {
    const validItems = returnItems.filter(ri => parseFloat(ri.quantity) > 0).map(ri => ({
      productId: ri.productId,
      quantityMilli: Math.round(parseFloat(ri.quantity) * 1000),
    }));
    if (validItems.length === 0) {
      alert('ফেরতের জন্য পণ্য নির্বাচন করুন');
      return;
    }
    try {
      await returnMut.mutateAsync({
        businessId,
        purchaseId,
        items: validItems,
        reason: returnReason,
      });
      setShowReturn(false);
      setReturnItems([]);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const initReturn = () => {
    setReturnItems(items.map((it: any) => ({ productId: it.productId, quantity: '' })));
    setShowReturn(true);
  };

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft size={18} /></Button>
        <div>
          <h1 className="text-h1 font-mono">{purchase.purchaseNumber}</h1>
          <p className="text-body-sm text-text-secondary">{supplierMap[purchase.supplierId]} • {formatDate(purchase.purchaseDate)}</p>
        </div>
        <div className="ml-auto flex gap-2">
          <Badge variant={purchase.status === 'paid' ? 'success' : purchase.status === 'cancelled' ? 'danger' : 'warning'}>{STATUS_LABEL[purchase.status] || purchase.status}</Badge>
          {purchase.status !== 'cancelled' && purchase.status !== 'paid' && (
            <Button variant="secondary" size="sm" onClick={() => setShowCancel(true)}><XCircle size={14} className="mr-1" /> বাতিল</Button>
          )}
          {purchase.status !== 'cancelled' && (
            <Button variant="secondary" size="sm" onClick={initReturn}><RotateCcw size={14} className="mr-1" /> ফেরত</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-body-sm">সাপ্লায়ার</CardTitle></CardHeader>
          <CardContent><p className="text-body font-medium">{supplierMap[purchase.supplierId]}</p><p className="text-caption text-text-tertiary">ID: {purchase.supplierId.slice(0, 8)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-body-sm">আর্থিক</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-body-sm">
            <div className="flex justify-between"><span>উপমোট</span><span className="font-mono">{formatPaisa(purchase.subtotalPaisa)}</span></div>
            <div className="flex justify-between"><span>ডিসকাউন্ট</span><span className="font-mono">- {formatPaisa(purchase.discountPaisa)}</span></div>
            <div className="flex justify-between"><span>ট্যাক্স</span><span className="font-mono">+ {formatPaisa(purchase.taxPaisa)}</span></div>
            <div className="flex justify-between"><span>শিপিং</span><span className="font-mono">+ {formatPaisa(purchase.shippingPaisa)}</span></div>
            <div className="flex justify-between font-semibold border-t pt-1"><span>মোট</span><span className="font-mono">{formatPaisa(purchase.totalPaisa)}</span></div>
            <div className="flex justify-between text-success-600"><span>পরিশোধ</span><span className="font-mono">{formatPaisa(purchase.paidPaisa)}</span></div>
            <div className="flex justify-between text-danger-600 font-semibold"><span>বকেয়া</span><span className="font-mono">{formatPaisa(purchase.duePaisa)}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-body-sm">অতিরিক্ত</CardTitle></CardHeader>
          <CardContent className="text-body-sm space-y-1">
            <p>অবস্থা: <Badge variant="default">{STATUS_LABEL[purchase.status]}</Badge></p>
            {purchase.notes && <p>নোট: {purchase.notes}</p>}
            {purchase.voidReason && <p className="text-danger-600">বাতিল: {purchase.voidReason}</p>}
            <p className="text-caption text-text-tertiary">তৈরি: {formatDate(purchase.createdAt)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>পণ্য তালিকা</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full">
            <thead className="bg-subtle border-y border-border">
              <tr>
                <th className="text-left text-caption font-medium px-4 py-2">পণ্য</th>
                <th className="text-right text-caption font-medium px-4 py-2">পরিমাণ</th>
                <th className="text-right text-caption font-medium px-4 py-2">বেস পরিমাণ</th>
                <th className="text-right text-caption font-medium px-4 py-2">দর</th>
                <th className="text-right text-caption font-medium px-4 py-2">বেস দর</th>
                <th className="text-right text-caption font-medium px-4 py-2">মোট</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it: any) => (
                <tr key={it.id} className="border-b border-border">
                  <td className="px-4 py-2.5 text-body-sm font-mono">{it.productId.slice(0, 8)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-body-sm">{it.quantityMilli / 1000}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-body-sm text-text-tertiary">{it.baseQuantityMilli / 1000}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-body-sm">{formatPaisa(it.costPerUnitPaisa)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-body-sm text-text-tertiary">{formatPaisa(it.baseCostPerUnitPaisa)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-body-sm font-medium">{formatPaisa(it.lineTotalPaisa)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {payments?.length > 0 && (
        <Card>
          <CardHeader><CardTitle>পেমেন্ট</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full">
              <thead className="bg-subtle border-y border-border">
                <tr>
                  <th className="text-left text-caption font-medium px-4 py-2">নম্বর</th>
                  <th className="text-left text-caption font-medium px-4 py-2">পদ্ধতি</th>
                  <th className="text-right text-caption font-medium px-4 py-2">পরিমাণ</th>
                  <th className="text-left text-caption font-medium px-4 py-2">তারিখ</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p: any) => (
                  <tr key={p.id} className="border-b border-border">
                    <td className="px-4 py-2 text-body-sm font-mono">{p.paymentNumber}</td>
                    <td className="px-4 py-2 text-body-sm"><Badge variant="default">{p.paymentMethod}</Badge></td>
                    <td className="px-4 py-2 text-right font-mono text-body-sm">{formatPaisa(p.amountPaisa)}</td>
                    <td className="px-4 py-2 text-body-sm">{formatDate(p.paymentDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {returns?.length > 0 && (
        <Card>
          <CardHeader><CardTitle>ফেরত</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full">
              <thead className="bg-subtle border-y border-border">
                <tr>
                  <th className="text-left text-caption font-medium px-4 py-2">নম্বর</th>
                  <th className="text-right text-caption font-medium px-4 py-2">মোট</th>
                  <th className="text-left text-caption font-medium px-4 py-2">কারণ</th>
                  <th className="text-left text-caption font-medium px-4 py-2">তারিখ</th>
                </tr>
              </thead>
              <tbody>
                {returns.map((r: any) => (
                  <tr key={r.id} className="border-b border-border">
                    <td className="px-4 py-2 font-mono text-body-sm">{r.returnNumber}</td>
                    <td className="px-4 py-2 text-right font-mono text-body-sm">{formatPaisa(r.totalPaisa)}</td>
                    <td className="px-4 py-2 text-body-sm">{r.reason || '-'}</td>
                    <td className="px-4 py-2 text-body-sm">{formatDate(r.returnDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Modal open={showCancel} onClose={() => setShowCancel(false)} title="ক্রয় বাতিল" size="sm">
        <div className="space-y-3">
          <p className="text-body-sm">এই ক্রয়টি বাতিল করতে চান? স্টক থেকে পণ্য বাদ যাবে।</p>
          <Input value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="বাতিলের কারণ *" />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowCancel(false)}>ফিরে যান</Button>
            <Button variant="danger" onClick={handleCancel} loading={cancelMut.isPending}>বাতিল করুন</Button>
          </div>
        </div>
      </Modal>

      <Modal open={showReturn} onClose={() => setShowReturn(false)} title="ক্রয় ফেরত" size="lg">
        <div className="space-y-4">
          <div className="space-y-2">
            {items.map((it: any, idx: number) => (
              <div key={it.id} className="flex items-center gap-3 p-2 border border-border rounded-sm">
                <span className="flex-1 text-body-sm font-mono">{it.productId.slice(0, 8)} — {it.baseQuantityMilli / 1000} বেস</span>
                <Input type="number" step="0.001" value={returnItems[idx]?.quantity || ''} onChange={e => { const newItems = [...returnItems]; newItems[idx].quantity = e.target.value; setReturnItems(newItems); }} placeholder="ফেরত পরিমাণ" className="w-32" />
              </div>
            ))}
          </div>
          <Input value={returnReason} onChange={e => setReturnReason(e.target.value)} placeholder="ফেরতের কারণ" />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowReturn(false)}>বাতিল</Button>
            <Button onClick={handleReturn} loading={returnMut.isPending}>ফেরত সংরক্ষণ</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
