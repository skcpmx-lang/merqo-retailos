import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  footer?: React.ReactNode;
  closeOnOverlay?: boolean;
  closeOnEsc?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  description,
  children,
  size = 'md',
  footer,
  closeOnOverlay = true,
  closeOnEsc = true,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previousActiveRef.current = document.activeElement as HTMLElement;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEsc) {
        onClose();
      }
    };

    // Focus trap — simple: focus first focusable inside modal
    const focusable = contentRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable && focusable.length > 0) {
      // Focus first input if exists, else first button
      const firstInput = Array.from(focusable).find(el => el.tagName === 'INPUT');
      (firstInput || focusable[0])?.focus();
    }

    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
      // Restore focus
      previousActiveRef.current?.focus();
    };
  }, [open, closeOnEsc, onClose]);

  if (!open) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-3xl',
    xl: 'max-w-5xl',
    full: 'max-w-[95vw] w-[95vw] h-[90vh]',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby={title ? 'modal-title' : undefined} aria-describedby={description ? 'modal-desc' : undefined}>
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px] animate-in fade-in duration-150"
        onClick={() => closeOnOverlay && onClose()}
        aria-hidden="true"
      />
      <div
        ref={contentRef}
        className={cn(
          'relative bg-surface rounded shadow-lg border border-border w-full flex flex-col animate-in zoom-in-95 duration-150',
          'max-h-[90vh] overflow-hidden',
          sizeClasses[size]
        )}
      >
        {title && (
          <div className="flex items-start justify-between px-5 py-4 border-b border-border shrink-0 bg-surface">
            <div className="flex-1 pr-4">
              <h3 id="modal-title" className="text-h3 font-semibold text-text-primary leading-tight">
                {title}
              </h3>
              {description && (
                <p id="modal-desc" className="text-body-sm text-text-secondary mt-1 leading-snug">
                  {description}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-sm hover:bg-subtle text-text-tertiary hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100 shrink-0"
              aria-label="বন্ধ করুন"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-auto p-5 bg-surface">{children}</div>
        {footer && (
          <div className="px-5 py-3.5 border-t border-border bg-subtle/40 flex justify-end gap-2 shrink-0">{footer}</div>
        )}
      </div>
    </div>
  );
};

// Confirm dialog — context-specific Bengali, not generic Are you sure?
interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  loading?: boolean;
  requireText?: string; // e.g., RESTORE
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'নিশ্চিত করুন',
  cancelLabel = 'বাতিল',
  variant = 'primary',
  loading,
  requireText,
}) => {
  const [inputValue, setInputValue] = React.useState('');

  React.useEffect(() => {
    if (open) setInputValue('');
  }, [open]);

  const canConfirm = requireText ? inputValue === requireText : true;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-sm border border-border bg-surface text-text-primary hover:bg-subtle text-body-sm font-medium"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={!canConfirm || loading}
            className={cn(
              'h-9 px-4 rounded-sm text-white text-body-sm font-medium shadow-xs disabled:opacity-50',
              variant === 'danger' ? 'bg-danger-500 hover:bg-danger-600' : 'bg-primary-500 hover:bg-primary-600'
            )}
          >
            {loading ? 'প্রক্রিয়া চলছে...' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-body-sm text-text-secondary leading-relaxed">{description}</p>
        {requireText && (
          <div className="space-y-2">
            <p className="text-caption text-text-tertiary">
              নিশ্চিত করতে <span className="font-mono font-bold text-text-primary">{requireText}</span> লিখুন
            </p>
            <input
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder={requireText}
              className="w-full h-9 px-3 rounded-sm border border-border bg-surface text-body font-mono focus:border-border-focus focus:ring-2 focus:ring-primary-100 outline-none"
              autoFocus
            />
          </div>
        )}
      </div>
    </Modal>
  );
};
