import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useCustomers(businessId?: string) {
  return useQuery({
    queryKey: ['customers', businessId],
    queryFn: async () => {
      const res = await window.merqo.customer.list(businessId || '');
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data as any[];
    },
  });
}

export function useCustomerSearch(businessId: string, query: string, includeInactive = false) {
  return useQuery({
    queryKey: ['customer-search', businessId, query, includeInactive],
    queryFn: async () => {
      const res = await window.merqo.customer.search({ businessId, query, includeInactive });
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data as any[];
    },
    enabled: true,
  });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      const res = await window.merqo.customer.get(id);
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useCustomerStatement(customerId: string, fromDate?: number, toDate?: number) {
  return useQuery({
    queryKey: ['customer-statement', customerId, fromDate, toDate],
    queryFn: async () => {
      const res = await window.merqo.customer.statement({ customerId, fromDate, toDate });
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data as any;
    },
    enabled: !!customerId,
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const res = await window.merqo.customer.create(payload);
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['customer-search'] });
    },
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await window.merqo.customer.update({ id, data });
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['customer', vars.id] });
    },
  });
}

export function useDeactivateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await window.merqo.customer.deactivate(id);
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });
}

export function useActivateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await window.merqo.customer.activate(id);
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });
}

export function useCustomerCollect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const res = await window.merqo.customer.collect(payload);
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['customer-statement', vars.customerId] });
      qc.invalidateQueries({ queryKey: ['customer', vars.customerId] });
    },
  });
}
