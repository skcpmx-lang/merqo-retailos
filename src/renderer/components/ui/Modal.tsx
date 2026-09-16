import React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ open, onClose, title, children, size = 'md', footer }) => {
  if (!open) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-3xl',
    xl: 'max-w-5xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={cn('relative bg-surface rounded-md shadow-lg border border-border w-[90vw] max-h-[90vh] flex flex-col', sizeClasses[size])}>
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
            <h3 className="text-h3 text-text-primary">{title}</h3>
            <button onClick={onClose} className="p-1 rounded-sm hover:bg-subtle text-text-tertiary hover:text-text-primary">
              <X size={18} />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-auto p-5">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-border bg-subtle/50 flex justify-end gap-2 shrink-0">{footer}</div>}
      </div>
    </div>
  );
};
