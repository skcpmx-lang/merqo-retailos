import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'muted' | 'outline';
}

export const Badge = ({ className, variant = 'default', ...props }: BadgeProps) => {
  const variants = {
    default: 'bg-subtle text-text-secondary border border-border',
    primary: 'bg-primary-50 text-primary-700 border border-primary-100',
    success: 'bg-success-50 text-success-600 border border-success-500/15',
    warning: 'bg-warning-50 text-warning-600 border border-warning-500/15',
    danger: 'bg-danger-50 text-danger-600 border border-danger-500/15',
    muted: 'bg-muted text-text-tertiary border border-transparent',
    outline: 'bg-transparent text-text-secondary border border-border',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-caption font-medium leading-none tracking-wide select-none',
        'whitespace-nowrap',
        variants[variant],
        className
      )}
      {...props}
    />
  );
};

// Status vocabulary — consistent Bengali
export const STATUS_LABELS: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
  active: { label: 'সক্রিয়', variant: 'success' },
  inactive: { label: 'নিষ্ক্রিয়', variant: 'muted' },
  paid: { label: 'পরিশোধিত', variant: 'success' },
  partially_paid: { label: 'আংশিক পরিশোধ', variant: 'warning' },
  due: { label: 'বকেয়া', variant: 'danger' },
  cancelled: { label: 'বাতিল', variant: 'danger' },
  voided: { label: 'বাতিল', variant: 'danger' },
  completed: { label: 'সম্পন্ন', variant: 'success' },
  pending: { label: 'অপেক্ষমাণ', variant: 'warning' },
  open: { label: 'খোলা', variant: 'warning' },
  closed: { label: 'বন্ধ', variant: 'muted' },
  low_stock: { label: 'কম', variant: 'warning' },
  out_of_stock: { label: 'নেই', variant: 'danger' },
  in_stock: { label: 'আছে', variant: 'success' },
};

export const StatusBadge: React.FC<{ status: string; className?: string }> = ({ status, className }) => {
  const cfg = STATUS_LABELS[status] || { label: status, variant: 'default' as const };
  return <Badge variant={cfg.variant} className={className}>{cfg.label}</Badge>;
};
