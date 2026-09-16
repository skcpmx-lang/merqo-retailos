import React from 'react';
import { Calendar } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './Button';
import { Input } from './Input';

export type DatePreset = 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'prevMonth' | 'custom';

const PRESET_LABELS: Record<DatePreset, string> = {
  today: 'আজ',
  yesterday: 'গতকাল',
  thisWeek: 'এই সপ্তাহ',
  thisMonth: 'এই মাস',
  prevMonth: 'গত মাস',
  custom: 'কাস্টম',
};

interface DateRangePickerProps {
  preset: DatePreset;
  onPresetChange: (preset: DatePreset) => void;
  customFrom?: string;
  customTo?: string;
  onCustomFromChange?: (val: string) => void;
  onCustomToChange?: (val: string) => void;
  onApply?: () => void;
  className?: string;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  preset,
  onPresetChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
  onApply,
  className,
}) => {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <div className="flex items-center gap-1.5 text-body-sm text-text-secondary mr-1">
        <Calendar size={16} className="text-text-tertiary" />
        <span className="font-medium">সময়সীমা:</span>
      </div>
      {(Object.keys(PRESET_LABELS) as DatePreset[]).map(p => (
        <button
          key={p}
          onClick={() => onPresetChange(p)}
          className={cn(
            'h-8 px-3 rounded-sm text-body-sm font-medium transition-all border',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100',
            preset === p
              ? 'bg-primary-500 text-white border-primary-500 shadow-xs'
              : 'bg-surface border-border text-text-secondary hover:bg-subtle hover:text-text-primary hover:border-border-strong'
          )}
        >
          {PRESET_LABELS[p]}
        </button>
      ))}
      {preset === 'custom' && (
        <div className="flex items-center gap-2 ml-2 pl-2 border-l border-border">
          <Input
            type="date"
            value={customFrom}
            onChange={e => onCustomFromChange?.(e.target.value)}
            className="w-36 h-8 text-body-sm"
            aria-label="শুরুর তারিখ"
          />
          <span className="text-body-sm text-text-tertiary">থেকে</span>
          <Input
            type="date"
            value={customTo}
            onChange={e => onCustomToChange?.(e.target.value)}
            className="w-36 h-8 text-body-sm"
            aria-label="শেষ তারিখ"
          />
          {onApply && (
            <Button size="sm" onClick={onApply}>
              প্রয়োগ
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
