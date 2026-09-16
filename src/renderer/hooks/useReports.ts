import { useCallback, useState } from 'react';

export type DatePreset = 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'prevMonth' | 'custom';

export interface DateFilter {
  preset: DatePreset;
  fromDate?: number;
  toDate?: number;
}

function getDateRangeMs(preset: DatePreset, customFrom?: number, customTo?: number): { from: number; to: number } {
  const now = new Date();
  let start: Date;
  let end: Date;
  switch (preset) {
    case 'today': {
      start = new Date(now); start.setHours(0,0,0,0);
      end = new Date(now); end.setHours(23,59,59,999);
      break;
    }
    case 'yesterday': {
      const y = new Date(now); y.setDate(y.getDate()-1);
      start = new Date(y); start.setHours(0,0,0,0);
      end = new Date(y); end.setHours(23,59,59,999);
      break;
    }
    case 'thisWeek': {
      start = new Date(now);
      const day = start.getDay();
      const diff = start.getDate() - day + (day===0?-6:1);
      start.setDate(diff); start.setHours(0,0,0,0);
      end = new Date(now); end.setHours(23,59,59,999);
      break;
    }
    case 'thisMonth': {
      start = new Date(now.getFullYear(), now.getMonth(), 1,0,0,0,0);
      end = new Date(now.getFullYear(), now.getMonth()+1, 0,23,59,59,999);
      break;
    }
    case 'prevMonth': {
      start = new Date(now.getFullYear(), now.getMonth()-1, 1,0,0,0,0);
      end = new Date(now.getFullYear(), now.getMonth(), 0,23,59,59,999);
      break;
    }
    case 'custom': {
      if (customFrom && customTo) {
        start = new Date(customFrom); start.setHours(0,0,0,0);
        end = new Date(customTo); end.setHours(23,59,59,999);
      } else {
        start = new Date(now); start.setHours(0,0,0,0);
        end = new Date(now); end.setHours(23,59,59,999);
      }
      break;
    }
    default: {
      start = new Date(now); start.setHours(0,0,0,0);
      end = new Date(now); end.setHours(23,59,59,999);
    }
  }
  return { from: start.getTime(), to: end.getTime() };
}

export function useReports(businessId: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const call = useCallback(async (channel: string, payload: any) => {
    setLoading(true);
    setError(null);
    try {
      const res = await (window as any).merqo.report[channel](payload);
      if (!res.success) throw new Error(res.error?.messageBn || res.error?.message || 'রিপোর্ট লোড ব্যর্থ');
      return res.data;
    } catch (e: any) {
      setError(e.message || String(e));
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const buildPayload = useCallback((dateFilter: DateFilter, extra: any = {}) => {
    const { from, to } = getDateRangeMs(dateFilter.preset, dateFilter.fromDate, dateFilter.toDate);
    return { businessId, fromDate: from, toDate: to, ...extra };
  }, [businessId]);

  return { loading, error, call, buildPayload, getDateRangeMs };
}
