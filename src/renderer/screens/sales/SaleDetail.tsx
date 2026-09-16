import React, { useState } from 'react';
import { useSale, useCancelSale, useSaleReturn } from '../../hooks/useSales';
import { useConfiguredPrinter, usePrintReceipt, usePrintInvoice, useReprintReceipt } from '../../hooks/useHardware';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { ArrowLeft, XCircle, Undo2, Printer, FileText, AlertTriangle, CheckCircle } from 'lucide-react';

function formatPaisa(paisa: number): string {
  return `৳ ${(paisa / 100).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('bn-BD', { dateStyle: 'short', timeStyle: 'short' });
}

const STATUS_LABEL: Record<string, string> = {
  paid: 'পরিশোধিত',
  partially_paid: 'আংশিক পরিশোধিত',
  completed: 'সম্পন্ন',
  draft: 'খসড়া',
  cancelled: 'বাতিল',
  voided: 'বাতিল',
  partially_returned: 'আংশিক ফেরত',
  refunded: 'ফেরত',
};

export const SaleDetail: React.FC<{ saleId: string; businessId: string; onBack: () => void }> = ({ saleId, businessId, onBack }) => {
  const { data, isLoading } = useSale(saleId);
  const cancelMut = useCancelSale();
  const returnMut = useSaleReturn();
  const { data: configuredPrinter } = useConfiguredPrinter();
  const printReceiptMut = usePrintReceipt();
  const printInvoiceMut = usePrintInvoice();
  const reprintMut = useReprintReceipt();

  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showReturn, setShowReturn] = useState(false);
  const [returnItems, setReturnItems] = useState<{ productId: string; quantity: string; reason?: string }[]>([]);
  const [returnReason, setReturnReason] = useState('');
  const [refundMethod, setRefundMethod] = useState('cash');
  const [printMsg, setPrintMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (isLoading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!data) {
    return <div className="text-center py-20"><p>বিক্রয় পাওয়া যায়নি</p><Button variant="secondary" className="mt-4" onClick={onBack}>ফিরে যান</Button></div>;
  }

  const { sale, items, payments, returns } = data as any;

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      alert('বাতিলের কারণ লিখুন');
      return;
    }
    try {
      await cancelMut.mutateAsync({ id: sale.id, reason: cancelReason });
      setShowCancel(false);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleReturn = async () => {
    if (returnItems.length === 0) {
      alert('ফেরত আইটেম যোগ করুন');
      return;
    }
    try {
      const payloadItems = returnItems.map(ri => ({
        productId: ri.productId,
        quantityMilli: Math.round((parseFloat(ri.quantity) || 0) * 1000),
        reason: ri.reason,
      }));
      await returnMut.mutateAsync({
        businessId,
        saleId: sale.id,
        items: payloadItems,
        reason: returnReason,
        refundMethod,
      });
      setShowReturn(false);
      setReturnItems([]);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const addReturnItem = (productId: string) => {
    if (returnItems.find(r => r.productId === productId)) return;
    setReturnItems([...returnItems, { productId, quantity: '1' }]);
  };

  const handlePrint = async (type: 'receipt' | 'invoice' | 'reprint') => {
    try {
      setPrintMsg(null);
      let result: any;
      if (type === 'receipt') {
        result = await printReceiptMut.mutateAsync({
          saleId: sale.id,
          printerName: configuredPrinter?.selectedPrinterName || undefined,
          paperWidth: configuredPrinter?.paperWidth || '80mm',
          copies: configuredPrinter?.copies || 1,
        });
      } else if (type === 'invoice') {
        result = await printInvoiceMut.mutateAsync({
          saleId: sale.id,
          printerName: configuredPrinter?.a4PrinterName || configuredPrinter?.selectedPrinterName || undefined,
          copies: 1,
        });
      } else {
        result = await reprintMut.mutateAsync({
          saleId: sale.id,
          printerName: configuredPrinter?.selectedPrinterName || undefined,
          paperWidth: configuredPrinter?.paperWidth || '80mm',
          copies: 1,
        });
      }

      if (result.success) {
        setPrintMsg({ type: 'success', text: result.messageBn || 'প্রিন্ট সফল' });
      } else {
        setPrintMsg({ type: 'error', text: result.messageBn || 'প্রিন্ট ব্যর্থ, কিন্তু বিক্রয় রেকর্ড অপরিবর্তিত' });
      }
      setTimeout(() => setPrintMsg(null), 4000);
    } catch (e: any) {
      setPrintMsg({ type: 'error', text: e.message || 'রসিদ প্রিন্ট করা যায়নি। প্রিন্টার পরীক্ষা করে আবার চেষ্টা করুন।' });
    }
  };

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft size={18} /></Button>
        <div className="flex-1">
          <h1 className="text-h2 font-mono text-text-primary">{sale.saleNumber}</h1>
          <p className="text-body-sm text-text-secondary">{formatDate(sale.saleDate)} • {STATUS_LABEL[sale.status] || sale.status}</p>
        </div>
        <Badge variant={sale.status === 'paid' ? 'success' : sale.status === 'partially_paid' ? 'warning' : 'default'}>{STATUS_LABEL[sale.status] || sale.status}</Badge>
        <Button variant="secondary" size="sm" onClick={() => handlePrint('receipt')} loading={printReceiptMut.isPending}>
          <Printer size={14} className="mr-1" /> রসিদ {configuredPrinter?.paperWidth || '80mm'}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => handlePrint('reprint')} loading={reprintMut.isPending}>
          <Printer size={14} className="mr-1" /> পুনরায় প্রিন্ট
        </Button>
        <Button variant="secondary" size="sm" onClick={() => handlePrint('invoice')} loading={printInvoiceMut.isPending}>
          <FileText size={14} className="mr-1" /> A4 ইনভয়েস
        </Button>
        {sale.status !== 'cancelled' && sale.status !== 'voided' && sale.status !== 'refunded' && (
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowReturn(true)}><Undo2 size={14} className="mr-1" /> ফেরত</Button>
            <Button variant="danger" size="sm" onClick={() => setShowCancel(true)}><XCircle size={14} className="mr-1" /> বাতিল</Button>
          </>
        )}
      </div>

      {printMsg && (
        <div className={`p-3 rounded border flex items-start gap-2 ${printMsg.type === 'success' ? 'bg-success-50 border-success-200 text-success-700' : 'bg-danger-50 border-danger-200 text-danger-700'}`}>
          {printMsg.type === 'success' ? <CheckCircle size={16} className="mt-0.5" /> : <AlertTriangle size={16} className="mt-0.5" />}
          <span className="text-body-sm">{printMsg.text}</span>
        </div>
      )}

      <div className="bg-info-50 border border-info-200 rounded p-3 text-caption">
        <p className="font-medium">P4.2 প্রিন্ট নিরাপত্তা:</p>
        <p>• রসিদ/ইনভয়েস প্রিন্ট বা পুনরায় প্রিন্ট কখনো নতুন বিক্রয়, পেমেন্ট, স্টক, গ্রাহক বকেয়া তৈরি করবে না — শুধু প্রিন্ট + অডিট লগ</p>
        <p>• প্রিন্ট ব্যর্থ হলেও বিক্রয় রেকর্ড, স্টক, পেমেন্ট অপরিবর্তিত থাকবে — আবার প্রিন্ট করতে পারবেন</p>
        <p>• দ্রুত ডাবল-ক্লিক প্রিন্ট শারীরিকভাবে ২টি রসিদ দিতে পারে কিন্তু আর্থিক ডেটা ডুপ্লিকেট হবে না</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-body-sm">আর্থিক সারাংশ</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-body-sm"><span>সাবটোটাল</span><span className="font-mono">{formatPaisa(sale.subtotalPaisa)}</span></div>
            {sale.discountPaisa > 0 && <div className="flex justify-between text-body-sm"><span>ছাড়</span><span className="font-mono text-success-600">- {formatPaisa(sale.discountPaisa)}</span></div>}
            {sale.taxPaisa > 0 && <div className="flex justify-between text-body-sm"><span>ট্যাক্স</span><span className="font-mono">{formatPaisa(sale.taxPaisa)}</span></div>}
            {sale.shippingPaisa > 0 && <div className="flex justify-between text-body-sm"><span>শিপিং</span><span className="font-mono">{formatPaisa(sale.shippingPaisa)}</span></div>}
            <div className="flex justify-between text-body font-medium border-t pt-2"><span>মোট</span><span className="font-mono">{formatPaisa(sale.totalPaisa)}</span></div>
            <div className="flex justify-between text-body-sm"><span>পরিশোধিত</span><span className="font-mono text-success-600">{formatPaisa(sale.paidPaisa)}</span></div>
            <div className="flex justify-between text-body-sm font-medium"><span>বাকি</span><span className={`font-mono ${sale.duePaisa > 0 ? 'text-danger-600' : ''}`}>{formatPaisa(sale.duePaisa)}</span></div>
            {sale.refundPaisa > 0 && <div className="flex justify-between text-body-sm"><span>ফেরত</span><span className="font-mono text-danger-600">{formatPaisa(sale.refundPaisa)}</span></div>}
          </CardContent>
        </Card>

        <Card className="col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-body-sm">পণ্য তালিকা — বাংলা নাম wrap, পরিমাণ/দাম ডানদিকে</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto">
              <table className="w-full">
                <thead className="bg-subtle border-y border-border">
                  <tr>
                    <th className="text-left text-caption font-medium px-3 py-2">পণ্য</th>
                    <th className="text-right text-caption font-medium px-3 py-2">পরিমাণ</th>
                    <th className="text-right text-caption font-medium px-3 py-2">দাম</th>
                    <th className="text-right text-caption font-medium px-3 py-2">মোট</th>
                    <th className="text-right text-caption font-medium px-3 py-2">লাভ</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it: any) => (
                    <tr key={it.id} className="border-b border-border">
                      <td className="px-3 py-2 text-body-sm"><span className="font-medium" style={{ wordBreak: 'break-word' }}>{it.productNameSnapshot || it.productId.slice(0, 8)}</span><br /><span className="text-caption text-text-tertiary">{it.quantityMilli / 1000} × {formatPaisa(it.unitPricePaisa)}</span></td>
                      <td className="px-3 py-2 text-right font-mono text-body-sm">{it.quantityMilli / 1000} ({it.baseQuantityMilli / 1000} বেস)</td>
                      <td className="px-3 py-2 text-right font-mono text-body-sm">{formatPaisa(it.unitPricePaisa)}<br /><span className="text-caption text-text-tertiary">{formatPaisa(it.costPerUnitPaisa)} কস্ট</span></td>
                      <td className="px-3 py-2 text-right font-mono text-body-sm font-medium">{formatPaisa(it.lineTotalPaisa)}</td>
                      <td className="px-3 py-2 text-right font-mono text-body-sm text-success-600">{formatPaisa(it.lineTotalPaisa - it.lineCostTotalPaisa)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-body-sm">পেমেন্ট</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full">
              <thead className="bg-subtle border-y border-border">
                <tr>
                  <th className="text-left text-caption font-medium px-3 py-2">নম্বর</th>
                  <th className="text-left text-caption font-medium px-3 py-2">পদ্ধতি</th>
                  <th className="text-right text-caption font-medium px-3 py-2">টাকা</th>
                  <th className="text-left text-caption font-medium px-3 py-2">তারিখ</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-4 text-caption text-text-tertiary">কোন পেমেন্ট নেই (বাকি বিক্রয়)</td></tr>
                ) : (
                  payments.map((p: any) => (
                    <tr key={p.id} className="border-b border-border">
                      <td className="px-3 py-2 font-mono text-caption">{p.paymentNumber || p.id.slice(0, 8)}</td>
                      <td className="px-3 py-2"><Badge variant="default">{p.paymentMethod}</Badge></td>
                      <td className="px-3 py-2 text-right font-mono text-body-sm">{formatPaisa(p.amountPaisa)}</td>
                      <td className="px-3 py-2 text-caption">{p.paymentDate ? formatDate(p.paymentDate) : formatDate(p.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-body-sm">ফেরত</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full">
              <thead className="bg-subtle border-y border-border">
                <tr>
                  <th className="text-left text-caption font-medium px-3 py-2">নম্বর</th>
                  <th className="text-right text-caption font-medium px-3 py-2">টাকা</th>
                  <th className="text-left text-caption font-medium px-3 py-2">কারণ</th>
                  <th className="text-left text-caption font-medium px-3 py-2">তারিখ</th>
                </tr>
              </thead>
              <tbody>
                {returns.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-4 text-caption text-text-tertiary">কোন ফেরত নেই</td></tr>
                ) : (
                  returns.map((r: any) => (
                    <tr key={r.id} className="border-b border-border">
                      <td className="px-3 py-2 font-mono text-caption">{r.returnNumber}</td>
                      <td className="px-3 py-2 text-right font-mono text-body-sm">{formatPaisa(r.totalPaisa)}</td>
                      <td className="px-3 py-2 text-caption">{r.reason || '-'}</td>
                      <td className="px-3 py-2 text-caption">{formatDate(r.returnDate)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {sale.voidReason && (
        <Card className="border-danger-200 bg-danger-50">
          <CardContent className="py-3">
            <p className="text-body-sm text-danger-600">বাতিলের কারণ: {sale.voidReason}</p>
            <p className="text-caption text-text-tertiary">বাতিলের সময়: {sale.voidedAt ? formatDate(sale.voidedAt) : '-'}</p>
          </CardContent>
        </Card>
      )}

      <Modal open={showCancel} onClose={() => setShowCancel(false)} title="বিক্রয় বাতিল" size="md">
        <div className="space-y-4">
          <p className="text-body-sm text-text-secondary">বিক্রয় <span className="font-mono font-medium">{sale.saleNumber}</span> বাতিল করতে চান? স্টক ফেরত আসবে এবং বকেয়া সমন্বয় হবে।</p>
          <div>
            <label className="text-label mb-1 block">বাতিলের কারণ *</label>
            <Input value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="কারণ লিখুন" autoFocus />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowCancel(false)}>বন্ধ করুন</Button>
            <Button variant="danger" onClick={handleCancel} loading={cancelMut.isPending}>বাতিল করুন</Button>
          </div>
        </div>
      </Modal>

      <Modal open={showReturn} onClose={() => setShowReturn(false)} title="বিক্রয় ফেরত" size="lg">
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-label">ফেরতযোগ্য পণ্য</p>
            <div className="flex flex-wrap gap-2">
              {items.map((it: any) => (
                <Button key={it.productId} variant="secondary" size="sm" onClick={() => addReturnItem(it.productId)}>{it.productNameSnapshot || it.productId.slice(0, 6)} যোগ</Button>
              ))}
            </div>
          </div>

          {returnItems.length > 0 && (
            <div className="space-y-2">
              {returnItems.map((ri, idx) => {
                const product = items.find((i: any) => i.productId === ri.productId);
                return (
                  <div key={idx} className="grid grid-cols-4 gap-2 bg-subtle p-2 rounded">
                    <div className="col-span-2 text-body-sm">{product?.productNameSnapshot || ri.productId.slice(0, 8)}</div>
                    <Input type="number" step="0.001" value={ri.quantity} onChange={e => {
                      const arr = [...returnItems];
                      arr[idx] = { ...arr[idx], quantity: e.target.value };
                      setReturnItems(arr);
                    }} placeholder="পরিমাণ" />
                    <Button variant="ghost" size="sm" onClick={() => setReturnItems(returnItems.filter((_, i) => i !== idx))}>মুছুন</Button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-label mb-1 block">ফেরত কারণ</label>
              <Input value={returnReason} onChange={e => setReturnReason(e.target.value)} placeholder="কারণ" />
            </div>
            <div>
              <label className="text-label mb-1 block">রিফান্ড পদ্ধতি</label>
              <select value={refundMethod} onChange={e => setRefundMethod(e.target.value)} className="w-full h-9 px-3 rounded-sm border border-border bg-surface text-body-sm">
                <option value="cash">নগদ</option>
                <option value="bank">ব্যাংক</option>
                <option value="bkash">বিকাশ</option>
                <option value="nagad">নগদ</option>
                <option value="rocket">রকেট</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowReturn(false)}>বাতিল</Button>
            <Button onClick={handleReturn} loading={returnMut.isPending}>ফেরত সম্পন্ন করুন</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
