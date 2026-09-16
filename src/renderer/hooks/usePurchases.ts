import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function usePurchases(businessId: string, filters?: any, limit = 50, offset = 0) {
  return useQuery({
    queryKey: ['purchases', businessId, filters, limit, offset],
    queryFn: async () => {
      const res = await window.merqo.purchase.list({ businessId, filters, limit, offset });
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data as any[];
    },
    enabled: !!businessId,
  });
}

export function usePurchase(id: string) {
  return useQuery({
    queryKey: ['purchase', id],
    queryFn: async () => {
      const res = await window.merqo.purchase.get(id);
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data as any;
    },
    enabled: !!id,
  });
}

export function useCreatePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const res = await window.merqo.purchase.create(payload);
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchases'] });
      qc.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
}

export function useCancelPurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await window.merqo.purchase.cancel({ id, reason });
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchases'] }),
  });
}

export function useCreatePurchaseReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const res = await window.merqo.purchase.returnCreate(payload);
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchases'] });
      qc.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
}

export function useProductSearch(businessId: string, query: string) {
  return useQuery({
    queryKey: ['product-search', businessId, query],
    queryFn: async () => {
      if (!query || query.length < 2) return [];
      const res = await window.merqo.product.search({ businessId, query });
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data as any[];
    },
    enabled: !!businessId && !!query && query.length >= 2,
  });
}

export function useUnits(businessId: string) {
  return useQuery({
    queryKey: ['units', businessId],
    queryFn: async () => {
      const res = await window.merqo.unit.list(businessId);
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data as any[];
    },
    enabled: !!businessId,
  });
}

export function useUnitConversions(businessId: string) {
  return useQuery({
    queryKey: ['unit-conversions', businessId],
    queryFn: async () => {
      const res = await window.merqo.unit.conversions(businessId);
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data as any[];
    },
    enabled: !!businessId,
  });
}
