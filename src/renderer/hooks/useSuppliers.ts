import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useSuppliers(businessId?: string) {
  return useQuery({
    queryKey: ['suppliers', businessId],
    queryFn: async () => {
      const res = await window.merqo.supplier.list(businessId || '');
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data as any[];
    },
  });
}

export function useSupplierSearch(businessId: string, query: string, includeInactive = false) {
  return useQuery({
    queryKey: ['supplier-search', businessId, query, includeInactive],
    queryFn: async () => {
      const res = await window.merqo.supplier.search({ businessId, query, includeInactive });
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data as any[];
    },
    enabled: true,
  });
}

export function useSupplier(id: string) {
  return useQuery({
    queryKey: ['supplier', id],
    queryFn: async () => {
      const res = await window.merqo.supplier.get(id);
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useSupplierStatement(supplierId: string, fromDate?: number, toDate?: number) {
  return useQuery({
    queryKey: ['supplier-statement', supplierId, fromDate, toDate],
    queryFn: async () => {
      const res = await window.merqo.supplier.statement({ supplierId, fromDate, toDate });
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data as any;
    },
    enabled: !!supplierId,
  });
}

export function useCreateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const res = await window.merqo.supplier.create(payload);
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      qc.invalidateQueries({ queryKey: ['supplier-search'] });
    },
  });
}

export function useUpdateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await window.merqo.supplier.update({ id, data });
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      qc.invalidateQueries({ queryKey: ['supplier', vars.id] });
    },
  });
}

export function useDeactivateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await window.merqo.supplier.deactivate(id);
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  });
}

export function useSupplierPay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const res = await window.merqo.supplier.pay(payload);
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      qc.invalidateQueries({ queryKey: ['supplier-statement', vars.supplierId] });
      qc.invalidateQueries({ queryKey: ['supplier', vars.supplierId] });
    },
  });
}
