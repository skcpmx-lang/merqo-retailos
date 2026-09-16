import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useCashAccounts(businessId: string, includeInactive = false) {
  return useQuery({
    queryKey: ['cash-accounts', businessId, includeInactive],
    queryFn: async () => {
      const res = await window.merqo.finance.cashAccounts(businessId);
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data as any[];
    },
    enabled: !!businessId,
  });
}

export function useBankAccounts(businessId: string) {
  return useQuery({
    queryKey: ['bank-accounts', businessId],
    queryFn: async () => {
      const res = await window.merqo.finance.bankAccounts(businessId);
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data as any[];
    },
    enabled: !!businessId,
  });
}

export function useMfsAccounts(businessId: string) {
  return useQuery({
    queryKey: ['mfs-accounts', businessId],
    queryFn: async () => {
      const res = await window.merqo.finance.mfsAccounts(businessId);
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data as any[];
    },
    enabled: !!businessId,
  });
}

export function useMfsProviders() {
  return useQuery({
    queryKey: ['mfs-providers'],
    queryFn: async () => {
      const res = await window.merqo.finance.mfsProviders();
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data as any[];
    },
  });
}

export function useFinanceDashboard(businessId: string) {
  return useQuery({
    queryKey: ['finance-dashboard', businessId],
    queryFn: async () => {
      const res = await window.merqo.finance.dashboard(businessId);
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data as any;
    },
    enabled: !!businessId,
  });
}

export function useCashStatement(accountId: string, fromDate?: number, toDate?: number) {
  return useQuery({
    queryKey: ['cash-statement', accountId, fromDate, toDate],
    queryFn: async () => {
      const res = await window.merqo.finance.cashAccountStatement({ accountId, fromDate, toDate });
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data as any[];
    },
    enabled: !!accountId,
  });
}

export function useBankStatement(accountId: string, fromDate?: number, toDate?: number) {
  return useQuery({
    queryKey: ['bank-statement', accountId, fromDate, toDate],
    queryFn: async () => {
      const res = await window.merqo.finance.bankAccountStatement({ accountId, fromDate, toDate });
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data as any[];
    },
    enabled: !!accountId,
  });
}

export function useMfsStatement(accountId: string, fromDate?: number, toDate?: number) {
  return useQuery({
    queryKey: ['mfs-statement', accountId, fromDate, toDate],
    queryFn: async () => {
      const res = await window.merqo.finance.mfsAccountStatement({ accountId, fromDate, toDate });
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data as any[];
    },
    enabled: !!accountId,
  });
}

export function useExpenses(businessId: string, limit = 50, offset = 0, filters?: any) {
  return useQuery({
    queryKey: ['expenses', businessId, limit, offset, filters],
    queryFn: async () => {
      const res = await window.merqo.finance.expenses({ businessId, limit, offset, filters });
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data as any[];
    },
    enabled: !!businessId,
  });
}

export function useExpenseCategories(businessId: string) {
  return useQuery({
    queryKey: ['expense-categories', businessId],
    queryFn: async () => {
      const res = await window.merqo.finance.expenseCategories(businessId);
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data as any[];
    },
    enabled: !!businessId,
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const res = await window.merqo.finance.expenseCreate(payload);
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['finance-dashboard'] });
      qc.invalidateQueries({ queryKey: ['cash-accounts'] });
      qc.invalidateQueries({ queryKey: ['bank-accounts'] });
      qc.invalidateQueries({ queryKey: ['mfs-accounts'] });
    },
  });
}

export function useVoidExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id: string; reason: string; businessId: string }) => {
      const res = await window.merqo.finance.expenseVoid(payload);
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['finance-dashboard'] });
    },
  });
}

export function useTransfers(businessId: string) {
  return useQuery({
    queryKey: ['transfers', businessId],
    queryFn: async () => {
      const res = await window.merqo.finance.transfers(businessId);
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data as any[];
    },
    enabled: !!businessId,
  });
}

export function useCreateTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const res = await window.merqo.finance.cashTransfer(payload);
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transfers'] });
      qc.invalidateQueries({ queryKey: ['finance-dashboard'] });
      qc.invalidateQueries({ queryKey: ['cash-accounts'] });
      qc.invalidateQueries({ queryKey: ['bank-accounts'] });
      qc.invalidateQueries({ queryKey: ['mfs-accounts'] });
    },
  });
}

export function useMfsCashIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const res = await window.merqo.finance.mfsCashIn(payload);
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance-dashboard'] });
      qc.invalidateQueries({ queryKey: ['cash-accounts'] });
      qc.invalidateQueries({ queryKey: ['mfs-accounts'] });
    },
  });
}

export function useMfsCashOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const res = await window.merqo.finance.mfsCashOut(payload);
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance-dashboard'] });
      qc.invalidateQueries({ queryKey: ['cash-accounts'] });
      qc.invalidateQueries({ queryKey: ['mfs-accounts'] });
    },
  });
}

export function useShifts(businessId: string) {
  return useQuery({
    queryKey: ['shifts', businessId],
    queryFn: async () => {
      const res = await window.merqo.shift.list(businessId);
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data as any[];
    },
    enabled: !!businessId,
  });
}

export function useCurrentShift(businessId: string) {
  return useQuery({
    queryKey: ['current-shift', businessId],
    queryFn: async () => {
      const res = await window.merqo.shift.current(businessId);
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data as any;
    },
    enabled: !!businessId,
  });
}

export function useOpenShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const res = await window.merqo.shift.open(payload);
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shifts'] });
      qc.invalidateQueries({ queryKey: ['current-shift'] });
    },
  });
}

export function useCloseShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { shiftId: string; actualCashPaisa: number; notes?: string }) => {
      const res = await window.merqo.shift.close(payload);
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shifts'] });
      qc.invalidateQueries({ queryKey: ['current-shift'] });
    },
  });
}

export function useShiftReconciliation(shiftId: string) {
  return useQuery({
    queryKey: ['shift-reconciliation', shiftId],
    queryFn: async () => {
      const res = await window.merqo.shift.reconciliation(shiftId);
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data as any;
    },
    enabled: !!shiftId,
  });
}

export function useCreateCashAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const res = await window.merqo.finance.cashAccountCreate(payload);
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cash-accounts'] });
      qc.invalidateQueries({ queryKey: ['finance-dashboard'] });
    },
  });
}

export function useCreateBankAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const res = await window.merqo.finance.bankAccountCreate(payload);
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-accounts'] });
      qc.invalidateQueries({ queryKey: ['finance-dashboard'] });
    },
  });
}

export function useCreateMfsAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const res = await window.merqo.finance.mfsAccountCreate(payload);
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mfs-accounts'] });
      qc.invalidateQueries({ queryKey: ['finance-dashboard'] });
    },
  });
}
