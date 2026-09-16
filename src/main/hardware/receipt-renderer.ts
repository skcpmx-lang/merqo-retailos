/**
 * Receipt & Invoice HTML renderer — P4.2
 * Generates width-aware HTML for thermal (58mm/80mm) and A4
 * Bengali-first, Noto Sans Bengali, no fake business data, omits empty fields
 */

import type { ReceiptData, PaperWidth } from './printer.types';

function formatPaisa(paisa: number): string {
  const taka = paisa / 100;
  return `৳${taka.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatQty(qty: number): string {
  return qty % 1 === 0 ? qty.toString() : qty.toFixed(3).replace(/\.?0+$/, '');
}

function formatDate(ts: number): string {
  try {
    return new Date(ts).toLocaleString('bn-BD', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return new Date(ts).toISOString();
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function paymentMethodLabel(method: string): string {
  const map: Record<string, string> = {
    cash: 'নগদ',
    bank: 'ব্যাংক',
    card: 'কার্ড',
    cheque: 'চেক',
    bkash: 'বিকাশ',
    nagad: 'নগদ (MFS)',
    rocket: 'রকেট',
    upay: 'উপায়',
  };
  return map[method] || method;
}

export function renderReceiptHtml(data: ReceiptData, width: PaperWidth = '80mm', opts?: { showBarcode?: boolean; showCustomer?: boolean; footer?: string }): string {
  const paperWidth = width === '58mm' ? '58mm' : '80mm';
  const printableWidth = width === '58mm' ? '54mm' : '76mm';
  const fontSize = width === '58mm' ? '10px' : '11px';
  const smallFont = width === '58mm' ? '8px' : '9px';
  const headingSize = width === '58mm' ? '12px' : '14px';

  const businessName = data.business?.tradeName || data.business?.name || 'MERQO RetailOS';
  const businessAddress = data.business?.address;
  const businessPhone = data.business?.phone;

  const showCustomer = opts?.showCustomer !== false && !!data.customer;
  const showBarcode = opts?.showBarcode !== false;
  const footer = opts?.footer || 'ধন্যবাদ, আবার আসবেন';

  const itemsHtml = data.items
    .map(
      (item, idx) => `
    <div class="item">
      <div class="item-name">${idx + 1}. ${escapeHtml(item.productName)}</div>
      <div class="item-detail">
        <span>${formatQty(item.quantity)} ${escapeHtml(item.unitShortName)} × ${formatPaisa(item.unitPricePaisa)}</span>
        <span class="item-total">${formatPaisa(item.lineTotalPaisa)}</span>
      </div>
      ${item.discountPaisa > 0 ? `<div class="item-discount">ছাড়: ${formatPaisa(item.discountPaisa)}</div>` : ''}
    </div>
  `
    )
    .join('');

  const paymentsHtml = data.payments && data.payments.length > 0
    ? `
    <div class="section">
      <div class="section-title">পেমেন্ট</div>
      ${data.payments.map(p => `
        <div class="row"><span>${escapeHtml(paymentMethodLabel(p.method))}</span><span>${formatPaisa(p.amountPaisa)}</span></div>
      `).join('')}
      ${data.changePaisa && data.changePaisa > 0 ? `<div class="row highlight"><span>ফেরত</span><span>${formatPaisa(data.changePaisa)}</span></div>` : ''}
    </div>
  `
    : '';

  const change = data.changePaisa || (data.sale.paidPaisa > data.sale.totalPaisa ? data.sale.paidPaisa - data.sale.totalPaisa : 0);
  const due = data.sale.duePaisa || (data.sale.totalPaisa > data.sale.paidPaisa ? data.sale.totalPaisa - data.sale.paidPaisa : 0);

  return `
<!DOCTYPE html>
<html lang="bn">
<head>
<meta charset="UTF-8">
<style>
  @page { size: ${paperWidth} auto; margin: 2mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${printableWidth};
    font-family: 'Noto Sans Bengali', 'Noto Sans', 'Inter', system-ui, sans-serif;
    font-size: ${fontSize};
    line-height: 1.4;
    color: #111;
    background: white;
    padding: 2mm;
  }
  .center { text-align: center; }
  .business-name { font-size: ${headingSize}; font-weight: 700; margin-bottom: 2px; word-wrap: break-word; }
  .business-meta { font-size: ${smallFont}; color: #444; word-wrap: break-word; }
  .divider { border-top: 1px dashed #999; margin: 6px 0; }
  .divider-bold { border-top: 1px solid #111; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; padding: 1px 0; }
  .row.highlight { font-weight: 700; background: #f5f5f5; padding: 3px 2px; }
  .section { margin: 6px 0; }
  .section-title { font-weight: 700; font-size: ${fontSize}; border-bottom: 1px solid #ddd; padding-bottom: 2px; margin-bottom: 4px; }
  .item { padding: 3px 0; border-bottom: 1px dotted #eee; }
  .item-name { font-weight: 600; word-wrap: break-word; white-space: normal; }
  .item-detail { display: flex; justify-content: space-between; font-size: ${smallFont}; }
  .item-total { font-weight: 600; }
  .item-discount { font-size: ${smallFont}; color: #666; }
  .total-row { display: flex; justify-content: space-between; font-weight: 700; font-size: ${width === '58mm' ? '11px' : '13px'}; padding: 2px 0; }
  .sale-meta { font-size: ${smallFont}; }
  .footer { text-align: center; font-size: ${smallFont}; margin-top: 8px; padding-top: 6px; border-top: 1px dashed #999; }
  .barcode { text-align: center; margin: 6px 0; font-family: monospace; font-size: ${smallFont}; letter-spacing: 2px; }
  .no-overflow { overflow: hidden; word-wrap: break-word; }
</style>
</head>
<body>
  <div class="center">
    <div class="business-name no-overflow">${escapeHtml(businessName)}</div>
    ${businessAddress ? `<div class="business-meta no-overflow">${escapeHtml(businessAddress)}</div>` : ''}
    ${businessPhone ? `<div class="business-meta">ফোন: ${escapeHtml(businessPhone)}</div>` : ''}
  </div>

  <div class="divider"></div>

  <div class="sale-meta">
    <div class="row"><span>ইনভয়েস:</span><span style="font-weight:700">${escapeHtml(data.sale.saleNumber)}</span></div>
    <div class="row"><span>তারিখ:</span><span>${formatDate(data.sale.saleDate)}</span></div>
    ${data.cashier ? `<div class="row"><span>ক্যাশিয়ার:</span><span>${escapeHtml(data.cashier)}</span></div>` : ''}
    ${showCustomer && data.customer ? `<div class="row"><span>গ্রাহক:</span><span>${escapeHtml(data.customer.name)}${data.customer.phone ? ' (' + escapeHtml(data.customer.phone) + ')' : ''}</span></div>` : ''}
  </div>

  <div class="divider"></div>

  <div class="section">
    <div class="section-title">পণ্য (${data.items.length} টি)</div>
    ${itemsHtml}
  </div>

  <div class="divider-bold"></div>

  <div class="section">
    <div class="row"><span>সাবটোটাল</span><span>${formatPaisa(data.sale.subtotalPaisa)}</span></div>
    ${data.sale.discountPaisa > 0 ? `<div class="row"><span>ছাড়</span><span>-${formatPaisa(data.sale.discountPaisa)}</span></div>` : ''}
    ${data.sale.taxPaisa > 0 ? `<div class="row"><span>ট্যাক্স</span><span>${formatPaisa(data.sale.taxPaisa)}</span></div>` : ''}
    <div class="total-row"><span>মোট</span><span>${formatPaisa(data.sale.totalPaisa)}</span></div>
    <div class="row"><span>পরিশোধিত</span><span>${formatPaisa(data.sale.paidPaisa)}</span></div>
    ${due > 0 ? `<div class="row highlight"><span>বাকি</span><span>${formatPaisa(due)}</span></div>` : ''}
    ${change > 0 ? `<div class="row highlight"><span>ফেরত</span><span>${formatPaisa(change)}</span></div>` : ''}
  </div>

  ${paymentsHtml}

  ${showBarcode ? `<div class="barcode">*${escapeHtml(data.sale.saleNumber)}*</div>` : ''}

  <div class="footer">
    <div>${escapeHtml(footer)}</div>
    <div style="margin-top:4px; font-size:${smallFont}">MERQO RetailOS • ${new Date().toLocaleDateString('bn-BD')}</div>
  </div>
</body>
</html>
`;
}

export function renderInvoiceA4Html(data: ReceiptData, opts?: { showBarcode?: boolean; showCustomer?: boolean; footer?: string }): string {
  const businessName = data.business?.tradeName || data.business?.name || 'MERQO RetailOS';
  const footer = opts?.footer || 'ধন্যবাদ, আবার আসবেন';

  const itemsRows = data.items
    .map(
      (item, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td class="left">${escapeHtml(item.productName)}</td>
      <td>${formatQty(item.quantity)} ${escapeHtml(item.unitShortName)}</td>
      <td class="right">${formatPaisa(item.unitPricePaisa)}</td>
      <td class="right">${item.discountPaisa > 0 ? formatPaisa(item.discountPaisa) : '-'}</td>
      <td class="right bold">${formatPaisa(item.lineTotalPaisa)}</td>
    </tr>
  `
    )
    .join('');

  const paymentsHtml = data.payments && data.payments.length > 0
    ? data.payments.map(p => `<div class="row"><span>${escapeHtml(paymentMethodLabel(p.method))}</span><span>${formatPaisa(p.amountPaisa)}</span></div>`).join('')
    : '<div class="muted">কোনো পেমেন্ট তথ্য নেই</div>';

  const due = data.sale.duePaisa || (data.sale.totalPaisa > data.sale.paidPaisa ? data.sale.totalPaisa - data.sale.paidPaisa : 0);
  const change = data.changePaisa || (data.sale.paidPaisa > data.sale.totalPaisa ? data.sale.paidPaisa - data.sale.totalPaisa : 0);

  return `
<!DOCTYPE html>
<html lang="bn">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 15mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Noto Sans Bengali', 'Inter', system-ui, sans-serif;
    font-size: 11px;
    line-height: 1.5;
    color: #111;
    background: white;
    padding: 15mm;
  }
  .header { display: flex; justify-content: space-between; border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 15px; }
  .business-name { font-size: 20px; font-weight: 800; }
  .business-meta { font-size: 11px; color: #444; margin-top: 2px; }
  .invoice-title { text-align: right; }
  .invoice-title h1 { font-size: 22px; font-weight: 800; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px; }
  .box { border: 1px solid #ddd; padding: 10px; border-radius: 4px; }
  .box-title { font-weight: 700; font-size: 12px; border-bottom: 1px solid #eee; padding-bottom: 4px; margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; }
  th { background: #f8f9fb; font-weight: 700; text-align: left; padding: 8px 6px; border: 1px solid #ddd; font-size: 10px; }
  td { padding: 6px; border: 1px solid #ddd; font-size: 11px; }
  td.right { text-align: right; font-family: monospace; }
  td.left { text-align: left; }
  td.bold { font-weight: 700; }
  .totals { width: 300px; margin-left: auto; margin-top: 10px; border: 1px solid #ddd; }
  .totals .row { display: flex; justify-content: space-between; padding: 6px 10px; border-bottom: 1px solid #eee; }
  .totals .row.total { font-weight: 800; font-size: 13px; background: #f8f9fb; }
  .totals .row.due { background: #fef2f2; color: #dc2626; font-weight: 700; }
  .totals .row.change { background: #f0fdf4; color: #16a34a; font-weight: 700; }
  .payments { margin-top: 15px; }
  .footer { text-align: center; margin-top: 30px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 10px; color: #666; }
  .muted { color: #888; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="business-name">${escapeHtml(businessName)}</div>
      ${data.business?.address ? `<div class="business-meta">${escapeHtml(data.business.address)}</div>` : ''}
      ${data.business?.phone ? `<div class="business-meta">ফোন: ${escapeHtml(data.business.phone)}</div>` : ''}
      ${data.business?.email ? `<div class="business-meta">ইমেইল: ${escapeHtml(data.business.email)}</div>` : ''}
    </div>
    <div class="invoice-title">
      <h1>ইনভয়েস</h1>
      <div style="font-weight:700; font-size:14px; margin-top:4px;">${escapeHtml(data.sale.saleNumber)}</div>
      <div style="font-size:11px; margin-top:2px;">${formatDate(data.sale.saleDate)}</div>
    </div>
  </div>

  <div class="meta-grid">
    <div class="box">
      <div class="box-title">গ্রাহক</div>
      ${data.customer ? `
        <div><strong>${escapeHtml(data.customer.name)}</strong></div>
        ${data.customer.phone ? `<div>ফোন: ${escapeHtml(data.customer.phone)}</div>` : ''}
      ` : '<div class="muted">ওয়াক-ইন গ্রাহক</div>'}
    </div>
    <div class="box">
      <div class="box-title">বিক্রয় তথ্য</div>
      <div>ইনভয়েস: ${escapeHtml(data.sale.saleNumber)}</div>
      <div>তারিখ: ${formatDate(data.sale.saleDate)}</div>
      ${data.cashier ? `<div>ক্যাশিয়ার: ${escapeHtml(data.cashier)}</div>` : ''}
      ${data.sale.notes ? `<div>নোট: ${escapeHtml(data.sale.notes)}</div>` : ''}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>পণ্য</th>
        <th>পরিমাণ</th>
        <th class="right">দাম</th>
        <th class="right">ছাড়</th>
        <th class="right">মোট</th>
      </tr>
    </thead>
    <tbody>
      ${itemsRows}
    </tbody>
  </table>

  <div class="totals">
    <div class="row"><span>সাবটোটাল</span><span>${formatPaisa(data.sale.subtotalPaisa)}</span></div>
    ${data.sale.discountPaisa > 0 ? `<div class="row"><span>ছাড়</span><span>-${formatPaisa(data.sale.discountPaisa)}</span></div>` : ''}
    ${data.sale.taxPaisa > 0 ? `<div class="row"><span>ট্যাক্স</span><span>${formatPaisa(data.sale.taxPaisa)}</span></div>` : ''}
    <div class="row total"><span>মোট</span><span>${formatPaisa(data.sale.totalPaisa)}</span></div>
    <div class="row"><span>পরিশোধিত</span><span>${formatPaisa(data.sale.paidPaisa)}</span></div>
    ${due > 0 ? `<div class="row due"><span>বাকি</span><span>${formatPaisa(due)}</span></div>` : ''}
    ${change > 0 ? `<div class="row change"><span>ফেরত</span><span>${formatPaisa(change)}</span></div>` : ''}
  </div>

  <div class="payments box" style="margin-top:15px;">
    <div class="box-title">পেমেন্ট বিবরণ</div>
    ${paymentsHtml}
  </div>

  <div class="footer">
    <div>${escapeHtml(footer)}</div>
    <div style="margin-top:6px;">MERQO RetailOS • ${new Date().toLocaleDateString('bn-BD')} • প্রিন্ট সময়: ${new Date().toLocaleTimeString('bn-BD')}</div>
  </div>
</body>
</html>
`;
}

export function renderTestPageHtml(printerName: string): string {
  return `
<!DOCTYPE html>
<html lang="bn">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: 'Noto Sans Bengali', sans-serif; padding: 20px; color: #111; }
  h1 { font-size: 18px; }
  .test { border: 1px dashed #999; padding: 10px; margin: 10px 0; }
  .bengali { font-size: 14px; line-height: 1.6; }
</style>
</head>
<body>
  <h1>MERQO RetailOS — প্রিন্টার টেস্ট</h1>
  <div>প্রিন্টার: ${escapeHtml(printerName)}</div>
  <div>সময়: ${new Date().toLocaleString('bn-BD')}</div>
  <div class="test">
    <div class="bengali">
      <p>বাংলা টেস্ট: চাল, ডাল, তেল, লবণ, চিনি</p>
      <p>English Test: Rice, Lentils, Oil, Salt, Sugar</p>
      <p>Mixed: চাল ১ কেজি - ৳ ৮৫.৫০</p>
      <p>Numbers: ০১২৩৪৫৬৭৮৯ — ৳ ১,২৩৪.৫৬</p>
      <p>Long product name test: প্রিমিয়াম মিনিকেট চাল ৫০ কেজি বস্তা স্পেশাল কোয়ালিটি</p>
    </div>
  </div>
  <div style="text-align:center; margin-top:20px; font-size:10px;">MERQO RetailOS • Test Print • ${new Date().toISOString()}</div>
</body>
</html>
`;
}
