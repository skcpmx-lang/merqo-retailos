import React from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';
  size?: 'sm' | 'default' | 'lg' | 'icon';
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'default', loading, children, disabled, ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center rounded-sm font-medium transition-all duration-150 ease-out select-none ' +
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100 focus-visible:ring-offset-0 ' +
      'disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed ' +
      'active:scale-[0.98]';

    const variants = {
      primary: 'bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700 shadow-xs border border-primary-600/20',
      secondary: 'bg-surface border border-border text-text-primary hover:bg-subtle active:bg-muted shadow-xs',
      ghost: 'bg-transparent text-text-secondary hover:bg-subtle hover:text-text-primary active:bg-muted border border-transparent',
      danger: 'bg-danger-500 text-white hover:bg-danger-600 active:bg-danger-600 shadow-xs border border-danger-600/20',
      link: 'bg-transparent text-primary-500 underline-offset-4 hover:underline h-auto p-0 border-0 shadow-none',
    };

    const sizes = {
      sm: 'h-8 px-3 text-body-sm gap-1.5',
      default: 'h-9 px-4 text-body gap-2',
      lg: 'h-10 px-6 text-body gap-2',
      icon: 'h-9 w-9 p-0 gap-0',
    };

    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        aria-busy={loading ? 'true' : undefined}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
