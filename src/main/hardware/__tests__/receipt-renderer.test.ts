import { describe, it, expect } from 'vitest';
import { renderReceiptHtml, renderInvoiceA4Html, renderTestPageHtml } from '../receipt-renderer';
import type { ReceiptData } from '../printer.types';

function makeReceiptData(): ReceiptData {
  return {
    sale: {
      id: 'sale_test_123456',
      saleNumber: 'SAL-0001',
      saleDate: Date.now(),
      subtotalPaisa: 100000,
      discountPaisa: 5000,
      taxPaisa: 0,
      totalPaisa: 95000,
      paidPaisa: 100000,
      duePaisa: 0,
      notes: 'Test sale',
    },
    items: [
      {
        productName: 'চাল ১ কেজি',
        quantity: 2,
        quantityMilli: 2000,
        unitShortName: 'কেজি',
        unitPricePaisa: 8500,
        lineTotalPaisa: 17000,
        discountPaisa: 0,
      },
      {
        productName: 'Premium Miniket Rice 50kg Special Quality Long Name Test',
        quantity: 1,
        quantityMilli: 1000,
        unitShortName: 'বস্তা',
        unitPricePaisa: 350000,
        lineTotalPaisa: 350000,
        discountPaisa: 0,
      },
      {
        productName: 'ডাল',
        quantity: 1,
        quantityMilli: 1000,
        unitShortName: 'কেজি',
        unitPricePaisa: 12000,
        lineTotalPaisa: 12000,
        discountPaisa: 0,
      },
    ],
    business: {
      name: 'MERQO Test Shop',
      tradeName: 'MERQO টেস্ট দোকান',
      address: '১২৩ মেইন রোড, ঢাকা',
      phone: '01712345678',
      email: 'test@merqo.com',
    },
    customer: {
      name: 'রহিম উদ্দিন',
      phone: '01798765432',
    },
    payments: [
      { method: 'cash', amountPaisa: 50000 },
      { method: 'bkash', amountPaisa: 50000 },
    ],
    cashier: 'করিম',
    changePaisa: 5000,
  };
}

describe('Receipt Renderer — P4.2', () => {
  it('should render 58mm receipt with Bengali', () => {
    const data = makeReceiptData();
    const html = renderReceiptHtml(data, '58mm');
    expect(html).toContain('58mm');
    expect(html).toContain('চাল');
    expect(html).toContain('SAL-0001');
    expect(html).toContain('৳');
    expect(html).toContain('ধন্যবাদ');
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('null');
  });

  it('should render 80mm receipt with Bengali and all fields', () => {
    const data = makeReceiptData();
    const html = renderReceiptHtml(data, '80mm');
    expect(html).toContain('80mm');
    expect(html).toContain('MERQO টেস্ট দোকান');
    expect(html).toContain('১২৩ মেইন রোড');
    expect(html).toContain('রহিম উদ্দিন');
    expect(html).toContain('করিম');
    expect(html).toContain('নগদ');
    expect(html).toContain('বিকাশ');
    expect(html).toContain('ফেরত');
    expect(html).toContain('SAL-0001');
    // Check totals
    expect(html).toContain('সাবটোটাল');
    expect(html).toContain('মোট');
    expect(html).toContain('পরিশোধিত');
  });

  it('should omit empty business fields cleanly (no placeholder)', () => {
    const data = makeReceiptData();
    data.business = { name: 'Test Shop' } as any;
    data.customer = null;
    const html = renderReceiptHtml(data, '80mm', { showCustomer: true });
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('null');
    expect(html).not.toContain('ফোন: undefined');
    // Customer omitted
    expect(html).not.toContain('রহিম');
  });

  it('should render A4 invoice with Bengali and correct structure', () => {
    const data = makeReceiptData();
    const html = renderInvoiceA4Html(data);
    expect(html).toContain('A4');
    expect(html).toContain('ইনভয়েস');
    expect(html).toContain('SAL-0001');
    expect(html).toContain('চাল');
    expect(html).toContain('গ্রাহক');
    expect(html).toContain('পণ্য');
    expect(html).toContain('মোট');
    expect(html).toContain('MERQO টেস্ট দোকান');
    expect(html).not.toContain('undefined');
  });

  it('should handle long Bengali product names with wrapping', () => {
    const data = makeReceiptData();
    data.items[0].productName = 'প্রিমিয়াম মিনিকেট চাল ৫০ কেজি বস্তা স্পেশাল কোয়ালিটি এক্সট্রা লং নাম টেস্ট';
    const html58 = renderReceiptHtml(data, '58mm');
    const html80 = renderReceiptHtml(data, '80mm');
    expect(html58).toContain('প্রিমিয়াম মিনিকেট');
    expect(html80).toContain('প্রিমিয়াম মিনিকেট');
    // Check word-wrap CSS exists
    expect(html58).toContain('word-wrap');
  });

  it('should render payment methods in Bengali', () => {
    const data = makeReceiptData();
    const html = renderReceiptHtml(data, '80mm');
    expect(html).toContain('নগদ');
    expect(html).toContain('বিকাশ');
  });

  it('should render due and change correctly', () => {
    const data = makeReceiptData();
    data.sale.duePaisa = 10000;
    data.changePaisa = 0;
    const htmlDue = renderReceiptHtml(data, '80mm');
    expect(htmlDue).toContain('বাকি');

    data.sale.duePaisa = 0;
    data.changePaisa = 5000;
    const htmlChange = renderReceiptHtml(data, '80mm');
    expect(htmlChange).toContain('ফেরত');
  });

  it('should render test page with Bengali', () => {
    const html = renderTestPageHtml('Test Printer 80mm');
    expect(html).toContain('প্রিন্টার টেস্ট');
    expect(html).toContain('চাল, ডাল');
    expect(html).toContain('Test Printer 80mm');
  });

  it('should be width-aware — 58mm vs 80mm different font sizes', () => {
    const data = makeReceiptData();
    const html58 = renderReceiptHtml(data, '58mm');
    const html80 = renderReceiptHtml(data, '80mm');
    // 58mm uses 10px, 80mm uses 11px
    expect(html58).toContain('10px');
    expect(html80).toContain('11px');
    expect(html58).toContain('58mm');
    expect(html80).toContain('80mm');
  });

  it('should not show fake business info', () => {
    const data = makeReceiptData();
    data.business = null;
    const html = renderReceiptHtml(data, '80mm');
    // Should fallback to MERQO RetailOS, not fake
    expect(html).toContain('MERQO RetailOS');
    expect(html).not.toContain('undefined');
  });

  it('should sanitize HTML to prevent injection', () => {
    const data = makeReceiptData();
    data.items[0].productName = '<script>alert(1)</script> চাল';
    const html = renderReceiptHtml(data, '80mm');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
