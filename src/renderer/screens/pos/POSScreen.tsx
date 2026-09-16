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
  // Cart state
  const [cartItems, setCartItems] = useState<POSCartItem[]>([]);
  const [discount, setDiscount] = useState('0');
  const [tax, setTax] = useState('0');
  const [customerId, setCustomerId] = useState<string>('');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [selectedCartIndex, setSelectedCartIndex] = useState<number>(-1);

  // Payment state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payments, setPayments] = useState<{ method: string; amount: string; cashAccountId?: string; bankAccountId?: string; mfsAccountId?: string }[]>([{ method: 'cash', amount: '' }]);
  const [showHeldModal, setShowHeldModal] = useState(false);
  const [showSuccess, setShowSuccess] = useState<{ saleId: string; saleNumber: string; total: number; paid: number; change: number; due: number } | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [quickCustomer, setQuickCustomer] = useState({ name: '', phone: '' });

  // Error & print status
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [printStatus, setPrintStatus] = useState<string>('');

  // Refs
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const productSearchInputRef = useRef<HTMLInputElement>(null);

  // Data
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

  // Barcode handling — P4.2 enhanced with inactive/unknown handling, duplicate increment
  const handleBarcodeScan = useCallback(
    async (barcode: string) => {
      try {
        const res = await window.merqo.pos.productByBarcode({ businessId, barcode });
        const data = res.success === false ? [] : (res.data || res);
        if (!data || data.length === 0) {
          setErrorMsg(`এই বারকোডের কোনো পণ্য পাওয়া যায়নি। বারকোড: ${barcode}`);
          return;
        }
        if (data.length > 1) {
          setErrorMsg(`একাধিক পণ্য একই বারকোডে পাওয়া গেছে, প্রথমটি যোগ করা হলো`);
        }
        const first = data[0];
        // Check inactive / non-sellable before adding
        if (!first.product.isActive) {
          setErrorMsg('এই পণ্যটি বিক্রয়ের জন্য সক্রিয় নয়।');
          return;
        }
        if (!first.product.isSellable) {
          setErrorMsg('এই পণ্যটি বিক্রয়যোগ্য নয়।');
          return;
        }
        addProductToCart(first.product, first.barcodeDetail, first.stockMilli, first.unit);
      } catch (e: any) {
        // Handle unknown barcode with Bengali message
        const msg = e.message || '';
        if (msg.includes('পাওয়া যায়নি') || msg.includes('not found') || msg.includes('NOT_FOUND')) {
          setErrorMsg(`এই বারকোডের কোনো পণ্য পাওয়া যায়নি।`);
        } else {
          setErrorMsg(msg || 'বারকোড স্ক্যান করা যায়নি। আবার চেষ্টা করুন।');
        }
      }
    },
    [businessId]
  );

  const barcodeInput = useBarcodeInput(handleBarcodeScan);

  // P4.2: Global scanner hook with configurable thresholds
  const globalScanner = useBarcodeScanner({
    onScan: handleBarcodeScan,
    enabled: true,
    minLength: scannerConfig?.minLength || 3,
    maxLength: scannerConfig?.maxLength || 64,
    scanTimeoutMs: scannerConfig?.scanTimeoutMs || 150,
    charThresholdMs: scannerConfig?.charThresholdMs || 50,
    suffix: (scannerConfig?.suffix as any) || 'Enter',
    prefix: scannerConfig?.prefix || '',
  });

  // Focus barcode on mount and F1
  useEffect(() => {
    barcodeInput.focus();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = (e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA';

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

  const addProductToCart = (product: any, barcodeDetail: any, stockMilli: number, unitOverride?: any) => {
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
      setErrorMsg('এই পণ্যের পর্যাপ্ত স্টক নেই।');
      return;
    }

    const unitId = barcodeDetail?.unitId || product.saleUnitId || product.baseUnitId;
    const unitInfo = unitMap[unitId] || { name: unitId, shortName: unitId };
    const qtyFromBarcode = barcodeDetail?.quantityMilli ? barcodeDetail.quantityMilli / 1000 : 1;

    // Duplicate scan: same barcode → quantity +1 (P4.2 requirement)
    const existingIdx = cartItems.findIndex(item => item.productId === product.id && item.unitId === unitId);
    if (existingIdx >= 0) {
      const newItems = [...cartItems];
      const existing = newItems[existingIdx];
      const newQty = existing.quantity + qtyFromBarcode;
      if (product.isStockTrackable) {
        const baseQty = calculateBaseQty(newQty, unitId, product.baseUnitId, conversions);
        if (baseQty > stockMilli) {
          setErrorMsg(`এই পণ্যের পর্যাপ্ত স্টক নেই। বর্তমান: ${stock}, প্রয়োজন: ${newQty}`);
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
        setErrorMsg(`এই পণ্যের পর্যাপ্ত স্টক নেই। বর্তমান: ${stock}, প্রয়োজন: ${quantity}`);
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
  };

  const calculateBaseQty = (qty: number, fromUnitId: string, baseUnitId: string, convs: any): number => {
    if (fromUnitId === baseUnitId) return Math.round(qty * 1000);
    if (!convs) return Math.round(qty * 1000);
    const conv = convs.find((c: any) => c.fromUnitId === fromUnitId && c.toUnitId === baseUnitId);
    if (conv) return Math.round(qty * conv.conversionFactor * 1000);
    const reverse = convs.find((c: any) => c.fromUnitId === baseUnitId && c.toUnitId === fromUnitId);
    if (reverse && reverse.conversionFactor !== 0) return Math.round(qty / reverse.conversionFactor * 1000);
    return Math.round(qty * 1000);
  };

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
        setErrorMsg(`এই পণ্যের পর্যাপ্ত স্টক নেই। বর্তমান: ${stockQty}`);
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
        // Print failure must NOT rollback sale — sale remains valid
        setPrintStatus(result.messageBn || 'প্রিন্ট ব্যর্থ, কিন্তু বিক্রয় সফল হয়েছে। আবার চেষ্টা করুন।');
      }
    } catch (e: any) {
      // Print failure does not affect sale
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

    if (payments.length > 1) {
      const sum = payments.reduce((s, p) => s + Math.round((parseFloat(p.amount) || 0) * 100), 0);
      if (sum !== paidPaisa) {
        setErrorMsg('পরিশোধের পরিমাণ মোট বিলের সঙ্গে মিলছে না।');
        return;
      }
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
        paidPaisa: paid > 0 ? paid : (duePaisa === 0 ? totals.totalPaisa : paid),
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

      // Auto-print if configured — failure does not rollback sale
      if (configuredPrinter?.autoPrintOnSale) {
        setTimeout(() => {
          handlePrintReceipt(result.id);
        }, 500);
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'বিক্রয় সম্পন্ন করা যায়নি। কোনো হিসাব বা স্টক পরিবর্তন করা হয়নি।');
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
      const res = await window.merqo.customer.create({
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
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-canvas">
      {/* Header */}
      <div className="h-14 bg-surface border-b border-border flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-h3 font-bold text-text-primary flex items-center gap-2">
            <ShoppingCart size={20} className="text-primary-500" />
            POS — বিক্রয় টার্মিনাল
            {globalScanner.isScanning && <Badge variant="primary" className="animate-pulse">স্ক্যান হচ্ছে...</Badge>}
          </h1>
          {currentShift && (
            <Badge variant="default" className="ml-2">
              শিফট: {(currentShift as any).shift_number || 'খোলা'} • {(currentShift as any).opening_cash_paisa ? formatPaisa((currentShift as any).opening_cash_paisa) : ''}
            </Badge>
          )}
          {configuredPrinter?.selectedPrinterName && (
            <Badge variant="default" className="ml-1">
              <Printer size={12} className="mr-1" /> {configuredPrinter.paperWidth} • {configuredPrinter.selectedPrinterName.slice(0, 20)}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowHelp(true)}>
            <HelpCircle size={16} className="mr-1" /> সাহায্য (?)
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowHeldModal(true)}>
            <Pause size={16} className="mr-1" /> হোল্ড ({heldSales?.length || 0}) F6
          </Button>
          <Button variant="ghost" size="sm" onClick={() => barcodeInputRef.current?.focus()}>
            F1 স্ক্যান
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left / Primary */}
        <div className="flex-1 flex flex-col p-3 gap-3 overflow-hidden">
          {/* Barcode + Search */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-caption font-medium block mb-1">বারকোড স্ক্যান / প্রোডাক্ট খুঁজুন (F1) — {scannerConfig?.suffix || 'Enter'} সাফিক্স</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                <Input
                  ref={barcodeInputRef as any}
                  value={barcodeInput.value}
                  onChange={e => barcodeInput.setValue(e.target.value)}
                  onKeyDown={barcodeInput.handleKeyDown as any}
                  placeholder="বারকোড স্ক্যান করুন বা পণ্যের নাম/SKU লিখুন..."
                  className="pl-9 h-11 text-body font-medium"
                  data-barcode-input
                  autoFocus
                />
              </div>
              <p className="text-caption text-text-tertiary mt-1">USB HID / Bluetooth HID / Wireless HID — কীবোর্ড হিসাবে কাজ করে, দ্রুত বার্স্ট ডিটেকশন {scannerConfig?.charThresholdMs || 50}ms, {scannerConfig?.suffix || 'Enter'} সাফিক্স, ম্যানুয়াল এন্ট্রি সমর্থিত</p>
            </div>
            <div>
              <label className="text-caption font-medium block mb-1">প্রোডাক্ট সার্চ (ন্যূনতম ২ অক্ষর)</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                <Input
                  ref={productSearchInputRef as any}
                  value={productSearchQuery}
                  onChange={e => setProductSearchQuery(e.target.value)}
                  placeholder="পণ্য খুঁজুন..."
                  className="pl-9 h-11"
                />
              </div>
            </div>
          </div>

          {/* Search Results */}
          {productSearchQuery.length >= 2 && searchResults && searchResults.length > 0 && (
            <Card className="max-h-[200px] overflow-auto">
              <CardContent className="p-0">
                <table className="w-full">
                  <thead className="bg-subtle border-b border-border sticky top-0">
                    <tr>
                      <th className="text-left text-caption px-3 py-2">পণ্য</th>
                      <th className="text-left text-caption px-3 py-2">SKU</th>
                      <th className="text-right text-caption px-3 py-2">দাম</th>
                      <th className="text-right text-caption px-3 py-2">স্টক</th>
                      <th className="text-right text-caption px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.map((p: any) => (
                      <tr key={p.id} className="border-b hover:bg-subtle/50">
                        <td className="px-3 py-2 text-body-sm">
                          <span className="font-medium">{p.name}</span>
                          {p.barcode && <span className="text-caption text-text-tertiary ml-2 font-mono">{p.barcode}</span>}
                          {p.stockMilli / 1000 < (p.reorderLevelMilli / 1000 || 5) && p.stockMilli > 0 && (
                            <Badge variant="warning" className="ml-2">কম স্টক</Badge>
                          )}
                          {p.stockMilli === 0 && <Badge variant="danger" className="ml-2">স্টক নেই</Badge>}
                        </td>
                        <td className="px-3 py-2 text-caption font-mono">{p.sku}</td>
                        <td className="px-3 py-2 text-right font-mono text-body-sm">{formatPaisa(p.sellingPricePaisa)}</td>
                        <td className="px-3 py-2 text-right font-mono text-body-sm">{p.stockMilli / 1000}</td>
                        <td className="px-3 py-2 text-right">
                          <Button size="sm" onClick={() => addProductToCart(p, null, p.stockMilli, null)} disabled={p.stockMilli === 0 && p.isStockTrackable}>
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

          {/* Cart */}
          <Card className="flex-1 flex flex-col overflow-hidden">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-body flex items-center gap-2">
                <ShoppingCart size={16} /> কার্ট ({cartItems.length} টি পণ্য) • F3 পরিমাণ, Del মুছুন • একই বারকোড স্ক্যান → পরিমাণ +১
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={handleClearCart} disabled={cartItems.length === 0}>
                <X size={14} className="mr-1" /> খালি করুন F9
              </Button>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-auto">
              {cartItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-text-tertiary">
                  <ShoppingCart size={48} className="mb-3 opacity-20" />
                  <p className="text-body-sm">কার্ট খালি — বারকোড স্ক্যান করুন বা পণ্য খুঁজুন</p>
                  <p className="text-caption mt-1">F1 স্ক্যান, F2 গ্রাহক, F5 হোল্ড, F7 পেমেন্ট • স্ক্যানার: {scannerConfig?.suffix || 'Enter'} সাফিক্স, {scannerConfig?.charThresholdMs || 50}ms থ্রেশহোল্ড</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-subtle border-y border-border sticky top-0">
                    <tr>
                      <th className="text-left text-caption font-medium px-3 py-2">#</th>
                      <th className="text-left text-caption font-medium px-3 py-2">পণ্য</th>
                      <th className="text-right text-caption font-medium px-3 py-2">পরিমাণ</th>
                      <th className="text-right text-caption font-medium px-3 py-2">দাম</th>
                      <th className="text-right text-caption font-medium px-3 py-2">মোট</th>
                      <th className="text-right text-caption font-medium px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cartItems.map((item, idx) => (
                      <tr
                        key={item.id}
                        data-cart-index={idx}
                        className={`border-b hover:bg-subtle/50 ${selectedCartIndex === idx ? 'bg-primary-50' : ''}`}
                        onClick={() => setSelectedCartIndex(idx)}
                      >
                        <td className="px-3 py-2 text-caption">{idx + 1}</td>
                        <td className="px-3 py-2">
                          <p className="text-body-sm font-medium truncate max-w-[200px]">{item.productName}</p>
                          <p className="text-caption text-text-tertiary font-mono">{item.sku} • {item.unitShortName}</p>
                          {item.isLowStock && <Badge variant="warning" className="mt-1">কম স্টক: {item.stockMilli / 1000}</Badge>}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleQtyChange(idx, item.quantity - 1)}>
                              <Minus size={12} />
                            </Button>
                            <Input
                              type="number"
                              step="0.001"
                              value={item.quantity}
                              onChange={e => handleQtyChange(idx, parseFloat(e.target.value) || 0)}
                              className="w-16 h-7 text-right font-mono text-body-sm"
                            />
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleQtyChange(idx, item.quantity + 1)}>
                              <Plus size={12} />
                            </Button>
                          </div>
                          <select
                            value={item.unitId}
                            onChange={e => {
                              const newUnitId = e.target.value;
                              const newUnitInfo = unitMap[newUnitId] || { name: newUnitId, shortName: newUnitId };
                              const newItems = [...cartItems];
                              newItems[idx] = { ...item, unitId: newUnitId, unitName: newUnitInfo.name, unitShortName: newUnitInfo.shortName };
                              setCartItems(newItems);
                            }}
                            className="mt-1 h-6 text-caption border rounded px-1 bg-surface"
                          >
                            {(units || []).map((u: any) => (
                              <option key={u.id} value={u.id}>{u.shortName}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-body-sm">{formatPaisa(item.unitPricePaisa)}</td>
                        <td className="px-3 py-2 text-right font-mono text-body-sm font-medium">{formatPaisa(item.lineTotalPaisa)}</td>
                        <td className="px-3 py-2 text-right">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveItem(idx)}>
                            <Trash2 size={14} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {errorMsg && (
            <div className="bg-danger-50 border border-danger-200 rounded p-3 flex items-start gap-2">
              <AlertTriangle size={16} className="text-danger-600 mt-0.5 shrink-0" />
              <p className="text-body-sm text-danger-600">{errorMsg}</p>
              <Button variant="ghost" size="icon" className="ml-auto h-6 w-6" onClick={() => setErrorMsg('')}>
                <X size={14} />
              </Button>
            </div>
          )}
          {printStatus && (
            <div className="bg-info-50 border border-info-200 rounded p-3 flex items-start gap-2">
              <Printer size={16} className="text-info-600 mt-0.5 shrink-0" />
              <p className="text-body-sm text-info-700">{printStatus}</p>
              <Button variant="ghost" size="icon" className="ml-auto h-6 w-6" onClick={() => setPrintStatus('')}>
                <X size={14} />
              </Button>
            </div>
          )}
        </div>

        {/* Right / Checkout */}
        <div className="w-[380px] border-l border-border bg-surface flex flex-col p-3 gap-3 overflow-auto shrink-0">
          {/* Customer */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-body-sm flex items-center gap-2">
                <User size={14} /> গ্রাহক F2
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <select
                value={customerId}
                onChange={e => setCustomerId(e.target.value)}
                className="w-full h-9 px-3 rounded-sm border border-border bg-surface text-body-sm"
              >
                <option value="">ওয়াক-ইন গ্রাহক (নগদ)</option>
                {(customers || []).map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''} — বকেয়া: {(c.currentDuePaisa / 100).toLocaleString('en-BD')}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <Input
                  value={customerSearchQuery}
                  onChange={e => setCustomerSearchQuery(e.target.value)}
                  placeholder="গ্রাহক খুঁজুন..."
                  className="flex-1 h-8 text-body-sm"
                />
                <Button variant="secondary" size="sm" onClick={() => setShowCustomerModal(true)}>নতুন</Button>
              </div>
              {customerSearchQuery.length >= 1 && customerSearchResults && customerSearchResults.length > 0 && (
                <div className="border rounded max-h-[120px] overflow-auto">
                  {customerSearchResults.map((c: any) => (
                    <button
                      key={c.id}
                      onClick={() => { setCustomerId(c.id); setCustomerSearchQuery(''); }}
                      className="w-full text-left px-3 py-2 hover:bg-subtle text-body-sm"
                    >
                      {c.name} — {c.phone || ''} — বকেয়া: {formatPaisa(c.currentDuePaisa)}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Totals */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-body-sm">হিসাব</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-body-sm"><span>সাবটোটাল</span><span className="font-mono">{formatPaisa(totals.subtotalPaisa)}</span></div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-caption block mb-1">ছাড় (৳) F4</label>
                  <Input type="number" step="0.01" value={discount} onChange={e => setDiscount(e.target.value)} className="h-8 font-mono" />
                </div>
                <div>
                  <label className="text-caption block mb-1">ট্যাক্স (৳)</label>
                  <Input type="number" step="0.01" value={tax} onChange={e => setTax(e.target.value)} className="h-8 font-mono" />
                </div>
              </div>
              <div className="flex justify-between text-h3 font-bold border-t pt-2"><span>মোট</span><span className="font-mono">{formatPaisa(totals.totalPaisa)}</span></div>
              <div className="flex justify-between text-body-sm"><span>পরিশোধিত</span><span className="font-mono text-success-600">{formatPaisa(paidPaisa)}</span></div>
              {duePaisa > 0 ? (
                <div className="flex justify-between text-body-sm bg-danger-50 p-2 rounded text-danger-600"><span>বাকি</span><span className="font-mono font-bold">{formatPaisa(duePaisa)}</span></div>
              ) : changePaisa > 0 ? (
                <div className="flex justify-between text-body-sm bg-success-50 p-2 rounded text-success-600"><span>ফেরত</span><span className="font-mono font-bold">{formatPaisa(changePaisa)}</span></div>
              ) : (
                <div className="flex justify-between text-body-sm bg-success-50 p-2 rounded text-success-600"><span>পরিশোধিত</span><span className="font-mono">৳ ০.০০</span></div>
              )}
            </CardContent>
          </Card>

          {/* Payment Actions */}
          <div className="space-y-2">
            <Button className="w-full h-12 text-body font-bold" onClick={() => setShowPaymentModal(true)} disabled={cartItems.length === 0}>
              <CreditCard size={18} className="mr-2" /> পেমেন্ট করুন F7
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={handleHoldSale} disabled={cartItems.length === 0}>
                <Pause size={16} className="mr-1" /> হোল্ড F5
              </Button>
              <Button variant="secondary" onClick={handleClearCart} disabled={cartItems.length === 0}>
                <X size={16} className="mr-1" /> বাতিল F9
              </Button>
            </div>
          </div>

          {/* Quick cash */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-caption">দ্রুত নগদ</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-3 gap-2">
              {[100, 500, 1000, 2000, 5000, 10000].map(denom => (
                <Button
                  key={denom}
                  variant="secondary"
                  size="sm"
                  className="font-mono"
                  onClick={() => {
                    setPayments([{ method: 'cash', amount: denom.toString() }]);
                    setShowPaymentModal(true);
                  }}
                >
                  ৳{denom}
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Payment Modal */}
      <Modal open={showPaymentModal} onClose={() => setShowPaymentModal(false)} title="পেমেন্ট — F8 সম্পন্ন করুন" size="lg">
        <div className="space-y-4">
          <div className="bg-subtle p-3 rounded space-y-1">
            <div className="flex justify-between"><span>মোট</span><span className="font-mono font-bold">{formatPaisa(totals.totalPaisa)}</span></div>
            <div className="flex justify-between"><span>পরিশোধিত</span><span className="font-mono">{formatPaisa(paidPaisa)}</span></div>
            {duePaisa > 0 && <div className="flex justify-between text-danger-600"><span>বাকি</span><span className="font-mono font-bold">{formatPaisa(duePaisa)}</span></div>}
            {changePaisa > 0 && <div className="flex justify-between text-success-600"><span>ফেরত</span><span className="font-mono font-bold">{formatPaisa(changePaisa)}</span></div>}
          </div>

          <div className="space-y-2">
            <label className="text-label">পেমেন্ট পদ্ধতি (ভাগ করা যায়)</label>
            {payments.map((pay, idx) => (
              <div key={idx} className="grid grid-cols-6 gap-2 items-end bg-subtle p-2 rounded">
                <div className="col-span-2">
                  <label className="text-caption block mb-1">পদ্ধতি</label>
                  <select value={pay.method} onChange={e => updatePayment(idx, 'method', e.target.value)} className="w-full h-8 px-2 rounded-sm border border-border bg-surface text-caption">
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
                  <label className="text-caption block mb-1">টাকা (৳)</label>
                  <Input type="number" step="0.01" value={pay.amount} onChange={e => updatePayment(idx, 'amount', e.target.value)} className="h-8 font-mono" autoFocus={idx === 0} />
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removePayment(idx)} disabled={payments.length === 1}><Trash2 size={14} /></Button>
                {pay.method === 'cash' && cashQuery.data && cashQuery.data.length > 0 && (
                  <div className="col-span-6">
                    <select value={pay.cashAccountId || ''} onChange={e => updatePayment(idx, 'cashAccountId', e.target.value)} className="w-full h-8 px-2 rounded-sm border border-border bg-surface text-caption">
                      <option value="">ক্যাশ অ্যাকাউন্ট (ডিফল্ট)</option>
                      {cashQuery.data.map((ca: any) => <option key={ca.id} value={ca.id}>{ca.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
            ))}
            <Button variant="secondary" size="sm" onClick={addPaymentRow}><Plus size={14} className="mr-1" /> পেমেন্ট যোগ করুন</Button>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowPaymentModal(false)}>বাতিল</Button>
            <Button onClick={handleCompleteSale} loading={createSaleMut.isPending}>বিক্রয় সম্পন্ন করুন F8</Button>
          </div>
        </div>
      </Modal>

      {/* Held Sales Modal */}
      <Modal open={showHeldModal} onClose={() => setShowHeldModal(false)} title="হোল্ড করা বিক্রয় — F6" size="lg">
        <div className="space-y-3">
          {!heldSales || heldSales.length === 0 ? (
            <p className="text-body-sm text-text-tertiary py-8 text-center">কোন হোল্ড করা বিক্রয় নেই</p>
          ) : (
            <table className="w-full">
              <thead className="bg-subtle border-y">
                <tr>
                  <th className="text-left text-caption px-3 py-2">হোল্ড নম্বর</th>
                  <th className="text-left text-caption px-3 py-2">সময়</th>
                  <th className="text-right text-caption px-3 py-2">আইটেম</th>
                  <th className="text-right text-caption px-3 py-2">মোট</th>
                  <th className="text-right text-caption px-3 py-2">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody>
                {heldSales.map((h: any) => (
                  <tr key={h.id} className="border-b hover:bg-subtle/50">
                    <td className="px-3 py-2 font-mono text-body-sm">{h.heldNumber}</td>
                    <td className="px-3 py-2 text-caption">{new Date(h.createdAt).toLocaleString('bn-BD')}</td>
                    <td className="px-3 py-2 text-right font-mono">{h.itemCount}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatPaisa(h.totalPaisa)}</td>
                    <td className="px-3 py-2 text-right flex justify-end gap-1">
                      <Button size="sm" onClick={() => handleResumeHeld(h.id)}><Play size={14} className="mr-1" /> চালু</Button>
                      <Button variant="ghost" size="sm" onClick={() => { if (confirm('হোল্ড বাতিল করতে চান?')) cancelHeldMut.mutate(h.id); }}><X size={14} /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Modal>

      {/* Success Modal — P4.2 enhanced with print handling, failure does NOT rollback */}
      <Modal open={!!showSuccess} onClose={() => setShowSuccess(null)} title="বিক্রয় সম্পন্ন" size="md">
        {showSuccess && (
          <div className="space-y-4 text-center">
            <CheckCircle size={48} className="mx-auto text-success-500" />
            <div>
              <p className="text-h2 font-mono">{showSuccess.saleNumber}</p>
              <p className="text-body-sm text-text-secondary mt-1">বিক্রয় সফলভাবে সম্পন্ন হয়েছে — স্টক, পেমেন্ট, বকেয়া আপডেট হয়েছে</p>
            </div>
            <div className="bg-subtle p-3 rounded space-y-1 text-left">
              <div className="flex justify-between text-body-sm"><span>মোট</span><span className="font-mono font-bold">{formatPaisa(showSuccess.total)}</span></div>
              <div className="flex justify-between text-body-sm"><span>পরিশোধিত</span><span className="font-mono">{formatPaisa(showSuccess.paid)}</span></div>
              {showSuccess.change > 0 && <div className="flex justify-between text-success-600"><span>ফেরত</span><span className="font-mono font-bold">{formatPaisa(showSuccess.change)}</span></div>}
              {showSuccess.due > 0 && <div className="flex justify-between text-danger-600"><span>বাকি</span><span className="font-mono font-bold">{formatPaisa(showSuccess.due)}</span></div>}
            </div>
            {printStatus && (
              <div className={`p-2 rounded text-body-sm border ${printStatus.includes('সফল') ? 'bg-success-50 border-success-200 text-success-700' : 'bg-warning-50 border-warning-200 text-warning-700'}`}>
                {printStatus}
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => handlePrintReceipt(showSuccess.saleId)} loading={printReceiptMut.isPending}>
                <Printer size={16} className="mr-1" /> রসিদ প্রিন্ট ({configuredPrinter?.paperWidth || '80mm'})
              </Button>
              <Button className="flex-1" onClick={() => { setShowSuccess(null); barcodeInputRef.current?.focus(); }}>নতুন বিক্রয়</Button>
            </div>
            <p className="text-caption text-text-tertiary">প্রিন্ট ব্যর্থ হলেও বিক্রয় রেকর্ড থাকবে, আবার প্রিন্ট করতে পারবেন — কোনো ডুপ্লিকেট বিক্রয়/পেমেন্ট তৈরি হবে না</p>
          </div>
        )}
      </Modal>

      {/* Customer Modal */}
      <Modal open={showCustomerModal} onClose={() => setShowCustomerModal(false)} title="দ্রুত গ্রাহক তৈরি" size="md">
        <div className="space-y-3">
          <div>
            <label className="text-label block mb-1">নাম *</label>
            <Input value={quickCustomer.name} onChange={e => setQuickCustomer({ ...quickCustomer, name: e.target.value })} placeholder="গ্রাহকের নাম" autoFocus />
          </div>
          <div>
            <label className="text-label block mb-1">ফোন</label>
            <Input value={quickCustomer.phone} onChange={e => setQuickCustomer({ ...quickCustomer, phone: e.target.value })} placeholder="017..." />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowCustomerModal(false)}>বাতিল</Button>
            <Button onClick={handleQuickCustomerCreate}>তৈরি করুন</Button>
          </div>
        </div>
      </Modal>

      {/* Help Modal */}
      <Modal open={showHelp} onClose={() => setShowHelp(false)} title="POS শর্টকাট — P4.2 Hardware" size="md">
        <div className="space-y-2 text-body-sm">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex justify-between border-b py-1"><span>F1</span><span>বারকোড ফোকাস</span></div>
            <div className="flex justify-between border-b py-1"><span>F2</span><span>গ্রাহক নির্বাচন</span></div>
            <div className="flex justify-between border-b py-1"><span>F3</span><span>পরিমাণ সম্পাদনা</span></div>
            <div className="flex justify-between border-b py-1"><span>F4</span><span>ছাড়</span></div>
            <div className="flex justify-between border-b py-1"><span>F5</span><span>হোল্ড</span></div>
            <div className="flex justify-between border-b py-1"><span>F6</span><span>হোল্ড তালিকা</span></div>
            <div className="flex justify-between border-b py-1"><span>F7</span><span>পেমেন্ট</span></div>
            <div className="flex justify-between border-b py-1"><span>F8</span><span>বিক্রয় সম্পন্ন</span></div>
            <div className="flex justify-between border-b py-1"><span>F9</span><span>কার্ট বাতিল</span></div>
            <div className="flex justify-between border-b py-1"><span>Del</span><span>আইটেম মুছুন</span></div>
            <div className="flex justify-between border-b py-1"><span>Esc</span><span>বন্ধ করুন</span></div>
            <div className="flex justify-between border-b py-1"><span>Shift+?</span><span>সাহায্য</span></div>
          </div>
          <div className="bg-subtle p-2 rounded text-caption space-y-1">
            <p className="font-medium">P4.2 Hardware:</p>
            <p>• বারকোড স্ক্যানার: USB HID / Bluetooth HID / Wireless HID — কীবোর্ড wedge, {scannerConfig?.suffix || 'Enter'} সাফিক্স, দ্রুত বার্স্ট &lt;{scannerConfig?.charThresholdMs || 50}ms, ম্যানুয়াল এন্ট্রি সমর্থিত</p>
            <p>• একই বারকোড বারবার স্ক্যান → পরিমাণ +১</p>
            <p>• অজানা বারকোড: “এই বারকোডের কোনো পণ্য পাওয়া যায়নি।”</p>
            <p>• নিষ্ক্রিয় পণ্য: বিক্রয়যোগ্য নয় — কার্টে যোগ হবে না</p>
            <p>• রসিদ প্রিন্ট: {configuredPrinter?.paperWidth || '80mm'} / 58mm / A4, বাংলা Noto Sans, HTML প্রিন্ট পথ (ESC/POS raw নয়)</p>
            <p>• প্রিন্ট ব্যর্থ হলেও বিক্রয়, স্টক, পেমেন্ট অপরিবর্তিত — পুনরায় প্রিন্ট নিরাপদ, ডুপ্লিকেট তৈরি করে না</p>
          </div>
        </div>
      </Modal>
    </div>
  );
};
