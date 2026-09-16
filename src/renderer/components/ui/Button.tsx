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
    const base = 'inline-flex items-center justify-center rounded-sm font-medium transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100 disabled:opacity-50 disabled:pointer-events-none';

    const variants = {
      primary: 'bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700',
      secondary: 'bg-surface border border-border text-text-primary hover:bg-subtle',
      ghost: 'bg-transparent text-text-secondary hover:bg-subtle hover:text-text-primary',
      danger: 'bg-danger-500 text-white hover:bg-danger-600',
      link: 'bg-transparent text-primary-500 underline-offset-4 hover:underline h-auto p-0',
    };

    const sizes = {
      sm: 'h-8 px-3 text-body-sm',
      default: 'h-9 px-4 text-body',
      lg: 'h-10 px-6 text-body',
      icon: 'h-9 w-9 p-0',
    };

    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
