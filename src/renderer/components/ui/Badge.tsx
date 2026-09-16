import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'muted';
}

export const Badge = ({ className, variant = 'default', ...props }: BadgeProps) => {
  const variants = {
    default: 'bg-subtle text-text-secondary border border-border',
    primary: 'bg-primary-50 text-primary-600 border border-primary-100',
    success: 'bg-success-50 text-success-600 border border-success-500/20',
    warning: 'bg-warning-50 text-warning-600 border border-warning-500/20',
    danger: 'bg-danger-50 text-danger-600 border border-danger-500/20',
    muted: 'bg-muted text-text-tertiary',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-caption font-medium',
        variants[variant],
        className
      )}
      {...props}
    />
  );
};
