import { describe, it, expect } from 'vitest';
import { DateTime } from '../DateTime';

describe('DateTime — centralized', () => {
  it('should return now ms', () => {
    const now = DateTime.nowMs();
    expect(typeof now).toBe('number');
    expect(now).toBeGreaterThan(0);
  });

  it('should start of day', () => {
    const start = DateTime.startOfDayMs(new Date('2026-01-15T10:30:00'));
    const date = new Date(start);
    expect(date.getHours()).toBe(0);
    expect(date.getMinutes()).toBe(0);
  });

  it('should end of day', () => {
    const end = DateTime.endOfDayMs(new Date('2026-01-15T10:30:00'));
    const date = new Date(end);
    expect(date.getHours()).toBe(23);
    expect(date.getMinutes()).toBe(59);
  });

  it('should validate ms', () => {
    expect(DateTime.isValidMs(Date.now())).toBe(true);
    expect(DateTime.isValidMs(-1)).toBe(false);
    expect(DateTime.isValidMs('abc' as any)).toBe(false);
  });

  it('should get preset ranges', () => {
    const today = DateTime.getPresetRange('today');
    expect(today.startMs).toBeLessThanOrEqual(today.endMs);

    const last7 = DateTime.getPresetRange('last7Days');
    expect(last7.startMs).toBeLessThan(last7.endMs);
  });

  it('should store as integer ms (no string parsing inconsistencies)', () => {
    const ms = DateTime.nowMs();
    const date = DateTime.fromMs(ms);
    const back = DateTime.toMs(date);
    expect(back).toBe(ms);
  });
});
