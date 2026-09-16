import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

function unwrap<T>(res: any): T {
  if (!res) throw new Error('কোনো রেসপন্স পাওয়া যায়নি');
  if (res.success === false) {
    throw new Error(res.error?.messageBn || res.error?.message || 'একটি সমস্যা হয়েছে');
  }
  return (res.data ?? res) as T;
}

export function usePrinters() {
  return useQuery({
    queryKey: ['hardware', 'printers'],
    queryFn: async () => {
      const res = await window.merqo.hardware.getPrinters();
      return unwrap<{ printers: any[] }>(res);
    },
    staleTime: 1000 * 30, // 30s
  });
}

export function useDefaultPrinter() {
  return useQuery({
    queryKey: ['hardware', 'defaultPrinter'],
    queryFn: async () => {
      const res = await window.merqo.hardware.getDefaultPrinter();
      return unwrap<any>(res);
    },
  });
}

export function useConfiguredPrinter() {
  return useQuery({
    queryKey: ['hardware', 'configuredPrinter'],
    queryFn: async () => {
      const res = await window.merqo.hardware.getConfiguredPrinter();
      return unwrap<any>(res);
    },
  });
}

export function useSavePrinterConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (config: any) => {
      const res = await window.merqo.hardware.savePrinterConfig(config);
      return unwrap<any>(res);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hardware', 'configuredPrinter'] });
      qc.invalidateQueries({ queryKey: ['hardware', 'diagnostics'] });
    },
  });
}

export function usePrinterStatus(printerId: string) {
  return useQuery({
    queryKey: ['hardware', 'printerStatus', printerId],
    queryFn: async () => {
      if (!printerId) return null;
      const res = await window.merqo.hardware.getPrinterStatus(printerId);
      return unwrap<any>(res);
    },
    enabled: !!printerId,
  });
}

export function useTestPrinter() {
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await window.merqo.hardware.testPrinter(id);
      return unwrap<any>(res);
    },
  });
}

export function usePrintReceipt() {
  return useMutation({
    mutationFn: async (payload: { saleId: string; printerId?: string; printerName?: string; paperWidth?: string; copies?: number }) => {
      const res = await window.merqo.hardware.printReceipt(payload);
      return unwrap<any>(res);
    },
  });
}

export function usePrintInvoice() {
  return useMutation({
    mutationFn: async (payload: { saleId: string; printerId?: string; printerName?: string; copies?: number }) => {
      const res = await window.merqo.hardware.printInvoice(payload);
      return unwrap<any>(res);
    },
  });
}

export function useReprintReceipt() {
  return useMutation({
    mutationFn: async (payload: { saleId: string; printerId?: string; printerName?: string; paperWidth?: string; copies?: number }) => {
      const res = await window.merqo.hardware.reprintReceipt(payload);
      return unwrap<any>(res);
    },
  });
}

export function useScannerConfig() {
  return useQuery({
    queryKey: ['hardware', 'scannerConfig'],
    queryFn: async () => {
      const res = await window.merqo.hardware.getScannerConfig();
      return unwrap<any>(res);
    },
  });
}

export function useSaveScannerConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (config: any) => {
      const res = await window.merqo.hardware.saveScannerConfig(config);
      return unwrap<any>(res);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hardware', 'scannerConfig'] });
      qc.invalidateQueries({ queryKey: ['hardware', 'diagnostics'] });
    },
  });
}

export function useHardwareDiagnostics() {
  return useQuery({
    queryKey: ['hardware', 'diagnostics'],
    queryFn: async () => {
      const res = await window.merqo.hardware.getDiagnostics();
      return unwrap<any>(res);
    },
    staleTime: 1000 * 10,
  });
}

export function useBarcodeTest() {
  return useMutation({
    mutationFn: async (barcode: string) => {
      const res = await window.merqo.hardware.barcodeTest(barcode);
      return unwrap<any>(res);
    },
  });
}
