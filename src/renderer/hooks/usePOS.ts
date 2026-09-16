import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

function unwrap<T>(res: any): T {
  if (!res) throw new Error('কোনো রেসপন্স পাওয়া যায়নি');
  if (res.success === false) {
    throw new Error(res.error?.messageBn || res.error?.message || 'একটি সমস্যা হয়েছে');
  }
  return (res.data ?? res) as T;
}

// Barcode lookup — returns array of {product, barcodeDetail, stockMilli, unit}
export function useProductByBarcode(businessId: string, barcode: string) {
  return useQuery({
    queryKey: ['pos', 'barcode', businessId, barcode],
    queryFn: async () => {
      if (!barcode || barcode.trim().length < 2) return [];
      const res = await window.merqo.pos.productByBarcode({ businessId, barcode: barcode.trim() });
      return unwrap<any[]>(res);
    },
    enabled: !!businessId && barcode.trim().length >= 2,
    staleTime: 0,
  });
}

export function usePOSProductSearch(businessId: string, query: string, limit = 20) {
  return useQuery({
    queryKey: ['pos', 'productSearch', businessId, query],
    queryFn: async () => {
      if (!query || query.trim().length < 2) return [];
      const res = await window.merqo.pos.productSearch({ businessId, query: query.trim(), limit });
      return unwrap<any[]>(res);
    },
    enabled: !!businessId && query.trim().length >= 2,
  });
}

export function useHeldSales(businessId: string) {
  return useQuery({
    queryKey: ['pos', 'heldSales', businessId],
    queryFn: async () => {
      const res = await window.merqo.pos.heldSalesList(businessId);
      return unwrap<any[]>(res);
    },
    enabled: !!businessId,
  });
}

export function useHoldSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { businessId: string; customerId?: string | null; cart: any; notes?: string }) => {
      const res = await window.merqo.pos.holdSale(payload);
      return unwrap<any>(res);
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['pos', 'heldSales', variables.businessId] });
    },
  });
}

export function useHeldSaleCancel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await window.merqo.pos.heldSaleCancel(id);
      return unwrap<any>(res);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos', 'heldSales'] });
    },
  });
}

export function useHeldSaleResume() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await window.merqo.pos.heldSaleResume(id);
      return unwrap<any>(res);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos', 'heldSales'] });
    },
  });
}

export function useCurrentShift(businessId: string) {
  return useQuery({
    queryKey: ['pos', 'currentShift', businessId],
    queryFn: async () => {
      const res = await window.merqo.pos.currentShift(businessId);
      return unwrap<any>(res);
    },
    enabled: !!businessId,
  });
}
