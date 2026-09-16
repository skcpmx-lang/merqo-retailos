/** Money paisa -> BDT, quantity milli -> units */

export function formatBDT(paisa: number | null | undefined): string {
  if (paisa === null || paisa === undefined) return '৳০.০০';
  const taka = paisa / 100;
  return new Intl.NumberFormat('bn-BD', { style: 'currency', currency: 'BDT', minimumFractionDigits: 2 }).format(taka);
}

export function formatBDTEn(paisa: number | null | undefined): string {
  if (paisa === null || paisa === undefined) return '৳0.00';
  const taka = paisa / 100;
  return `৳${taka.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatQty(milli: number | null | undefined): string {
  if (milli === null || milli === undefined) return '০';
  const units = milli / 1000;
  return units.toLocaleString('bn-BD', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

export function formatQtyEn(milli: number | null | undefined): string {
  if (milli === null || milli === undefined) return '0';
  const units = milli / 1000;
  return units.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

export function formatDate(ts: number | null | undefined): string {
  if (!ts) return '-';
  return new Date(ts).toLocaleDateString('bn-BD');
}

export function formatDateTime(ts: number | null | undefined): string {
  if (!ts) return '-';
  return new Date(ts).toLocaleString('bn-BD');
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return `${value.toFixed(2)}%`;
}
