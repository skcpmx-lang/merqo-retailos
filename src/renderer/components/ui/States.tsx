import React from 'react';
import { cn } from '../../lib/utils';
import { AlertTriangle, Package, Search, Inbox } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: React.ElementType | React.ReactNode;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

function renderIcon(icon?: React.ElementType | React.ReactNode) {
  if (!icon) return <Inbox size={24} />;
  if (typeof icon === 'function' || (typeof icon === 'object' && icon !== null && 'render' in (icon as any))) {
    const IconComp = icon as React.ElementType;
    return <IconComp size={24} />;
  }
  return icon as React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title = 'কোনো তথ্য নেই', description = 'এই সময়সীমায় কোনো তথ্য পাওয়া যায়নি।', action, actionLabel, onAction, className }) => {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 px-6 text-center', className)}>
      <div className="w-12 h-12 rounded-full bg-subtle border border-border flex items-center justify-center mb-4 text-text-tertiary">{renderIcon(icon)}</div>
      <h3 className="text-body font-medium text-text-primary">{title}</h3>
      <p className="text-body-sm text-text-secondary mt-1 max-w-sm leading-relaxed">{description}</p>
      {action && <div className="mt-4">{action}</div>}
      {actionLabel && onAction && (
        <Button variant="secondary" size="sm" onClick={onAction} className="mt-4">
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

export const EmptySearchState: React.FC<{ query?: string; onClear?: () => void }> = ({ query, onClear }) => (
  <EmptyState
    icon={Search}
    title="খুঁজে পাওয়া যায়নি"
    description={query ? `"${query}" এর জন্য কোনো ফলাফল নেই। অন্য শব্দ দিয়ে চেষ্টা করুন।` : 'কোনো ফলাফল নেই'}
    actionLabel={onClear ? 'ফিল্টার মুছুন' : undefined}
    onAction={onClear}
  />
);

export const EmptyStockState: React.FC = () => <EmptyState icon={Package} title="মজুত খালি" description="এই সময়সীমায় কোনো তথ্য পাওয়া যায়নি।" />;

interface LoadingStateProps {
  message?: string;
  className?: string;
  size?: 'sm' | 'default' | 'lg';
}

export const LoadingState: React.FC<LoadingStateProps> = ({ message = 'লোড হচ্ছে...', className, size = 'default' }) => {
  const spinnerSizes = { sm: 'w-5 h-5 border-2', default: 'w-8 h-8 border-2', lg: 'w-10 h-10 border-[3px]' };
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 gap-3', className)}>
      <div className={cn('border-primary-500 border-t-transparent rounded-full animate-spin', spinnerSizes[size])} />
      <p className="text-body-sm text-text-secondary">{message}</p>
    </div>
  );
};

export const TableLoadingState: React.FC<{ colSpan?: number; message?: string }> = ({ colSpan = 5, message }) => (
  <div className="px-4 py-12">
    <LoadingState message={message} size="sm" />
  </div>
);

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ title = 'ত্রুটি', message, onRetry, className }) => {
  return (
    <div className={cn('flex flex-col items-center justify-center py-10 px-6 text-center', className)}>
      <div className="w-12 h-12 rounded-full bg-danger-50 border border-danger-100 flex items-center justify-center mb-4">
        <AlertTriangle size={24} className="text-danger-500" />
      </div>
      <h3 className="text-body font-medium text-danger-600">{title}</h3>
      <p className="text-body-sm text-text-secondary mt-1 max-w-md leading-relaxed">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-4">
          আবার চেষ্টা করুন
        </Button>
      )}
      <p className="text-caption text-text-tertiary mt-4">সাপোর্ট: merqoonline@gmail.com</p>
    </div>
  );
};

export const TableErrorState: React.FC<{ colSpan?: number; message: string; onRetry?: () => void }> = ({ colSpan = 5, message, onRetry }) => (
  <div className="px-4 py-8">
    <ErrorState message={message} onRetry={onRetry} />
  </div>
);

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => <div className={cn('bg-muted animate-pulse rounded-sm', className)} />;

export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({ rows = 5, cols = 4 }) => (
  <>
    {Array.from({ length: rows }).map((_, i) => (
      <tr key={i} className="border-b border-border">
        {Array.from({ length: cols }).map((_, j) => (
          <td key={j} className="px-4 py-3">
            <Skeleton className={cn('h-4', j === 0 ? 'w-32' : j === cols - 1 ? 'w-20 ml-auto' : 'w-24')} />
          </td>
        ))}
      </tr>
    ))}
  </>
);

export const CardSkeleton: React.FC<{ lines?: number }> = ({ lines = 3 }) => (
  <div className="border border-border rounded-sm bg-surface p-4 space-y-3">
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton key={i} className={cn('h-4', i === 0 ? 'w-20' : i === 1 ? 'w-32 h-6' : 'w-16 h-3')} />
    ))}
  </div>
);
