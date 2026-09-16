import React, { useState, useEffect, useMemo } from 'react';
import { useSuppliers } from '../../hooks/useSuppliers';
import { useProductSearch, useUnits, useUnitConversions, useCreatePurchase } from '../../hooks/usePurchases';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { ArrowLeft, Plus, Trash2, Search, Barcode } from 'lucide-react';

function formatPaisa(paisa: number): string {
  return `৳ ${(paisa / 100).toLocaleString('en-BD', { minimumFractionDigits: 2 })}`;
}

interface CartItem {
  productId: string;
  productName: string;
  sku: string;
  baseUnitId: string;
  unitId: string;
  unitName: string;
  quantityMilli: number;
  quantityDisplay: number;
  costPerUnitPaisa: number;
  costDisplay: number;
  lineTotalPaisa: number;
}

export const PurchaseForm: React.FC<{ businessId: string; onBack: () => void; onSuccess: (id: string) => void }> = ({ businessId, onBack, onSuccess }) => {
  const [supplierId, setSupplierId] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [qty, setQty] = useState('1');
  const [unitId, setUnitId] = useState('');
  const [cost, setCost] = useState('');
  const [discount, setDiscount] = useState('0');
  const [tax, setTax] = useState('0');
  const [shipping, setShipping] = useState('0');
  const [paid, setPaid] = useState('0');
  const [notes, setNotes] = useState('');
  const [payments, setPayments] = useState<{ method: string; amount: string }[]>([{ method: 'cash', amount: '' }]);
  const [showSplit, setShowSplit] = useState(false);

  const { data: suppliers } = useSuppliers(businessId);
  const { data: searchResults } = useProductSearch(businessId, searchQuery);
  const { data: units } = useUnits(businessId);
  const { data: conversions } = useUnitConversions(businessId);
  const createMut = useCreatePurchase();

  const unitMap = useMemo(() => {
    const m: Record<string, any> = {};
    (units || []).forEach((u: any) => (m[u.id] = u));
    return m;
  }, [units]);

  useEffect(() => {
    if (selectedProduct && !unitId) {
      setUnitId(selectedProduct.baseUnitId || selectedProduct.purchaseUnitId || '');
    }
  }, [selectedProduct]);

  const handleAddToCart = () => {
    if (!selectedProduct) return;
    const qtyNum = parseFloat(qty);
    const costNum = parseFloat(cost);
    if (!qtyNum || qtyNum <= 0) {
      alert('পরিমাণ সঠিক নয়');
      return;
    }
    if (isNaN(costNum) || costNum < 0) {
      alert('ক্রয় মূল্য সঠিক নয়');
      return;
    }

    const quantityMilli = Math.round(qtyNum * 1000);
    const costPerUnitPaisa = Math.round(costNum * 100);
    const lineTotal = Math.round(qtyNum * costPerUnitPaisa);

    const unitName = unitMap[unitId]?.name || unitMap[selectedProduct.baseUnitId]?.name || 'Pcs';

    const item: CartItem = {
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      sku: selectedProduct.sku,
      baseUnitId: selectedProduct.baseUnitId,
      unitId: unitId || selectedProduct.baseUnitId,
      unitName,
      quantityMilli,
      quantityDisplay: qtyNum,
      costPerUnitPaisa,
      costDisplay: costNum,
      lineTotalPaisa: lineTotal,
    };

    setCart([...cart, item]);
    setSelectedProduct(null);
    setSearchQuery('');
    setQty('1');
    setCost('');
    setUnitId('');
  };

  const removeFromCart = (idx: number) => {
    setCart(cart.filter((_, i) => i !== idx));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.lineTotalPaisa, 0);
  const discountPaisa = Math.round(parseFloat(discount || '0') * 100);
  const taxPaisa = Math.round(parseFloat(tax || '0') * 100);
  const shippingPaisa = Math.round(parseFloat(shipping || '0') * 100);
  const total = subtotal - discountPaisa + taxPaisa + shippingPaisa;

  const paidPaisa = showSplit
    ? payments.reduce((sum, p) => sum + Math.round(parseFloat(p.amount || '0') * 100), 0)
    : Math.round(parseFloat(paid || '0') * 100);

  const due = total - paidPaisa;

  const handleSubmit = async () => {
    if (!supplierId) {
      alert('সাপ্লায়ার নির্বাচন করুন');
      return;
    }
    if (cart.length === 0) {
      alert('কমপক্ষে একটি পণ্য যোগ করুন');
      return;
    }
    if (paidPaisa > total) {
      alert('পরিশোধ মোটের চেয়ে বেশি হতে পারে না');
      return;
    }

    const items = cart.map(c => ({
      productId: c.productId,
      unitId: c.unitId,
      quantityMilli: c.quantityMilli,
      costPerUnitPaisa: c.costPerUnitPaisa,
      discountPaisa: 0,
      taxPaisa: 0,
    }));

    const payload: any = {
      businessId,
      supplierId,
      items,
      discountPaisa,
      taxPaisa,
      shippingPaisa,
      paidPaisa,
      notes,
    };

    if (showSplit) {
      payload.payments = payments
        .filter(p => parseFloat(p.amount) > 0)
        .map(p => ({ method: p.method, amountPaisa: Math.round(parseFloat(p.amount) * 100) }));
      payload.paidPaisa = payload.payments.reduce((s: number, p: any) => s + p.amountPaisa, 0);
    }

    try {
      const result = await createMut.mutateAsync(payload);
      onSuccess(result.id);
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft size={18} /></Button>
        <div>
          <h1 className="text-h1 text-text-primary">নতুন ক্রয়</h1>
          <p className="text-body-sm text-text-secondary">সাপ্লায়ার থেকে পণ্য গ্রহণ ও বকেয়া হিসাব</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2">
          <CardHeader className="pb-3"><CardTitle className="text-body">সাপ্লায়ার নির্বাচন</CardTitle></CardHeader>
          <CardContent>
            <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className="w-full h-10 px-3 rounded-sm border border-border bg-surface text-body">
              <option value="">সাপ্লায়ার নির্বাচন করুন</option>
              {(suppliers || []).filter((s: any) => s.isActive).map((s: any) => <option key={s.id} value={s.id}>{s.name} {s.phone ? `— ${s.phone}` : ''}</option>)}
            </select>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-body">ক্রয় সারাংশ</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-body-sm">
            <div className="flex justify-between"><span>উপমোট</span><span className="font-mono">{formatPaisa(subtotal)}</span></div>
            <div className="flex justify-between"><span>ডিসকাউন্ট</span><span className="font-mono">- {formatPaisa(discountPaisa)}</span></div>
            <div className="flex justify-between"><span>ট্যাক্স</span><span className="font-mono">+ {formatPaisa(taxPaisa)}</span></div>
            <div className="flex justify-between"><span>শিপিং</span><span className="font-mono">+ {formatPaisa(shippingPaisa)}</span></div>
            <div className="flex justify-between font-semibold border-t pt-2"><span>মোট</span><span className="font-mono">{formatPaisa(total)}</span></div>
            <div className="flex justify-between text-success-600"><span>পরিশোধ</span><span className="font-mono">{formatPaisa(paidPaisa)}</span></div>
            <div className="flex justify-between font-semibold text-danger-600"><span>বকেয়া</span><span className="font-mono">{formatPaisa(due)}</span></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2"><Barcode size={18} /> পণ্য যোগ করুন</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
              <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="পণ্য নাম, SKU, বারকোড দিয়ে খুঁজুন... (কমপক্ষে ২ অক্ষর)" className="pl-9" autoFocus />
              {searchResults && searchResults.length > 0 && !selectedProduct && (
                <div className="absolute z-10 mt-1 w-full bg-surface border border-border rounded-sm shadow-md max-h-60 overflow-auto">
                  {searchResults.map((p: any) => (
                    <button key={p.id} onClick={() => { setSelectedProduct(p); setSearchQuery(p.name); setCost((p.costPricePaisa / 100).toString()); }} className="w-full text-left px-3 py-2 hover:bg-subtle border-b last:border-0 border-border">
                      <p className="text-body-sm font-medium">{p.name}</p>
                      <p className="text-caption text-text-tertiary">SKU: {p.sku} | মূল্য: {formatPaisa(p.sellingPricePaisa)} | ক্রয়: {formatPaisa(p.costPricePaisa)}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {selectedProduct && (
            <div className="grid grid-cols-5 gap-3 p-3 bg-subtle/50 rounded-sm border border-border">
              <div className="col-span-2">
                <p className="text-body-sm font-medium">{selectedProduct.name}</p>
                <p className="text-caption text-text-tertiary">SKU: {selectedProduct.sku}</p>
              </div>
              <div>
                <label className="text-caption block mb-1">পরিমাণ *</label>
                <Input type="number" step="0.001" value={qty} onChange={e => setQty(e.target.value)} placeholder="1" />
              </div>
              <div>
                <label className="text-caption block mb-1">ইউনিট</label>
                <select value={unitId} onChange={e => setUnitId(e.target.value)} className="w-full h-9 px-2 rounded-sm border border-border bg-surface text-body-sm">
                  {(units || []).map((u: any) => <option key={u.id} value={u.id}>{u.name} {u.shortName ? `(${u.shortName})` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="text-caption block mb-1">ক্রয় মূল্য (প্রতি ইউনিট) *</label>
                <Input type="number" step="0.01" value={cost} onChange={e => setCost(e.target.value)} placeholder="0.00" />
              </div>
              <div className="col-span-5 flex justify-end">
                <Button size="sm" onClick={handleAddToCart}><Plus size={14} className="mr-1" /> কার্টে যোগ করুন</Button>
              </div>
            </div>
          )}

          {cart.length > 0 && (
            <div className="overflow-auto">
              <table className="w-full">
                <thead className="bg-subtle border-y border-border">
                  <tr>
                    <th className="text-left text-caption font-medium px-3 py-2">পণ্য</th>
                    <th className="text-right text-caption font-medium px-3 py-2">পরিমাণ</th>
                    <th className="text-left text-caption font-medium px-3 py-2">ইউনিট</th>
                    <th className="text-right text-caption font-medium px-3 py-2">দর</th>
                    <th className="text-right text-caption font-medium px-3 py-2">মোট</th>
                    <th className="text-right text-caption font-medium px-3 py-2">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item, idx) => (
                    <tr key={idx} className="border-b border-border">
                      <td className="px-3 py-2 text-body-sm"><span className="font-medium">{item.productName}</span><span className="text-caption text-text-tertiary ml-2">{item.sku}</span></td>
                      <td className="px-3 py-2 text-right font-mono text-body-sm">{item.quantityDisplay}</td>
                      <td className="px-3 py-2 text-body-sm">{item.unitName}</td>
                      <td className="px-3 py-2 text-right font-mono text-body-sm">{formatPaisa(item.costPerUnitPaisa)}</td>
                      <td className="px-3 py-2 text-right font-mono text-body-sm font-medium">{formatPaisa(item.lineTotalPaisa)}</td>
                      <td className="px-3 py-2 text-right"><Button variant="ghost" size="icon" onClick={() => removeFromCart(idx)}><Trash2 size={14} /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-body">অতিরিক্ত খরচ</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-3 gap-3">
            <div><label className="text-caption block mb-1">ডিসকাউন্ট (৳)</label><Input type="number" step="0.01" value={discount} onChange={e => setDiscount(e.target.value)} /></div>
            <div><label className="text-caption block mb-1">ট্যাক্স (৳)</label><Input type="number" step="0.01" value={tax} onChange={e => setTax(e.target.value)} /></div>
            <div><label className="text-caption block mb-1">শিপিং (৳)</label><Input type="number" step="0.01" value={shipping} onChange={e => setShipping(e.target.value)} /></div>
            <div className="col-span-3"><label className="text-caption block mb-1">নোট</label><Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="ক্রয় সংক্রান্ত নোট" /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-body">পেমেন্ট</CardTitle>
              <label className="flex items-center gap-1 text-caption"><input type="checkbox" checked={showSplit} onChange={e => setShowSplit(e.target.checked)} /> স্প্লিট পেমেন্ট</label>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {!showSplit ? (
              <div>
                <label className="text-caption block mb-1">পরিশোধিত (৳)</label>
                <Input type="number" step="0.01" value={paid} onChange={e => setPaid(e.target.value)} placeholder="0.00" />
                <p className="text-caption text-text-tertiary mt-1">বকেয়া: {formatPaisa(due)}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {payments.map((p, idx) => (
                  <div key={idx} className="flex gap-2">
                    <select value={p.method} onChange={e => { const newP = [...payments]; newP[idx].method = e.target.value; setPayments(newP); }} className="h-9 px-2 rounded-sm border border-border bg-surface text-body-sm w-32">
                      <option value="cash">নগদ</option>
                      <option value="bank">ব্যাংক</option>
                      <option value="card">কার্ড</option>
                      <option value="cheque">চেক</option>
                      <option value="bkash">বিকাশ</option>
                      <option value="nagad">নগদ</option>
                      <option value="rocket">রকেট</option>
                      <option value="upay">উপায়</option>
                    </select>
                    <Input type="number" step="0.01" value={p.amount} onChange={e => { const newP = [...payments]; newP[idx].amount = e.target.value; setPayments(newP); }} placeholder="0.00" className="flex-1" />
                    <Button variant="ghost" size="icon" onClick={() => setPayments(payments.filter((_, i) => i !== idx))}><Trash2 size={14} /></Button>
                  </div>
                ))}
                <Button variant="secondary" size="sm" onClick={() => setPayments([...payments, { method: 'cash', amount: '' }])}><Plus size={14} className="mr-1" /> পেমেন্ট যোগ করুন</Button>
                <p className="text-caption">মোট পরিশোধ: {formatPaisa(paidPaisa)} | বকেয়া: {formatPaisa(due)}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onBack}>বাতিল</Button>
        <Button onClick={handleSubmit} loading={createMut.isPending}>ক্রয় সংরক্ষণ করুন</Button>
      </div>
    </div>
  );
};
