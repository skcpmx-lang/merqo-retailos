/**
 * Centralized Date/Time handling
 * Store as INTEGER Unix ms UTC, display local with Bangla conventions
 */

export class DateTime {
  static nowMs(): number {
    return Date.now();
  }

  static nowIso(): string {
    return new Date().toISOString();
  }

  static fromMs(ms: number): Date {
    return new Date(ms);
  }

  static toMs(date: Date): number {
    return date.getTime();
  }

  static startOfDayMs(date: Date = new Date()): number {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  static endOfDayMs(date: Date = new Date()): number {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  }

  static formatBangla(dateMs: number, options?: Intl.DateTimeFormatOptions): string {
    const date = new Date(dateMs);
    // Use en-BD for English digits (common in BD retail) but Bangla month names via bn-BD if needed
    // For V1, use bn-BD with English digits? We'll use bn-BD but format manually
    return date.toLocaleDateString('en-BD', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...options,
    });
  }

  static formatDateTimeBangla(dateMs: number): string {
    const date = new Date(dateMs);
    return date.toLocaleString('en-BD', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  static formatTime(dateMs: number): string {
    const date = new Date(dateMs);
    return date.toLocaleTimeString('en-BD', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  static daysAgo(days: number): number {
    return Date.now() - days * 24 * 60 * 60 * 1000;
  }

  static isValidMs(ms: unknown): boolean {
    return typeof ms === 'number' && Number.isFinite(ms) && ms > 0 && ms < 8640000000000000;
  }

  // Date presets for reports
  static getPresetRange(preset: string): { startMs: number; endMs: number } {
    const now = new Date();
    const todayStart = DateTime.startOfDayMs(now);
    const todayEnd = DateTime.endOfDayMs(now);

    switch (preset) {
      case 'today':
        return { startMs: todayStart, endMs: todayEnd };
      case 'yesterday': {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        return { startMs: DateTime.startOfDayMs(yesterday), endMs: DateTime.endOfDayMs(yesterday) };
      }
      case 'last7Days': {
        const start = new Date(now);
        start.setDate(start.getDate() - 6);
        return { startMs: DateTime.startOfDayMs(start), endMs: todayEnd };
      }
      case 'thisWeek': {
        const start = new Date(now);
        start.setDate(now.getDate() - now.getDay()); // Sunday start
        return { startMs: DateTime.startOfDayMs(start), endMs: todayEnd };
      }
      case 'thisMonth': {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return { startMs: DateTime.startOfDayMs(start), endMs: todayEnd };
      }
      case 'lastMonth': {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0);
        return { startMs: DateTime.startOfDayMs(start), endMs: DateTime.endOfDayMs(end) };
      }
      case 'thisYear': {
        const start = new Date(now.getFullYear(), 0, 1);
        return { startMs: DateTime.startOfDayMs(start), endMs: todayEnd };
      }
      case 'lastYear': {
        const start = new Date(now.getFullYear() - 1, 0, 1);
        const end = new Date(now.getFullYear() - 1, 11, 31);
        return { startMs: DateTime.startOfDayMs(start), endMs: DateTime.endOfDayMs(end) };
      }
      default:
        return { startMs: todayStart, endMs: todayEnd };
    }
  }
}
