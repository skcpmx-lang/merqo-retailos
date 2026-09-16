import React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).slice(2)}`;

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={inputId} className="text-label text-text-primary">
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={cn(
            'flex h-9 w-full rounded-sm border border-border bg-surface px-3 py-2 text-body text-text-primary',
            'placeholder:text-text-tertiary',
            'focus:border-border-focus focus:ring-2 focus:ring-primary-100 focus:outline-none',
            'disabled:bg-muted disabled:text-text-disabled disabled:cursor-not-allowed',
            error && 'border-danger-500 focus:border-danger-500 focus:ring-danger-50',
            className
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="text-caption text-danger-500">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${inputId}-hint`} className="text-caption text-text-tertiary">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string }>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id || `textarea-${Math.random().toString(36).slice(2)}`;
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && <label htmlFor={inputId} className="text-label text-text-primary">{label}</label>}
        <textarea
          id={inputId}
          ref={ref}
          className={cn(
            'flex min-h-[80px] w-full rounded-sm border border-border bg-surface px-3 py-2 text-body',
            'focus:border-border-focus focus:ring-2 focus:ring-primary-100 focus:outline-none',
            error && 'border-danger-500',
            className
          )}
          {...props}
        />
        {error && <p className="text-caption text-danger-500">{error}</p>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
