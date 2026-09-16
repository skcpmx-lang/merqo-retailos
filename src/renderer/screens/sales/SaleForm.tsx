import React, { useState, useMemo } from 'react';
import { useCustomers } from '../../hooks/useCustomers';
import { useProductSearch, useUnits, useCreateSale, useFinanceAccounts } from '../../hooks/useSales';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Search, Plus, Trash2, ArrowLeft } from 'lucide-react';

interface Props {
  businessId: string;
  onBack: () => void;
  onSuccess: (id: string) => void;
}

interface CartItem {
  productId: string;
  productName: string;
  sku: string;
  unitId: string;
  unitName: string;
  quantityMilli: number;
  quantity: number;
  unitPricePaisa: number;
  unitPrice: number;
  baseQuantityMilli?: number;
}

function formatPaisa(paisa: number): string {
  return `৳ ${(paisa / 100).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const SaleForm: React.FC<Props> = ({ businessId, onBack, onSuccess }) => {
  const [customerId, setCustomerId] = useState('');
  const [productQuery, setProductQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [qty, setQty] = useState('1');
  const [unitId, setUnitId] = useState('');
  const [price, setPrice] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  const [discount, setDiscount] = useState('0');
  const [tax, setTax] = useState('0');
  const [shipping, setShipping] = useState('0');
  const [paid, setPaid] = useState('0');
  const [notes, setNotes] = useState('');

  const [showSplit, setShowSplit] = useState(false);
  const [splitPayments, setSplitPayments] = useState<{ method: string; amount: string; cashAccountId?: string; bankAccountId?: string; mfsAccountId?: string }[]>([]);

  const { data: customers } = useCustomers(businessId);
  const { data: products } = useProductSearch(businessId, productQuery);
  const { data: units } = useUnits(businessId);
  const { cashQuery, bankQuery, mfsQuery } = useFinanceAccounts(businessId);
  const createMut = useCreateSale();

  const unitMap = useMemo(() => {
    const m: Record<string, string> = {};
    (units || []).forEach((u: any) => (m[u.id] = u.shortName || u.name));
    return m;
  }, [units]);

  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity * item.unitPricePaisa, 0);
  }, [cart]);

  const total = useMemo(() => {
    const d = parseFloat(discount) || 0;
    const t = parseFloat(tax) || 0;
    const s = parseFloat(shipping) || 0;
    return subtotal - Math.round(d * 100) + Math.round(t * 100) + Math.round(s * 100);
  }, [subtotal, discount, tax, shipping]);

  const paidPaisa = useMemo(() => Math.round((parseFloat(paid) || 0) * 100), [paid]);
  const duePaisa = total - paidPaisa;

  const handleSelectProduct = (p: any) => {
    setSelectedProduct(p);
    setProductQuery('');
    setUnitId(p.saleUnitId || p.baseUnitId);
    setPrice((p.sellingPricePaisa / 100).toString());
    setQty('1');
  };

  const handleAddToCart = () => {
    if (!selectedProduct) return;
    const q = parseFloat(qty);
    if (!q || q <= 0) {
      alert('পরিমাণ ০ এর বেশি হতে হবে');
      return;
    }
    const pr = parseFloat(price);
    if (isNaN(pr) || pr < 0) {
      alert('সঠিক মূল্য দিন');
      return;
    }

    const quantityMilli = Math.round(q * 1000);

    const existingIdx = cart.findIndex(c => c.productId === selectedProduct.id && c.unitId === unitId);
    if (existingIdx >= 0) {
      const newCart = [...cart];
      newCart[existingIdx] = {
        ...newCart[existingIdx],
        quantity: newCart[existingIdx].quantity + q,
        quantityMilli: newCart[existingIdx].quantityMilli + quantityMilli,
        unitPrice: pr,
        unitPricePaisa: Math.round(pr * 100),
      };
      setCart(newCart);
    } else {
      setCart([
        ...cart,
        {
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          sku: selectedProduct.sku,
          unitId: unitId || selectedProduct.baseUnitId,
          unitName: unitMap[unitId] || unitId,
          quantity: q,
          quantityMilli,
          unitPrice: pr,
          unitPricePaisa: Math.round(pr * 100),
        },
      ]);
    }

    setSelectedProduct(null);
    setQty('1');
    setPrice('');
    setUnitId('');
  };

  const handleSubmit = async () => {
    if (!cart.length) {
      alert('কমপক্ষে একটি পণ্য যোগ করুন');
      return;
    }
    if (duePaisa > 0 && !customerId) {
      alert('বাকি বিক্রয়ের জন্য গ্রাহক নির্বাচন করুন');
      return;
    }

    const items = cart.map(c => ({
      productId: c.productId,
      unitId: c.unitId,
      quantityMilli: c.quantityMilli,
      unitPricePaisa: c.unitPricePaisa,
    }));

    const payments = showSplit
      ? splitPayments.map(sp => ({
          method: sp.method,
          amountPaisa: Math.round((parseFloat(sp.amount) || 0) * 100),
          cashAccountId: sp.cashAccountId || undefined,
          bankAccountId: sp.bankAccountId || undefined,
          mfsAccountId: sp.mfsAccountId || undefined,
        }))
      : [];

    if (showSplit) {
      const sum = payments.reduce((s, p) => s + p.amountPaisa, 0);
      if (sum !== paidPaisa) {
        alert('পেমেন্ট যোগফল পরিশোধিত টাকার সমান হতে হবে');
        return;
      }
    }

    try {
      const res = await createMut.mutateAsync({
        businessId,
        customerId: customerId || null,
        items,
        discountPaisa: Math.round((parseFloat(discount) || 0) * 100),
        taxPaisa: Math.round((parseFloat(tax) || 0) * 100),
        shippingPaisa: Math.round((parseFloat(shipping) || 0) * 100),
        paidPaisa,
        payments: payments.length > 0 ? payments : undefined,
        notes,
      });
      onSuccess(res.id);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const addSplitPayment = () => {
    setSplitPayments([...splitPayments, { method: 'cash', amount: '' }]);
  };

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft size={18} /></Button>
        <div>
          <h1 className="text-h1 text-text-primary">নতুন বিক্রয়</h1>
          <p className="text-body-sm text-text-secondary">গ্রাহক, পণ্য, পরিমাণ ও পেমেন্ট যোগ করুন</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2">
          <CardHeader><CardTitle className="text-body">পণ্য যোগ করুন</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-label mb-1 block">গ্রাহক</label>
              <select value={customerId} onChange={e => setCustomerId(e.target.value)} className="w-full h-9 px-3 rounded-sm border border-border bg-surface text-body-sm">
                <option value="">ওয়াক-ইন গ্রাহক (নগদ)</option>
                {(customers || []).map((c: any) => <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>)}
              </select>
              <p className="text-caption text-text-tertiary mt-1">বাকি বিক্রয়ের জন্য গ্রাহক আবশ্যক</p>
            </div>

            <div className="relative">
              <label className="text-label mb-1 block">পণ্য খুঁজুন (বারকোড/SKU/নাম)</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                <Input value={productQuery} onChange={e => setProductQuery(e.target.value)} placeholder="অন্তত ২ অক্ষর লিখুন..." className="pl-9" autoFocus />
              </div>
              {products && products.length > 0 && productQuery.length >= 2 && (
                <div className="absolute z-10 w-full mt-1 bg-surface border border-border rounded-sm shadow-md max-h-[200px] overflow-auto">
                  {products.map((p: any) => (
                    <button key={p.id} onClick={() => handleSelectProduct(p)} className="w-full text-left px-3 py-2 hover:bg-subtle flex items-center justify-between">
                      <div>
                        <p className="text-body-sm font-medium">{p.name}</p>
                        <p className="text-caption text-text-tertiary">{p.sku} {p.barcode ? `• ${p.barcode}` : ''}</p>
                      </div>
                      <span className="text-body-sm font-mono">{formatPaisa(p.sellingPricePaisa)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedProduct && (
              <div className="bg-subtle p-3 rounded-sm border border-border space-y-3">
                <p className="text-body-sm font-medium">{selectedProduct.name} — {selectedProduct.sku}</p>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="text-caption block mb-1">পরিমাণ</label>
                    <Input type="number" step="0.001" value={qty} onChange={e => setQty(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-caption block mb-1">ইউনিট</label>
                    <select value={unitId} onChange={e => setUnitId(e.target.value)} className="w-full h-9 px-2 rounded-sm border border-border bg-surface text-body-sm">
                      {(units || []).map((u: any) => <option key={u.id} value={u.id}>{u.shortName || u.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-caption block mb-1">দাম (৳)</label>
                    <Input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={handleAddToCart} size="sm" className="w-full"><Plus size={14} className="mr-1" /> যোগ</Button>
                  </div>
                </div>
              </div>
            )}

            <div className="border-t border-border pt-3">
              <h3 className="text-label mb-2">কার্ট ({cart.length} টি পণ্য)</h3>
              {cart.length === 0 ? (
                <p className="text-body-sm text-text-tertiary py-4 text-center">কোন পণ্য যোগ করা হয়নি</p>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full">
                    <thead className="bg-subtle border-y border-border">
                      <tr>
                        <th className="text-left text-caption font-medium px-3 py-2">পণ্য</th>
                        <th className="text-right text-caption font-medium px-3 py-2">পরিমাণ</th>
                        <th className="text-right text-caption font-medium px-3 py-2">দাম</th>
                        <th className="text-right text-caption font-medium px-3 py-2">মোট</th>
                        <th className="text-right text-caption font-medium px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {cart.map((item, idx) => (
                        <tr key={idx} className="border-b border-border">
                          <td className="px-3 py-2 text-body-sm">{item.productName} <span className="text-caption text-text-tertiary">({item.sku})</span></td>
                          <td className="px-3 py-2 text-right font-mono text-body-sm">{item.quantity} {item.unitName}</td>
                          <td className="px-3 py-2 text-right font-mono text-body-sm">{formatPaisa(item.unitPricePaisa)}</td>
                          <td className="px-3 py-2 text-right font-mono text-body-sm font-medium">{formatPaisa(item.quantity * item.unitPricePaisa)}</td>
                          <td className="px-3 py-2 text-right"><Button variant="ghost" size="icon" onClick={() => setCart(cart.filter((_, i) => i !== idx))}><Trash2 size={14} /></Button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-body">হিসাব</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-body-sm"><span>সাবটোটাল</span><span className="font-mono">{formatPaisa(subtotal)}</span></div>
              <div className="grid grid-cols-3 gap-2">
                <div><label className="text-caption block mb-1">ছাড় (৳)</label><Input type="number" step="0.01" value={discount} onChange={e => setDiscount(e.target.value)} /></div>
                <div><label className="text-caption block mb-1">ট্যাক্স (৳)</label><Input type="number" step="0.01" value={tax} onChange={e => setTax(e.target.value)} /></div>
                <div><label className="text-caption block mb-1">শিপিং (৳)</label><Input type="number" step="0.01" value={shipping} onChange={e => setShipping(e.target.value)} /></div>
              </div>
              <div className="flex justify-between text-body font-medium border-t pt-2"><span>মোট</span><span className="font-mono">{formatPaisa(total)}</span></div>
              <div>
                <label className="text-label block mb-1">পরিশোধিত (৳)</label>
                <Input type="number" step="0.01" value={paid} onChange={e => setPaid(e.target.value)} />
              </div>
              <div className={`flex justify-between text-body-sm p-2 rounded ${duePaisa > 0 ? 'bg-danger-50 text-danger-600' : 'bg-success-50 text-success-600'}`}>
                <span>{duePaisa > 0 ? 'বাকি' : 'পরিশোধিত'}</span>
                <span className="font-mono font-medium">{formatPaisa(duePaisa > 0 ? duePaisa : 0)}</span>
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" checked={showSplit} onChange={e => setShowSplit(e.target.checked)} />
                <span className="text-body-sm">ভাগ করা পেমেন্ট</span>
              </div>

              {showSplit && (
                <div className="space-y-2 border-t pt-2">
                  {splitPayments.map((sp, idx) => (
                    <div key={idx} className="grid grid-cols-5 gap-2 items-end bg-subtle p-2 rounded">
                      <div className="col-span-2">
                        <label className="text-caption block mb-1">পদ্ধতি</label>
                        <select value={sp.method} onChange={e => {
                          const newArr = [...splitPayments];
                          newArr[idx] = { ...newArr[idx], method: e.target.value };
                          setSplitPayments(newArr);
                        }} className="w-full h-8 px-2 rounded-sm border border-border bg-surface text-caption">
                          <option value="cash">নগদ</option>
                          <option value="bank">ব্যাংক</option>
                          <option value="card">কার্ড</option>
                          <option value="bkash">বিকাশ</option>
                          <option value="nagad">নগদ</option>
                          <option value="rocket">রকেট</option>
                          <option value="upay">উপায়</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="text-caption block mb-1">টাকা</label>
                        <Input type="number" step="0.01" value={sp.amount} onChange={e => {
                          const newArr = [...splitPayments];
                          newArr[idx] = { ...newArr[idx], amount: e.target.value };
                          setSplitPayments(newArr);
                        }} className="h-8" />
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => setSplitPayments(splitPayments.filter((_, i) => i !== idx))}><Trash2 size={14} /></Button>
                      {sp.method === 'cash' && (
                        <div className="col-span-5">
                          <select value={sp.cashAccountId || ''} onChange={e => {
                            const newArr = [...splitPayments];
                            newArr[idx] = { ...newArr[idx], cashAccountId: e.target.value };
                            setSplitPayments(newArr);
                          }} className="w-full h-8 px-2 rounded-sm border border-border bg-surface text-caption">
                            <option value="">ক্যাশ অ্যাকাউন্ট নির্বাচন</option>
                            {(cashQuery.data || []).map((ca: any) => <option key={ca.id} value={ca.id}>{ca.name}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                  ))}
                  <Button variant="secondary" size="sm" onClick={addSplitPayment}><Plus size={14} className="mr-1" /> পেমেন্ট যোগ</Button>
                </div>
              )}

              <div>
                <label className="text-label block mb-1">নোট</label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="অতিরিক্ত তথ্য" />
              </div>

              <Button onClick={handleSubmit} loading={createMut.isPending} className="w-full mt-2">বিক্রয় সম্পন্ন করুন</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
