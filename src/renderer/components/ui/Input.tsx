import React, { useId } from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, required, ...props }, ref) => {
    const autoId = useId();
    const inputId = id || `input-${autoId}`;

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={inputId} className="text-label text-text-primary flex items-center gap-1">
            <span>{label}</span>
            {required && <span className="text-danger-500" aria-hidden="true">*</span>}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={cn(
            'flex h-9 w-full rounded-sm border border-border bg-surface px-3 py-2 text-body text-text-primary tabular-nums',
            'placeholder:text-text-tertiary placeholder:text-body-sm',
            'focus:border-border-focus focus:outline-none transition-colors duration-150',
            'disabled:bg-muted disabled:text-text-disabled disabled:cursor-not-allowed',
            'hover:border-border-strong',
            error && 'border-danger-500 focus:border-danger-500 focus:ring-2 focus:ring-danger-50',
            className
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          aria-required={required}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="text-caption text-danger-500 flex items-center gap-1" role="alert">
            <span>{error}</span>
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

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string; hint?: string; required?: boolean }
>(({ className, label, error, hint, id, required, ...props }, ref) => {
  const autoId = useId();
  const inputId = id || `textarea-${autoId}`;
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label htmlFor={inputId} className="text-label text-text-primary flex items-center gap-1">
          <span>{label}</span>
          {required && <span className="text-danger-500">*</span>}
        </label>
      )}
      <textarea
        id={inputId}
        ref={ref}
        className={cn(
          'flex min-h-[80px] w-full rounded-sm border border-border bg-surface px-3 py-2.5 text-body text-text-primary',
          'placeholder:text-text-tertiary',
          'focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-primary-100 transition-colors',
          error && 'border-danger-500 focus:border-danger-500 focus:ring-danger-50',
          className
        )}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        {...props}
      />
      {error && (
        <p id={`${inputId}-error`} className="text-caption text-danger-500" role="alert">
          {error}
        </p>
      )}
      {hint && !error && <p className="text-caption text-text-tertiary">{hint}</p>}
    </div>
  );
});

Textarea.displayName = 'Textarea';

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string; hint?: string; required?: boolean }
>(({ className, label, error, hint, id, required, children, ...props }, ref) => {
  const autoId = useId();
  const inputId = id || `select-${autoId}`;
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label htmlFor={inputId} className="text-label text-text-primary flex items-center gap-1">
          <span>{label}</span>
          {required && <span className="text-danger-500">*</span>}
        </label>
      )}
      <select
        id={inputId}
        ref={ref}
        className={cn(
          'flex h-9 w-full rounded-sm border border-border bg-surface px-3 text-body text-text-primary',
          'focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-primary-100',
          'disabled:bg-muted disabled:text-text-disabled',
          error && 'border-danger-500',
          className
        )}
        aria-invalid={!!error}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-caption text-danger-500">{error}</p>}
      {hint && !error && <p className="text-caption text-text-tertiary">{hint}</p>}
    </div>
  );
});
Select.displayName = 'Select';
