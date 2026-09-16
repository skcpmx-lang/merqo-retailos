import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { usePOSProductSearch, useHeldSales, useHoldSale, useHeldSaleResume, useHeldSaleCancel, useCurrentShift } from '../../hooks/usePOS';
import { useCustomers, useCustomerSearch } from '../../hooks/useCustomers';
import { useCreateSale, useUnits, useUnitConversions, useFinanceAccounts } from '../../hooks/useSales';
import { useBarcodeInput, useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { useConfiguredPrinter, usePrintReceipt, useScannerConfig } from '../../hooks/useHardware';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { POSCartItem, calculateCartTotals, formatPaisa } from '../../components/pos/POSCartTypes';
import { Search, ShoppingCart, Trash2, Plus, Minus, Pause, Play, CreditCard, User, HelpCircle, X, AlertTriangle, CheckCircle, Printer } from 'lucide-react';

function generateCartItemId() {
  return `cart_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const POSScreen: React.FC<{ businessId: string }> = ({ businessId }) => {
  const [cartItems, setCartItems] = useState<POSCartItem[]>([]);
  const [discount, setDiscount] = useState('0');
  const [tax, setTax] = useState('0');
  const [customerId, setCustomerId] = useState<string>('');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [selectedCartIndex, setSelectedCartIndex] = useState<number>(-1);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payments, setPayments] = useState<{ method: string; amount: string; cashAccountId?: string; bankAccountId?: string; mfsAccountId?: string }[]>([
    { method: 'cash', amount: '' },
  ]);
  const [showHeldModal, setShowHeldModal] = useState(false);
  const [showSuccess, setShowSuccess] = useState<{ saleId: string; saleNumber: string; total: number; paid: number; change: number; due: number } | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [quickCustomer, setQuickCustomer] = useState({ name: '', phone: '' });

  const [errorMsg, setErrorMsg] = useState<string>('');
  const [printStatus, setPrintStatus] = useState<string>('');

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const productSearchInputRef = useRef<HTMLInputElement>(null);

  const { data: searchResults } = usePOSProductSearch(businessId, productSearchQuery, 20);
  const { data: heldSales } = useHeldSales(businessId);
  const { data: customers } = useCustomers(businessId);
  const { data: customerSearchResults } = useCustomerSearch(businessId, customerSearchQuery);
  const { data: units } = useUnits(businessId);
  const { data: conversions } = useUnitConversions(businessId);
  const { cashQuery } = useFinanceAccounts(businessId);
  const { data: currentShift } = useCurrentShift(businessId);
  const { data: configuredPrinter } = useConfiguredPrinter();
  const { data: scannerConfig } = useScannerConfig();
  const createSaleMut = useCreateSale();
  const holdSaleMut = useHoldSale();
  const resumeHeldMut = useHeldSaleResume();
  const cancelHeldMut = useHeldSaleCancel();
  const printReceiptMut = usePrintReceipt();

  const unitMap = useMemo(() => {
    const m: Record<string, { name: string; shortName: string }> = {};
    (units || []).forEach((u: any) => (m[u.id] = { name: u.name, shortName: u.shortName || u.name }));
    return m;
  }, [units]);

  const totals = useMemo(() => {
    const discountPaisa = Math.round((parseFloat(discount) || 0) * 100);
    const taxPaisa = Math.round((parseFloat(tax) || 0) * 100);
    return calculateCartTotals(cartItems, discountPaisa, taxPaisa, 0);
  }, [cartItems, discount, tax]);

  const paidPaisa = useMemo(() => {
    return payments.reduce((sum, p) => sum + Math.round((parseFloat(p.amount) || 0) * 100), 0);
  }, [payments]);

  const duePaisa = totals.totalPaisa - paidPaisa;
  const changePaisa = paidPaisa > totals.totalPaisa ? paidPaisa - totals.totalPaisa : 0;

  const addProductToCart = useCallback(
    (product: any, barcodeDetail: any, stockMilli: number) => {
      if (!product.isActive) {
        setErrorMsg('এই পণ্যটি বিক্রয়ের জন্য সক্রিয় নয়।');
        return;
      }
      if (!product.isSellable) {
        setErrorMsg('এই পণ্যটি বিক্রয়যোগ্য নয়।');
        return;
      }

      const stock = stockMilli / 1000;
      if (product.isStockTrackable && stock <= 0) {
        setErrorMsg('এই পণ্যের পর্যাপ্ত মজুত নেই।');
        return;
      }

      const unitId = barcodeDetail?.unitId || product.saleUnitId || product.baseUnitId;
      const unitInfo = unitMap[unitId] || { name: unitId, shortName: unitId };
      const qtyFromBarcode = barcodeDetail?.quantityMilli ? barcodeDetail.quantityMilli / 1000 : 1;

      const existingIdx = cartItems.findIndex(item => item.productId === product.id && item.unitId === unitId);
      if (existingIdx >= 0) {
        const newItems = [...cartItems];
        const existing = newItems[existingIdx];
        const newQty = existing.quantity + qtyFromBarcode;
        if (product.isStockTrackable) {
          const baseQty = calculateBaseQty(newQty, unitId, product.baseUnitId, conversions);
          if (baseQty > stockMilli) {
            setErrorMsg(`এই পণ্যের পর্যাপ্ত মজুত নেই। বর্তমান: ${stock}, প্রয়োজন: ${newQty}`);
            return;
          }
        }
        newItems[existingIdx] = {
          ...existing,
          quantity: newQty,
          quantityMilli: Math.round(newQty * 1000),
          lineTotalPaisa: Math.round(newQty * existing.unitPricePaisa) - existing.discountPaisa,
        };
        setCartItems(newItems);
        setErrorMsg('');
        return;
      }

      const quantity = qtyFromBarcode;
      const quantityMilli = Math.round(quantity * 1000);

      if (product.isStockTrackable) {
        const baseQty = calculateBaseQty(quantity, unitId, product.baseUnitId, conversions);
        if (baseQty > stockMilli) {
          setErrorMsg(`এই পণ্যের পর্যাপ্ত মজুত নেই। বর্তমান: ${stock}, প্রয়োজন: ${quantity}`);
          return;
        }
      }

      const newItem: POSCartItem = {
        id: generateCartItemId(),
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        barcode: product.barcode,
        unitId,
        unitName: unitInfo.name,
        unitShortName: unitInfo.shortName,
        quantity,
        quantityMilli,
        unitPricePaisa: product.sellingPricePaisa,
        discountPaisa: 0,
        lineTotalPaisa: Math.round(quantity * product.sellingPricePaisa),
        stockMilli,
        isLowStock: product.isStockTrackable && stock < (product.reorderLevelMilli / 1000 || 5),
        isOutOfStock: product.isStockTrackable && stock <= 0,
        barcodeDetail,
      };

      setCartItems([...cartItems, newItem]);
      setErrorMsg('');
      setProductSearchQuery('');
      barcodeInput.setValue('');
    },
    [cartItems, unitMap, conversions]
  );

  const calculateBaseQty = (qty: number, fromUnitId: string, baseUnitId: string, convs: any): number => {
    if (fromUnitId === baseUnitId) return Math.round(qty * 1000);
    if (!convs) return Math.round(qty * 1000);
    const conv = convs.find((c: any) => c.fromUnitId === fromUnitId && c.toUnitId === baseUnitId);
    if (conv) return Math.round(qty * conv.conversionFactor * 1000);
    const reverse = convs.find((c: any) => c.fromUnitId === baseUnitId && c.toUnitId === fromUnitId);
    if (reverse && reverse.conversionFactor !== 0) return Math.round((qty / reverse.conversionFactor) * 1000);
    return Math.round(qty * 1000);
  };

  const handleBarcodeScan = useCallback(
    async (barcode: string) => {
      try {
        const res = await (window as any).merqo.pos.productByBarcode({ businessId, barcode });
        const data = res.success === false ? [] : res.data || res;
        if (!data || data.length === 0) {
          setErrorMsg(`এই বারকোডের কোনো পণ্য পাওয়া যায়নি। বারকোড: ${barcode}`);
          return;
        }
        if (data.length > 1) {
          setErrorMsg(`একাধিক পণ্য একই বারকোডে পাওয়া গেছে, প্রথমটি যোগ করা হলো`);
        }
        const first = data[0];
        if (!first.product.isActive) {
          setErrorMsg('এই পণ্যটি বিক্রয়ের জন্য সক্রিয় নয়।');
          return;
        }
        if (!first.product.isSellable) {
          setErrorMsg('এই পণ্যটি বিক্রয়যোগ্য নয়।');
          return;
        }
        addProductToCart(first.product, first.barcodeDetail, first.stockMilli);
      } catch (e: any) {
        const msg = e.message || '';
        if (msg.includes('পাওয়া যায়নি') || msg.includes('not found') || msg.includes('NOT_FOUND')) {
          setErrorMsg(`এই বারকোডের কোনো পণ্য পাওয়া যায়নি।`);
        } else {
          setErrorMsg(msg || 'বারকোড স্ক্যান করা যায়নি। আবার চেষ্টা করুন।');
        }
      }
    },
    [businessId, addProductToCart]
  );

  const barcodeInput = useBarcodeInput(handleBarcodeScan);

  useBarcodeScanner({
    onScan: handleBarcodeScan,
    enabled: true,
    minLength: scannerConfig?.minLength || 3,
    maxLength: scannerConfig?.maxLength || 64,
    scanTimeoutMs: scannerConfig?.scanTimeoutMs || 150,
    charThresholdMs: scannerConfig?.charThresholdMs || 50,
    suffix: (scannerConfig?.suffix as any) || 'Enter',
    prefix: scannerConfig?.prefix || '',
  });

  useEffect(() => {
    barcodeInput.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = (e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA' || (e.target as HTMLElement).tagName === 'SELECT';
      if (e.key === 'F1') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
        barcodeInputRef.current?.select();
      } else if (e.key === 'F2') {
        e.preventDefault();
        setShowCustomerModal(true);
      } else if (e.key === 'F3') {
        e.preventDefault();
        if (selectedCartIndex >= 0) {
          const el = document.querySelector(`[data-cart-index="${selectedCartIndex}"] input`) as HTMLInputElement;
          el?.focus();
          el?.select();
        }
      } else if (e.key === 'F5') {
        e.preventDefault();
        handleHoldSale();
      } else if (e.key === 'F6') {
        e.preventDefault();
        setShowHeldModal(true);
      } else if (e.key === 'F7') {
        e.preventDefault();
        if (cartItems.length > 0) setShowPaymentModal(true);
      } else if (e.key === 'F8' && showPaymentModal) {
        e.preventDefault();
        handleCompleteSale();
      } else if (e.key === 'F9') {
        e.preventDefault();
        handleClearCart();
      } else if (e.key === 'Delete' && selectedCartIndex >= 0 && !isInput) {
        e.preventDefault();
        handleRemoveItem(selectedCartIndex);
      } else if (e.key === 'Escape') {
        if (showPaymentModal) setShowPaymentModal(false);
        else if (showHeldModal) setShowHeldModal(false);
        else if (showHelp) setShowHelp(false);
        else if (showSuccess) setShowSuccess(null);
      } else if (e.key === '?' && e.shiftKey) {
        e.preventDefault();
        setShowHelp(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cartItems, selectedCartIndex, showPaymentModal, showHeldModal, showHelp, showSuccess]);

  const handleRemoveItem = (index: number) => {
    setCartItems(cartItems.filter((_, i) => i !== index));
    if (selectedCartIndex === index) setSelectedCartIndex(-1);
  };

  const handleQtyChange = (index: number, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(index);
      return;
    }
    const newItems = [...cartItems];
    const item = newItems[index];
    if (item.stockMilli > 0) {
      const stockQty = item.stockMilli / 1000;
      if (newQty > stockQty * 2) {
        setErrorMsg(`এই পণ্যের পর্যাপ্ত মজুত নেই। বর্তমান: ${stockQty}`);
        return;
      }
    }
    newItems[index] = {
      ...item,
      quantity: newQty,
      quantityMilli: Math.round(newQty * 1000),
      lineTotalPaisa: Math.round(newQty * item.unitPricePaisa) - item.discountPaisa,
    };
    setCartItems(newItems);
  };

  const handleClearCart = () => {
    if (cartItems.length === 0) return;
    if (confirm('কার্ট খালি করতে চান?')) {
      setCartItems([]);
      setDiscount('0');
      setTax('0');
      setCustomerId('');
      setPayments([{ method: 'cash', amount: '' }]);
      setErrorMsg('');
    }
  };

  const handleHoldSale = async () => {
    if (cartItems.length === 0) {
      setErrorMsg('হোল্ড করার জন্য কার্টে পণ্য থাকতে হবে');
      return;
    }
    try {
      const cart = {
        items: cartItems,
        subtotalPaisa: totals.subtotalPaisa,
        discountPaisa: totals.discountPaisa,
        taxPaisa: totals.taxPaisa,
        totalPaisa: totals.totalPaisa,
        customerId,
      };
      await holdSaleMut.mutateAsync({ businessId, customerId: customerId || null, cart, notes: '' });
      setCartItems([]);
      setDiscount('0');
      setTax('0');
      setCustomerId('');
      setErrorMsg('');
      alert('বিক্রয় হোল্ড করা হয়েছে');
    } catch (e: any) {
      setErrorMsg(e.message);
    }
  };

  const handleResumeHeld = async (id: string) => {
    try {
      const held = await resumeHeldMut.mutateAsync(id);
      if (held && held.cart) {
        setCartItems(held.cart.items || []);
        setCustomerId(held.customerId || held.cart.customerId || '');
        if (held.cart.discountPaisa) setDiscount((held.cart.discountPaisa / 100).toString());
        if (held.cart.taxPaisa) setTax((held.cart.taxPaisa / 100).toString());
        setShowHeldModal(false);
        setErrorMsg('');
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    }
  };

  const handlePrintReceipt = async (saleId: string) => {
    try {
      setPrintStatus('প্রিন্ট করা হচ্ছে...');
      const result = await printReceiptMut.mutateAsync({
        saleId,
        printerId: configuredPrinter?.selectedPrinterId || undefined,
        printerName: configuredPrinter?.selectedPrinterName || undefined,
        paperWidth: configuredPrinter?.paperWidth || '80mm',
        copies: configuredPrinter?.copies || 1,
      });
      if (result.success) {
        setPrintStatus(`প্রিন্ট সফল: ${result.printerName || 'ডিফল্ট প্রিন্টার'}`);
        setTimeout(() => setPrintStatus(''), 3000);
      } else {
        setPrintStatus(result.messageBn || 'প্রিন্ট ব্যর্থ, কিন্তু বিক্রয় সফল হয়েছে। আবার চেষ্টা করুন।');
      }
    } catch (e: any) {
      setPrintStatus(e.message || 'রসিদ প্রিন্ট করা যায়নি। প্রিন্টার পরীক্ষা করে আবার চেষ্টা করুন।');
    }
  };

  const handleCompleteSale = async () => {
    if (cartItems.length === 0) {
      setErrorMsg('কার্ট খালি');
      return;
    }
    if (duePaisa > 0 && !customerId) {
      setErrorMsg('বাকি বিক্রয়ের জন্য গ্রাহক নির্বাচন করুন।');
      return;
    }
    if (payments.some(p => p.amount && isNaN(parseFloat(p.amount)))) {
      setErrorMsg('পরিশোধের পরিমাণ সঠিক নয়।');
      return;
    }

    try {
      const items = cartItems.map(item => ({
        productId: item.productId,
        unitId: item.unitId,
        quantityMilli: item.quantityMilli,
        unitPricePaisa: item.unitPricePaisa,
        discountPaisa: item.discountPaisa,
      }));

      const paymentPayload = payments
        .filter(p => parseFloat(p.amount) > 0)
        .map(p => ({
          method: p.method,
          amountPaisa: Math.round((parseFloat(p.amount) || 0) * 100),
          cashAccountId: p.cashAccountId,
          bankAccountId: p.bankAccountId,
          mfsAccountId: p.mfsAccountId,
        }));

      const paid = paymentPayload.length > 0 ? paymentPayload.reduce((s, p) => s + p.amountPaisa, 0) : 0;

      const result = await createSaleMut.mutateAsync({
        businessId,
        customerId: customerId || null,
        items,
        discountPaisa: totals.discountPaisa,
        taxPaisa: totals.taxPaisa,
        shippingPaisa: 0,
        paidPaisa: paid > 0 ? paid : duePaisa === 0 ? totals.totalPaisa : paid,
        payments: paymentPayload.length > 0 ? paymentPayload : undefined,
        notes: `POS বিক্রয়`,
      });

      const change = paid > totals.totalPaisa ? paid - totals.totalPaisa : 0;
      const due = totals.totalPaisa > paid ? totals.totalPaisa - paid : 0;

      setShowSuccess({
        saleId: result.id,
        saleNumber: result.saleNumber,
        total: totals.totalPaisa,
        paid: paid,
        change,
        due,
      });
      setShowPaymentModal(false);
      setCartItems([]);
      setDiscount('0');
      setTax('0');
      setPayments([{ method: 'cash', amount: '' }]);
      setErrorMsg('');

      if (configuredPrinter?.autoPrintOnSale) {
        setTimeout(() => {
          handlePrintReceipt(result.id);
        }, 500);
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'বিক্রয় সম্পন্ন করা যায়নি। কোনো হিসাব বা মজুত পরিবর্তন করা হয়নি।');
    }
  };

  const addPaymentRow = () => {
    setPayments([...payments, { method: 'cash', amount: '' }]);
  };

  const updatePayment = (idx: number, field: string, value: string) => {
    const newPayments = [...payments];
    (newPayments[idx] as any)[field] = value;
    setPayments(newPayments);
  };

  const removePayment = (idx: number) => {
    if (payments.length === 1) return;
    setPayments(payments.filter((_, i) => i !== idx));
  };

  const handleQuickCustomerCreate = async () => {
    if (!quickCustomer.name.trim()) {
      setErrorMsg('গ্রাহকের নাম প্রয়োজন');
      return;
    }
    try {
      const res = await (window as any).merqo.customer.create({
        businessId,
        name: quickCustomer.name,
        phone: quickCustomer.phone || undefined,
      });
      const customer = res.data || res;
      setCustomerId(customer.id);
      setShowCustomerModal(false);
      setQuickCustomer({ name: '', phone: '' });
      setErrorMsg('');
    } catch (e: any) {
      setErrorMsg(e.message);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] min-h-[640px] bg-canvas -m-4 lg:-m-6">
      {/* Header — compact, calm */}
      <div className="h-12 bg-surface border-b border-border flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 rounded-sm bg-primary-50 border border-primary-100 flex items-center justify-center shrink-0">
            <ShoppingCart size={14} className="text-primary-600" />
          </div>
          <h1 className="text-body font-semibold text-text-primary tracking-tight truncate">পিওএস — বিক্রয় টার্মিনাল</h1>
          {currentShift && (
            <Badge variant="outline" className="hidden lg:inline-flex tabular-nums">
              শিফট খোলা
            </Badge>
          )}
          {configuredPrinter?.selectedPrinterName && (
            <Badge variant="outline" className="hidden xl:inline-flex">
              <Printer size={12} className="mr-1" /> {configuredPrinter.paperWidth}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button variant="ghost" size="sm" onClick={() => setShowHelp(true)} aria-label="সাহায্য">
            <HelpCircle size={14} className="mr-1" /> সাহায্য
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowHeldModal(true)}>
            <Pause size={14} className="mr-1" /> হোল্ড ({heldSales?.length || 0})
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left */}
        <div className="flex-1 flex flex-col p-3 gap-3 overflow-hidden min-w-0">
          {/* Barcode + Product search — side by side, calm */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 shrink-0">
            <div className="min-w-0">
              <label className="text-caption font-medium text-text-secondary block mb-1">বারকোড স্ক্যান / খুঁজুন — F1 ফোকাস</label>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
                <input
                  ref={barcodeInputRef}
                  value={barcodeInput.value}
                  onChange={e => barcodeInput.setValue(e.target.value)}
                  onKeyDown={barcodeInput.handleKeyDown as any}
                  placeholder="বারকোড স্ক্যান বা পণ্য নাম / SKU..."
                  className="w-full h-9 pl-8 pr-3 rounded-sm border border-border bg-surface text-body-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100 focus-visible:border-primary-400 placeholder:text-text-tertiary"
                  data-barcode-input
                  autoFocus
                  aria-label="বারকোড স্ক্যান"
                />
              </div>
            </div>
            <div className="min-w-0">
              <label className="text-caption font-medium text-text-secondary block mb-1">পণ্য সার্চ — সর্বনিম্ন ২ অক্ষর</label>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
                <input
                  ref={productSearchInputRef}
                  value={productSearchQuery}
                  onChange={e => setProductSearchQuery(e.target.value)}
                  placeholder="পণ্য খুঁজুন..."
                  className="w-full h-9 pl-8 pr-3 rounded-sm border border-border bg-surface text-body-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100 focus-visible:border-primary-400 placeholder:text-text-tertiary"
                  aria-label="পণ্য সার্চ"
                />
              </div>
            </div>
          </div>

          {/* Search Results — compact table */}
          {productSearchQuery.length >= 2 && searchResults && searchResults.length > 0 && (
            <Card className="max-h-[180px] overflow-auto shrink-0">
              <CardContent className="p-0">
                <table className="w-full">
                  <thead className="bg-subtle border-b border-border sticky top-0 z-10">
                    <tr>
                      <th className="text-left text-caption font-medium text-text-tertiary px-3 py-2">পণ্য</th>
                      <th className="text-left text-caption font-medium text-text-tertiary px-3 py-2 hidden lg:table-cell">SKU</th>
                      <th className="text-right text-caption font-medium text-text-tertiary px-3 py-2">দাম</th>
                      <th className="text-right text-caption font-medium text-text-tertiary px-3 py-2">মজুত</th>
                      <th className="text-right text-caption font-medium text-text-tertiary px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.map((p: any) => (
                      <tr key={p.id} className="border-b border-border last:border-0 hover:bg-subtle/70 transition-colors">
                        <td className="px-3 py-2 min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-body-sm font-medium truncate max-w-[220px]" title={p.name}>
                              {p.name}
                            </span>
                            {p.stockMilli / 1000 < (p.reorderLevelMilli / 1000 || 5) && p.stockMilli > 0 && <Badge variant="warning" className="shrink-0">কম</Badge>}
                            {p.stockMilli === 0 && <Badge variant="danger" className="shrink-0">শেষ</Badge>}
                          </div>
                          <span className="text-caption text-text-tertiary font-mono truncate block lg:hidden">{p.sku}</span>
                        </td>
                        <td className="px-3 py-2 text-caption font-mono text-text-secondary hidden lg:table-cell">{p.sku}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-body-sm">{formatPaisa(p.sellingPricePaisa)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-body-sm">{p.stockMilli / 1000}</td>
                        <td className="px-3 py-2 text-right">
                          <Button size="sm" onClick={() => addProductToCart(p, null, p.stockMilli)} disabled={p.stockMilli === 0 && p.isStockTrackable}>
                            যোগ
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* Cart — core, information-dense, no horizontal overflow */}
          <Card className="flex-1 flex flex-col overflow-hidden min-h-0">
            <CardHeader className="pb-2 pt-3 flex flex-row items-center justify-between shrink-0">
              <CardTitle className="text-body-sm flex items-center gap-2">
                <ShoppingCart size={14} className="text-text-tertiary" />
                কার্ট — {cartItems.length} পণ্য
                <span className="text-caption font-normal text-text-tertiary hidden lg:inline">• F3 পরিমাণ • Del মুছুন • একই বারকোড → পরিমাণ +১</span>
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={handleClearCart} disabled={cartItems.length === 0} className="h-7 text-caption">
                <X size={12} className="mr-1" /> খালি F9
              </Button>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-auto min-h-0">
              {cartItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-text-tertiary">
                  <div className="w-12 h-12 rounded-full bg-subtle border border-border flex items-center justify-center mb-3">
                    <ShoppingCart size={20} className="opacity-40" />
                  </div>
                  <p className="text-body-sm">কার্ট খালি — বারকোড স্ক্যান করুন বা পণ্য খুঁজুন</p>
                  <p className="text-caption mt-1">F1 স্ক্যান • F2 গ্রাহক • F5 হোল্ড • F7 পেমেন্ট</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px]">
                    <thead className="bg-subtle border-y border-border sticky top-0 z-10">
                      <tr>
                        <th className="text-left text-caption font-medium text-text-tertiary px-3 py-2 w-8">#</th>
                        <th className="text-left text-caption font-medium text-text-tertiary px-3 py-2 min-w-[180px]">পণ্য</th>
                        <th className="text-right text-caption font-medium text-text-tertiary px-3 py-2 w-[160px]">পরিমাণ</th>
                        <th className="text-right text-caption font-medium text-text-tertiary px-3 py-2 w-[100px]">দাম</th>
                        <th className="text-right text-caption font-medium text-text-tertiary px-3 py-2 w-[110px]">মোট</th>
                        <th className="text-right text-caption font-medium text-text-tertiary px-3 py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {cartItems.map((item, idx) => (
                        <tr
                          key={item.id}
                          data-cart-index={idx}
                          className={`border-b border-border last:border-0 hover:bg-subtle/50 transition-colors ${selectedCartIndex === idx ? 'bg-primary-50/70' : ''}`}
                          onClick={() => setSelectedCartIndex(idx)}
                        >
                          <td className="px-3 py-2.5 text-caption tabular-nums text-text-tertiary">{idx + 1}</td>
                          <td className="px-3 py-2.5 min-w-0">
                            <p className="text-body-sm font-medium truncate max-w-[200px] leading-tight" title={item.productName}>
                              {item.productName}
                            </p>
                            <p className="text-caption text-text-tertiary font-mono truncate max-w-[200px]" title={`${item.sku} • ${item.unitShortName}`}>
                              {item.sku} • {item.unitShortName}
                            </p>
                            {item.isLowStock && <Badge variant="warning" className="mt-1 text-[10px]">কম: {item.stockMilli / 1000}</Badge>}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  handleQtyChange(idx, item.quantity - 1);
                                }}
                                className="w-6 h-6 rounded-sm border border-border bg-surface hover:bg-subtle flex items-center justify-center text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100 shrink-0"
                                aria-label="পরিমাণ কমান"
                                tabIndex={0}
                              >
                                <Minus size={12} />
                              </button>
                              {/* Native compact qty input — not Input wrapper for performance */}
                              <input
                                type="number"
                                step="0.001"
                                value={item.quantity}
                                onChange={e => handleQtyChange(idx, parseFloat(e.target.value) || 0)}
                                onFocus={e => e.target.select()}
                                className="w-14 h-6 text-right font-mono text-body-sm tabular-nums border border-border rounded-sm bg-surface px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100 focus-visible:border-primary-400"
                                aria-label={`পরিমাণ ${item.productName}`}
                              />
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  handleQtyChange(idx, item.quantity + 1);
                                }}
                                className="w-6 h-6 rounded-sm border border-border bg-surface hover:bg-subtle flex items-center justify-center text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100 shrink-0"
                                aria-label="পরিমাণ বাড়ান"
                                tabIndex={0}
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                            <div className="flex justify-end mt-1">
                              <select
                                value={item.unitId}
                                onChange={e => {
                                  const newUnitId = e.target.value;
                                  const newUnitInfo = unitMap[newUnitId] || { name: newUnitId, shortName: newUnitId };
                                  const newItems = [...cartItems];
                                  newItems[idx] = { ...item, unitId: newUnitId, unitName: newUnitInfo.name, unitShortName: newUnitInfo.shortName };
                                  setCartItems(newItems);
                                }}
                                className="h-5 text-[11px] border border-border rounded-sm px-1 bg-surface text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
                                aria-label="ইউনিট"
                              >
                                {(units || []).map((u: any) => (
                                  <option key={u.id} value={u.id}>
                                    {u.shortName}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-body-sm">{formatPaisa(item.unitPricePaisa)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-body-sm font-semibold">{formatPaisa(item.lineTotalPaisa)}</td>
                          <td className="px-3 py-2.5 text-right">
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                handleRemoveItem(idx);
                              }}
                              className="w-6 h-6 rounded-sm hover:bg-danger-50 text-text-tertiary hover:text-danger-600 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-100"
                              aria-label={`মুছুন ${item.productName}`}
                              tabIndex={0}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {(errorMsg || printStatus) && (
            <div className="space-y-2 shrink-0">
              {errorMsg && (
                <div className="bg-danger-50 border border-danger-200 rounded-sm p-2.5 flex items-start gap-2">
                  <AlertTriangle size={14} className="text-danger-600 mt-0.5 shrink-0" />
                  <p className="text-body-sm text-danger-700 flex-1 leading-snug">{errorMsg}</p>
                  <button onClick={() => setErrorMsg('')} className="w-5 h-5 rounded-sm hover:bg-danger-100 flex items-center justify-center shrink-0">
                    <X size={12} />
                  </button>
                </div>
              )}
              {printStatus && (
                <div className="bg-info-50 border border-info-200 rounded-sm p-2.5 flex items-start gap-2">
                  <Printer size={14} className="text-info-600 mt-0.5 shrink-0" />
                  <p className="text-body-sm text-info-700 flex-1 leading-snug">{printStatus}</p>
                  <button onClick={() => setPrintStatus('')} className="w-5 h-5 rounded-sm hover:bg-info-100 flex items-center justify-center shrink-0">
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right — checkout, hierarchy prominent but not giant */}
        <div className="w-[360px] border-l border-border bg-surface flex flex-col p-3 gap-3 overflow-auto shrink-0">
          {/* Customer */}
          <Card className="shrink-0">
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-body-sm flex items-center gap-2">
                <User size={14} className="text-text-tertiary" /> গ্রাহক
                <span className="text-caption font-normal text-text-tertiary">F2</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <select
                value={customerId}
                onChange={e => setCustomerId(e.target.value)}
                className="w-full h-8 px-2.5 rounded-sm border border-border bg-surface text-body-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100 focus-visible:border-primary-400"
                aria-label="গ্রাহক নির্বাচন"
              >
                <option value="">ওয়াক-ইন গ্রাহক (নগদ)</option>
                {(customers || []).map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ''} — বকেয়া: {(c.currentDuePaisa / 100).toLocaleString('en-BD')}
                  </option>
                ))}
              </select>
              <div className="flex gap-1.5">
                <input
                  value={customerSearchQuery}
                  onChange={e => setCustomerSearchQuery(e.target.value)}
                  placeholder="গ্রাহক খুঁজুন..."
                  className="flex-1 h-8 px-2.5 rounded-sm border border-border bg-surface text-body-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100 placeholder:text-text-tertiary"
                  aria-label="গ্রাহক খুঁজুন"
                />
                <Button variant="secondary" size="sm" onClick={() => setShowCustomerModal(true)} className="h-8 shrink-0">
                  নতুন
                </Button>
              </div>
              {customerSearchQuery.length >= 1 && customerSearchResults && customerSearchResults.length > 0 && (
                <div className="border border-border rounded-sm max-h-[100px] overflow-auto divide-y divide-border">
                  {customerSearchResults.map((c: any) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setCustomerId(c.id);
                        setCustomerSearchQuery('');
                      }}
                      className="w-full text-left px-2.5 py-2 hover:bg-subtle text-body-sm transition-colors focus-visible:outline-none focus-visible:bg-subtle"
                    >
                      <span className="font-medium truncate block" title={c.name}>
                        {c.name}
                      </span>
                      <span className="text-caption text-text-tertiary">{c.phone || ''} • {formatPaisa(c.currentDuePaisa)}</span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Totals — hierarchy prominent */}
          <Card className="shrink-0">
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-body-sm">হিসাব</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <div className="flex justify-between text-body-sm">
                <span className="text-text-secondary">সাবটোটাল</span>
                <span className="tabular-nums font-medium">{formatPaisa(totals.subtotalPaisa)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-caption font-medium text-text-secondary block mb-1">ছাড় (৳)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={discount}
                    onChange={e => setDiscount(e.target.value)}
                    className="w-full h-8 px-2 rounded-sm border border-border bg-surface text-body-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100 focus-visible:border-primary-400"
                    aria-label="ছাড়"
                  />
                </div>
                <div>
                  <label className="text-caption font-medium text-text-secondary block mb-1">কর (৳)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={tax}
                    onChange={e => setTax(e.target.value)}
                    className="w-full h-8 px-2 rounded-sm border border-border bg-surface text-body-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100 focus-visible:border-primary-400"
                    aria-label="কর"
                  />
                </div>
              </div>
              <div className="flex justify-between items-center border-t border-border pt-3 mt-1">
                <span className="text-body font-semibold">মোট</span>
                <span className="text-h3 font-bold tabular-nums tracking-tight">{formatPaisa(totals.totalPaisa)}</span>
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-body-sm">
                  <span className="text-text-secondary">পরিশোধিত</span>
                  <span className="tabular-nums font-medium text-success-600">{formatPaisa(paidPaisa)}</span>
                </div>
                {duePaisa > 0 ? (
                  <div className="flex justify-between text-body-sm bg-danger-50 border border-danger-100 p-2 rounded-sm">
                    <span className="font-medium text-danger-700">বাকি</span>
                    <span className="tabular-nums font-bold text-danger-700">{formatPaisa(duePaisa)}</span>
                  </div>
                ) : changePaisa > 0 ? (
                  <div className="flex justify-between text-body-sm bg-success-50 border border-success-100 p-2 rounded-sm">
                    <span className="font-medium text-success-700">ফেরত</span>
                    <span className="tabular-nums font-bold text-success-700">{formatPaisa(changePaisa)}</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-body-sm bg-success-50 border border-success-100 p-2 rounded-sm">
                    <span className="text-success-700">পরিশোধিত</span>
                    <span className="tabular-nums text-success-700">৳ ০.০০</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2 shrink-0">
            <Button className="w-full h-11 text-body font-semibold tracking-tight" onClick={() => setShowPaymentModal(true)} disabled={cartItems.length === 0}>
              <CreditCard size={16} className="mr-2" /> পেমেন্ট F7
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" size="sm" onClick={handleHoldSale} disabled={cartItems.length === 0} className="h-8">
                <Pause size={14} className="mr-1" /> হোল্ড F5
              </Button>
              <Button variant="secondary" size="sm" onClick={handleClearCart} disabled={cartItems.length === 0} className="h-8">
                <X size={14} className="mr-1" /> বাতিল F9
              </Button>
            </div>
          </div>

          <Card className="shrink-0">
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-caption font-medium text-text-tertiary uppercase tracking-wider">দ্রুত নগদ</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-1.5">
              {[100, 500, 1000, 2000, 5000, 10000].map(denom => (
                <button
                  key={denom}
                  onClick={() => {
                    setPayments([{ method: 'cash', amount: denom.toString() }]);
                    setShowPaymentModal(true);
                  }}
                  className="h-8 rounded-sm border border-border bg-surface hover:bg-subtle text-body-sm tabular-nums font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
                >
                  ৳{denom}
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Payment Modal — polished */}
      <Modal open={showPaymentModal} onClose={() => setShowPaymentModal(false)} title="পেমেন্ট — F8 দিয়ে সম্পন্ন করুন" size="lg">
        <div className="space-y-4">
          <div className="bg-subtle border border-border rounded-sm p-3 space-y-1.5">
            <div className="flex justify-between text-body-sm">
              <span className="text-text-secondary">মোট</span>
              <span className="tabular-nums font-bold">{formatPaisa(totals.totalPaisa)}</span>
            </div>
            <div className="flex justify-between text-body-sm">
              <span className="text-text-secondary">পরিশোধিত</span>
              <span className="tabular-nums">{formatPaisa(paidPaisa)}</span>
            </div>
            {duePaisa > 0 && (
              <div className="flex justify-between text-body-sm text-danger-600 font-medium">
                <span>বাকি</span>
                <span className="tabular-nums font-bold">{formatPaisa(duePaisa)}</span>
              </div>
            )}
            {changePaisa > 0 && (
              <div className="flex justify-between text-body-sm text-success-600 font-medium">
                <span>ফেরত</span>
                <span className="tabular-nums font-bold">{formatPaisa(changePaisa)}</span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <label className="text-label">পেমেন্ট পদ্ধতি — ভাগ করা যায়</label>
            {payments.map((pay, idx) => (
              <div key={idx} className="grid grid-cols-6 gap-2 items-end bg-subtle border border-border p-2.5 rounded-sm">
                <div className="col-span-2">
                  <label className="text-caption font-medium block mb-1">পদ্ধতি</label>
                  <select
                    value={pay.method}
                    onChange={e => updatePayment(idx, 'method', e.target.value)}
                    className="w-full h-8 px-2 rounded-sm border border-border bg-surface text-body-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
                  >
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
                <div className="col-span-3">
                  <label className="text-caption font-medium block mb-1">টাকা (৳)</label>
                  <Input type="number" step="0.01" value={pay.amount} onChange={e => updatePayment(idx, 'amount', e.target.value)} className="h-8 tabular-nums" autoFocus={idx === 0} />
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removePayment(idx)} disabled={payments.length === 1}>
                  <Trash2 size={14} />
                </Button>
                {pay.method === 'cash' && cashQuery.data && cashQuery.data.length > 0 && (
                  <div className="col-span-6">
                    <select
                      value={pay.cashAccountId || ''}
                      onChange={e => updatePayment(idx, 'cashAccountId', e.target.value)}
                      className="w-full h-8 px-2 rounded-sm border border-border bg-surface text-caption focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
                    >
                      <option value="">ক্যাশ অ্যাকাউন্ট (ডিফল্ট)</option>
                      {cashQuery.data.map((ca: any) => (
                        <option key={ca.id} value={ca.id}>
                          {ca.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ))}
            <Button variant="secondary" size="sm" onClick={addPaymentRow}>
              <Plus size={14} className="mr-1" /> পেমেন্ট যোগ করুন
            </Button>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="secondary" onClick={() => setShowPaymentModal(false)}>
              বাতিল
            </Button>
            <Button onClick={handleCompleteSale} loading={createSaleMut.isPending}>
              বিক্রয় সম্পন্ন F8
            </Button>
          </div>
        </div>
      </Modal>

      {/* Held */}
      <Modal open={showHeldModal} onClose={() => setShowHeldModal(false)} title="হোল্ড করা বিক্রয়" size="lg">
        <div className="space-y-3">
          {!heldSales || heldSales.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-body-sm text-text-tertiary">এই সময়সীমায় কোনো তথ্য পাওয়া যায়নি।</p>
              <p className="text-caption text-text-tertiary mt-1">হোল্ড করা বিক্রয় এখানে দেখা যাবে</p>
            </div>
          ) : (
            <div className="border border-border rounded-sm overflow-hidden">
              <table className="w-full">
                <thead className="bg-subtle border-b border-border">
                  <tr>
                    <th className="text-left text-caption font-medium text-text-tertiary px-3 py-2">হোল্ড নম্বর</th>
                    <th className="text-left text-caption font-medium text-text-tertiary px-3 py-2">সময়</th>
                    <th className="text-right text-caption font-medium text-text-tertiary px-3 py-2">আইটেম</th>
                    <th className="text-right text-caption font-medium text-text-tertiary px-3 py-2">মোট</th>
                    <th className="text-right text-caption font-medium text-text-tertiary px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {heldSales.map((h: any) => (
                    <tr key={h.id} className="hover:bg-subtle/50 transition-colors">
                      <td className="px-3 py-2.5 font-mono text-body-sm tabular-nums">{h.heldNumber}</td>
                      <td className="px-3 py-2.5 text-caption">{new Date(h.createdAt).toLocaleString('bn-BD')}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{h.itemCount}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-medium">{formatPaisa(h.totalPaisa)}</td>
                      <td className="px-3 py-2.5 text-right flex justify-end gap-1">
                        <Button size="sm" onClick={() => handleResumeHeld(h.id)}>
                          <Play size={12} className="mr-1" /> চালু
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm('হোল্ড বাতিল করতে চান?')) cancelHeldMut.mutate(h.id);
                          }}
                        >
                          <X size={14} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>

      {/* Success */}
      <Modal open={!!showSuccess} onClose={() => setShowSuccess(null)} title="বিক্রয় সম্পন্ন" size="md">
        {showSuccess && (
          <div className="space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-success-50 border border-success-100 flex items-center justify-center mx-auto">
              <CheckCircle size={24} className="text-success-600" />
            </div>
            <div>
              <p className="text-h3 font-mono tabular-nums font-bold tracking-tight">{showSuccess.saleNumber}</p>
              <p className="text-body-sm text-text-secondary mt-1">বিক্রয় সফল — মজুত, পেমেন্ট, বকেয়া আপডেট হয়েছে</p>
            </div>
            <div className="bg-subtle border border-border p-3 rounded-sm space-y-1.5 text-left">
              <div className="flex justify-between text-body-sm">
                <span className="text-text-secondary">মোট</span>
                <span className="tabular-nums font-bold">{formatPaisa(showSuccess.total)}</span>
              </div>
              <div className="flex justify-between text-body-sm">
                <span className="text-text-secondary">পরিশোধিত</span>
                <span className="tabular-nums">{formatPaisa(showSuccess.paid)}</span>
              </div>
              {showSuccess.change > 0 && (
                <div className="flex justify-between text-success-700 font-medium">
                  <span>ফেরত</span>
                  <span className="tabular-nums font-bold">{formatPaisa(showSuccess.change)}</span>
                </div>
              )}
              {showSuccess.due > 0 && (
                <div className="flex justify-between text-danger-700 font-medium">
                  <span>বাকি</span>
                  <span className="tabular-nums font-bold">{formatPaisa(showSuccess.due)}</span>
                </div>
              )}
            </div>
            {printStatus && (
              <div className={`p-2.5 rounded-sm text-body-sm border text-left ${printStatus.includes('সফল') ? 'bg-success-50 border-success-200 text-success-700' : 'bg-warning-50 border-warning-200 text-warning-700'}`}>
                {printStatus}
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => handlePrintReceipt(showSuccess.saleId)} loading={printReceiptMut.isPending}>
                <Printer size={14} className="mr-1" /> রসিদ প্রিন্ট
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  setShowSuccess(null);
                  barcodeInputRef.current?.focus();
                }}
              >
                নতুন বিক্রয়
              </Button>
            </div>
            <p className="text-caption text-text-tertiary leading-snug">প্রিন্ট ব্যর্থ হলেও বিক্রয় রেকর্ড থাকবে, পুনরায় প্রিন্ট নিরাপদ — ডুপ্লিকেট তৈরি করে না</p>
          </div>
        )}
      </Modal>

      {/* Quick customer */}
      <Modal open={showCustomerModal} onClose={() => setShowCustomerModal(false)} title="দ্রুত গ্রাহক তৈরি" size="md">
        <div className="space-y-4">
          <div>
            <label className="text-label block mb-1.5">
              নাম <span className="text-danger-500">*</span>
            </label>
            <Input value={quickCustomer.name} onChange={e => setQuickCustomer({ ...quickCustomer, name: e.target.value })} placeholder="গ্রাহকের নাম" autoFocus />
          </div>
          <div>
            <label className="text-label block mb-1.5">ফোন</label>
            <Input value={quickCustomer.phone} onChange={e => setQuickCustomer({ ...quickCustomer, phone: e.target.value })} placeholder="017..." />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="secondary" onClick={() => setShowCustomerModal(false)}>
              বাতিল
            </Button>
            <Button onClick={handleQuickCustomerCreate}>তৈরি করুন</Button>
          </div>
        </div>
      </Modal>

      {/* Help */}
      <Modal open={showHelp} onClose={() => setShowHelp(false)} title="POS শর্টকাট" size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-body-sm">
            <div className="flex justify-between py-1.5 border-b border-border">
              <span className="font-mono text-caption bg-subtle border border-border px-1.5 py-0.5 rounded-sm">F1</span>
              <span>বারকোড ফোকাস</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-border">
              <span className="font-mono text-caption bg-subtle border border-border px-1.5 py-0.5 rounded-sm">F2</span>
              <span>গ্রাহক</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-border">
              <span className="font-mono text-caption bg-subtle border border-border px-1.5 py-0.5 rounded-sm">F3</span>
              <span>পরিমাণ</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-border">
              <span className="font-mono text-caption bg-subtle border border-border px-1.5 py-0.5 rounded-sm">F5</span>
              <span>হোল্ড</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-border">
              <span className="font-mono text-caption bg-subtle border border-border px-1.5 py-0.5 rounded-sm">F6</span>
              <span>হোল্ড তালিকা</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-border">
              <span className="font-mono text-caption bg-subtle border border-border px-1.5 py-0.5 rounded-sm">F7</span>
              <span>পেমেন্ট</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-border">
              <span className="font-mono text-caption bg-subtle border border-border px-1.5 py-0.5 rounded-sm">F8</span>
              <span>সম্পন্ন</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-border">
              <span className="font-mono text-caption bg-subtle border border-border px-1.5 py-0.5 rounded-sm">F9</span>
              <span>বাতিল</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-border">
              <span className="font-mono text-caption bg-subtle border border-border px-1.5 py-0.5 rounded-sm">Del</span>
              <span>মুছুন</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-border">
              <span className="font-mono text-caption bg-subtle border border-border px-1.5 py-0.5 rounded-sm">Esc</span>
              <span>বন্ধ</span>
            </div>
          </div>
          <div className="bg-subtle border border-border p-3 rounded-sm text-caption leading-relaxed space-y-1">
            <p className="font-medium text-body-sm">হার্ডওয়্যার:</p>
            <p>• স্ক্যানার: USB/Bluetooth/Wireless HID — কীবোর্ড wedge, Enter সাফিক্স, দ্রুত বার্স্ট &lt;50ms</p>
            <p>• একই বারকোড → পরিমাণ +১</p>
            <p>• অজানা বারকোড: “এই বারকোডের কোনো পণ্য পাওয়া যায়নি।”</p>
            <p>• নিষ্ক্রিয় পণ্য বিক্রয়যোগ্য নয় — কার্টে যোগ হবে না</p>
            <p>• রসিদ: 80mm/58mm/A4, বাংলা Noto Sans, HTML প্রিন্ট</p>
            <p>• প্রিন্ট ব্যর্থ হলেও বিক্রয় অপরিবর্তিত — পুনরায় প্রিন্ট নিরাপদ</p>
          </div>
        </div>
      </Modal>
    </div>
  );
};
