import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * P4.2 — Barcode scanner HID keyboard support
 *
 * Design:
 * - USB HID scanners act as keyboard wedge: they type barcode + suffix (Enter/Tab) very fast (<50ms inter-char)
 * - No proprietary SDK, offline, works with USB HID, Bluetooth HID, Wireless HID (all keyboard emulation)
 * - Timing heuristic + focus safety: if chars arrive fast (<charThresholdMs), treat as scanner regardless of focus
 * - Prevent leaking: when scanner burst detected and not in regular input, preventDefault to avoid typing into random fields
 * - Preserve manual typing: slow typing (>charThresholdMs) treated as human, not scanner, except when Enter in barcode input
 * - Stale buffer: cleared after scanTimeoutMs of inactivity
 * - Suffix configurable: Enter (most common), Tab, None (timeout-based)
 * - Prefix handling: optional prefix stripped if configured
 * - Repeated scans: buffer cleared after each scan, immediate next scan allowed
 * - Manual entry: still works via barcode input field with Enter
 *
 * Why timing detection: Focus-based alone is not robust because scanner may type while focus is elsewhere
 * (e.g., user clicked elsewhere). Timing detection allows global capture without requiring focus in barcode field,
 * while still preserving normal typing by threshold. Threshold 50ms default: scanner typically 5-15ms, fast human 80ms+.
 *
 * Thresholds configurable via ScannerConfig from main process.
 */

export type ScannerSuffix = 'Enter' | 'Tab' | 'None';

interface UseBarcodeScannerOptions {
  onScan: (barcode: string, isScanner: boolean) => void;
  enabled?: boolean;
  minLength?: number;
  maxLength?: number;
  scanTimeoutMs?: number; // time to consider burst ended
  charThresholdMs?: number; // max time between chars for scanner burst
  suffix?: ScannerSuffix;
  prefix?: string;
  inputRef?: React.RefObject<HTMLInputElement>;
}

