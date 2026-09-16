import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Barcode scanner HID keyboard support
 * - Detects fast burst input (scanner types within ~50ms per char)
 * - Supports Enter suffix
 * - Manual entry also works
 * - Whitespace normalization
 * - No duplicate handling
 */

interface UseBarcodeScannerOptions {
  onScan: (barcode: string, isScanner: boolean) => void;
  enabled?: boolean;
  minLength?: number;
  maxLength?: number;
  scanTimeoutMs?: number; // time to consider burst ended
  charThresholdMs?: number; // max time between chars for scanner burst
  inputRef?: React.RefObject<HTMLInputElement>;
}

export function useBarcodeScanner({
  onScan,
  enabled = true,
  minLength = 3,
  maxLength = 64,
  scanTimeoutMs = 150,
  charThresholdMs = 50,
}: UseBarcodeScannerOptions) {
  const bufferRef = useRef<string>('');
  const lastCharTimeRef = useRef<number>(0);
  const timeoutRef = useRef<number | null>(null);
  const isScannerBurstRef = useRef<boolean>(true);
  const [isScanning, setIsScanning] = useState(false);

  const clearBuffer = useCallback(() => {
    bufferRef.current = '';
    isScannerBurstRef.current = true;
    setIsScanning(false);
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const handleScan = useCallback((barcode: string, isScanner: boolean) => {
    const normalized = barcode.trim().replace(/\s+/g, '');
    if (normalized.length < minLength || normalized.length > maxLength) return;
    onScan(normalized, isScanner);
  }, [onScan, minLength, maxLength]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if focus is in textarea or contenteditable that is not barcode input?
      // We want scanner to work even if focus is elsewhere, but not interfere with other inputs
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // If focused in an input that is not barcode input (data-barcode-input), and user is typing, don't intercept Enter globally
      // But for scanner burst detection, we still want to capture fast input even when input is focused
      // So we allow if target has data-barcode-input attribute
      const isBarcodeInput = target.hasAttribute('data-barcode-input');

      // For Enter key — finalize barcode
      if (e.key === 'Enter') {
        if (bufferRef.current.length >= minLength) {
          e.preventDefault();
          handleScan(bufferRef.current, isScannerBurstRef.current);
          clearBuffer();
        } else if (isBarcodeInput && bufferRef.current.length > 0) {
          // Manual entry with Enter
          e.preventDefault();
          handleScan(bufferRef.current, false);
          clearBuffer();
        }
        return;
      }

      // Only handle printable characters
      if (e.key.length !== 1) {
        // Ignore modifier keys, but if buffer has content and user presses Escape, clear
        if (e.key === 'Escape') {
          clearBuffer();
        }
        return;
      }

      // If not barcode input and isInput, let user type normally, but still track for scanner burst?
      // For scanner that types very fast, we want to detect even when not in barcode input
      // Heuristic: if chars arrive fast (<charThresholdMs), treat as scanner regardless of focus
      const now = Date.now();
      const timeSinceLastChar = now - lastCharTimeRef.current;

      if (bufferRef.current.length === 0) {
        // Start of new potential barcode
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

      // If buffer too long, truncate and treat as invalid
      if (bufferRef.current.length > maxLength) {
        clearBuffer();
        return;
      }

      // Reset timeout — if no char within scanTimeoutMs, consider burst ended and process if looks like barcode
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
        if (bufferRef.current.length >= minLength) {
          // If it was fast burst and length looks like barcode, auto-scan
          if (isScannerBurstRef.current && bufferRef.current.length >= 6) {
            handleScan(bufferRef.current, true);
            clearBuffer();
          } else {
            // For manual, don't auto-submit, keep buffer for Enter
            // But if not in barcode input, clear to avoid stale
            if (!isBarcodeInput && !isInput) {
              clearBuffer();
            }
          }
        } else {
          clearBuffer();
        }
      }, scanTimeoutMs) as unknown as number;

      // If we're in a fast scanner burst and not focused in a regular input, prevent default to avoid typing into random fields
      if (isScannerBurstRef.current && bufferRef.current.length > 2 && !isInput) {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [enabled, minLength, maxLength, scanTimeoutMs, charThresholdMs, handleScan, clearBuffer]);

  return { isScanning, clear: clearBuffer };
}

// Hook for barcode input field with Enter handling
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
