import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useSales(businessId: string, filters?: any, limit = 50, offset = 0) {
  return useQuery({
    queryKey: ['sales', businessId, filters, limit, offset],
    queryFn: async () => {
      const res = await window.merqo.sale.list({ businessId, filters, limit, offset });
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data as any[];
    },
    enabled: !!businessId,
  });
}

export function useSale(id: string) {
  return useQuery({
    queryKey: ['sale', id],
    queryFn: async () => {
      const res = await window.merqo.sale.get(id);
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data as any;
    },
    enabled: !!id,
  });
}

export function useCreateSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const res = await window.merqo.sale.create(payload);
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales'] });
    },
  });
}

export function useCancelSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await window.merqo.sale.cancel({ id, reason });
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['sales'] });
      qc.invalidateQueries({ queryKey: ['sale', vars.id] });
    },
  });
}

export function useSaleReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const res = await window.merqo.sale.returnCreate(payload);
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['sales'] });
      qc.invalidateQueries({ queryKey: ['sale', vars.saleId] });
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
    enabled: !!businessId && query.length >= 2,
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

export function useFinanceAccounts(businessId: string) {
  const cashQuery = useQuery({
    queryKey: ['cash-accounts', businessId],
    queryFn: async () => {
      const res = await window.merqo.finance.cashAccounts(businessId);
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data as any[];
    },
    enabled: !!businessId,
  });

  const bankQuery = useQuery({
    queryKey: ['bank-accounts', businessId],
    queryFn: async () => {
      const res = await window.merqo.finance.bankAccounts(businessId);
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data as any[];
    },
    enabled: !!businessId,
  });

  const mfsQuery = useQuery({
    queryKey: ['mfs-accounts', businessId],
    queryFn: async () => {
      const res = await window.merqo.finance.mfsAccounts(businessId);
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data as any[];
    },
    enabled: !!businessId,
  });

  return { cashQuery, bankQuery, mfsQuery };
}