export function useBarcodeScanner({
  onScan,
  enabled = true,
  minLength = 3,
  maxLength = 64,
  scanTimeoutMs = 150,
  charThresholdMs = 50,
  suffix = 'Enter',
  prefix = '',
}: UseBarcodeScannerOptions) {
  const bufferRef = useRef<string>('');
  const lastCharTimeRef = useRef<number>(0);
  const firstCharTimeRef = useRef<number>(0);
  const timeoutRef = useRef<number | null>(null);
  const isScannerBurstRef = useRef<boolean>(true);
  const [isScanning, setIsScanning] = useState(false);
  const [lastEvent, setLastEvent] = useState<{ barcode: string; isScanner: boolean; timestamp: number } | null>(null);

  const clearBuffer = useCallback(() => {
    bufferRef.current = '';
    isScannerBurstRef.current = true;
    firstCharTimeRef.current = 0;
    lastCharTimeRef.current = 0;
    setIsScanning(false);
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const handleScan = useCallback(
    (barcode: string, isScanner: boolean) => {
      let normalized = barcode.trim().replace(/\s+/g, '');

      // Handle prefix stripping if configured
      if (prefix && normalized.startsWith(prefix)) {
        normalized = normalized.slice(prefix.length);
      }

      if (normalized.length < minLength || normalized.length > maxLength) return;

      setLastEvent({ barcode: normalized, isScanner, timestamp: Date.now() });
      onScan(normalized, isScanner);
    },
    [onScan, minLength, maxLength, prefix]
  );

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      const isBarcodeInput = target.hasAttribute('data-barcode-input');

      // Handle suffix keys: Enter, Tab, or None (timeout)
      const isEnter = e.key === 'Enter';
      const isTab = e.key === 'Tab';

      // Suffix handling
      if ((suffix === 'Enter' && isEnter) || (suffix === 'Tab' && isTab)) {
        if (bufferRef.current.length >= minLength) {
          e.preventDefault();
          handleScan(bufferRef.current, isScannerBurstRef.current);
          clearBuffer();
        } else if (isBarcodeInput && bufferRef.current.length > 0) {
          // Manual entry in barcode input with Enter/Tab
          e.preventDefault();
          handleScan(bufferRef.current, false);
          clearBuffer();
        }
        return;
      }

      // For suffix None, we rely on timeout auto-scan
      // For Enter/Tab suffix, also handle if buffer has content and user presses suffix in barcode input

      // Only handle printable single chars (barcode chars are alphanumeric + some symbols)
      if (e.key.length !== 1) {
        if (e.key === 'Escape') {
          clearBuffer();
        }
        return;
      }

      // Filter: allow only barcode-safe chars? For safety, allow most printable but exclude control
      // Common barcode chars: 0-9, A-Z, a-z, -, _, ., etc. We'll allow all single chars except space for now, but trim later
      // Actually allow all printable to support various barcode formats
      const now = Date.now();
      const timeSinceLastChar = lastCharTimeRef.current ? now - lastCharTimeRef.current : 0;

      if (bufferRef.current.length === 0) {
        // Start of new potential barcode
        firstCharTimeRef.current = now;
        isScannerBurstRef.current = true;
        setIsScanning(true);
      } else {
        // If time between chars > threshold, it's manual typing, not scanner burst
        if (timeSinceLastChar > charThresholdMs) {
          isScannerBurstRef.current = false;
        }
      }

      lastCharTimeRef.current = now;
      bufferRef.current += e.key;

      // If buffer too long, truncate and treat as invalid — clear to prevent memory growth
      if (bufferRef.current.length > maxLength) {
        clearBuffer();
        return;
      }

      // Reset timeout — if no char within scanTimeoutMs, consider burst ended
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
        if (bufferRef.current.length >= minLength) {
          const totalTime = Date.now() - firstCharTimeRef.current;
          // Heuristic for auto-scan when suffix is None or scanner burst detected
          // Scanner: fast burst, length >=6, total time < 500ms, avg interval < charThresholdMs
          const avgInterval = bufferRef.current.length > 1 ? totalTime / (bufferRef.current.length - 1) : 0;
          const isFast = avgInterval < charThresholdMs && totalTime < 500;

          if (suffix === 'None') {
            // For None suffix, auto-scan if looks like barcode
            if (bufferRef.current.length >= 6) {
              handleScan(bufferRef.current, isFast);
              clearBuffer();
            } else {
              clearBuffer();
            }
          } else if (isScannerBurstRef.current && isFast && bufferRef.current.length >= 6) {
            // Even with Enter/Tab suffix, some scanners may not send suffix correctly, auto-scan fast bursts
            handleScan(bufferRef.current, true);
            clearBuffer();
          } else {
            // For manual typing, don't auto-submit, keep buffer for Enter if in barcode input
            // But if not in barcode input and not input at all, clear to avoid stale buffer leaking
            if (!isBarcodeInput && !isInput) {
              clearBuffer();
            } else if (!isBarcodeInput && isInput) {
              // If user is typing in regular input slowly, clear scanner buffer to preserve normal typing
              if (!isScannerBurstRef.current) {
                clearBuffer();
              }
            }
          }
        } else {
          clearBuffer();
        }
      }, scanTimeoutMs) as unknown as number;

      // If we're in a fast scanner burst and not focused in a regular input, prevent default to avoid typing into random fields
      // This prevents barcode characters leaking into unrelated fields when scanner mode active
      if (isScannerBurstRef.current && bufferRef.current.length > 2 && !isInput) {
        e.preventDefault();
      }

      // If scanner burst detected and focused in regular input (not barcode), also prevent to avoid corrupting that field
      // But allow if it's barcode input
      if (isScannerBurstRef.current && isInput && !isBarcodeInput && bufferRef.current.length > 3) {
        // Check if it's really fast — if so, prevent
        if (timeSinceLastChar > 0 && timeSinceLastChar < charThresholdMs) {
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [enabled, minLength, maxLength, scanTimeoutMs, charThresholdMs, suffix, handleScan, clearBuffer]);

  return { isScanning, lastEvent, clear: clearBuffer };
}

// Hook for barcode input field with Enter handling — preserves manual entry
export function useBarcodeInput(onScan: (barcode: string) => void) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = value.trim().replace(/\s+/g, '');
      if (trimmed.length >= 2) {
        onScan(trimmed);
        setValue('');
      }
    }
  };

  const focus = () => {
    inputRef.current?.focus();
    inputRef.current?.select();
  };

  return { value, setValue, inputRef, handleKeyDown, focus };
}

// Utility for testing scanner detection logic (pure function, no DOM)
export function isScannerTiming(
  timestamps: number[],
  charThresholdMs = 50,
  maxTotalMs = 500
): { isScanner: boolean; avgInterval: number; totalTime: number } {
  if (timestamps.length < 2) return { isScanner: false, avgInterval: 0, totalTime: 0 };
  const totalTime = timestamps[timestamps.length - 1] - timestamps[0];
  const avgInterval = totalTime / (timestamps.length - 1);
  const isScanner = avgInterval < charThresholdMs && totalTime < maxTotalMs && timestamps.length >= 6;
  return { isScanner, avgInterval, totalTime };
}

export function normalizeBarcode(raw: string, prefix = ''): string {
  let normalized = raw.trim().replace(/\s+/g, '');
  if (prefix && normalized.startsWith(prefix)) {
    normalized = normalized.slice(prefix.length);
  }
  return normalized;
}
