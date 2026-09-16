import React from 'react';
import { User, Shield } from 'lucide-react';

interface TopbarProps {
  title?: string;
  subtitle?: string;
  onSearch?: () => void;
  notificationCount?: number;
}

export const Topbar: React.FC<TopbarProps> = ({ title, subtitle }) => {
  return (
    <header className="flex items-center justify-between h-14 px-6 bg-surface border-b border-border shrink-0">
      <div className="flex flex-col min-w-0 flex-1">
        {title && (
          <h1 className="text-h3 font-semibold text-text-primary leading-tight tracking-tight truncate">
            {title}
          </h1>
        )}
        {subtitle && (
          <p className="text-caption text-text-tertiary leading-tight truncate mt-0.5">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="hidden lg:flex items-center gap-2 text-caption text-text-tertiary">
          <Shield size={14} className="text-success-500" />
          <span>অফলাইন • নিরাপদ</span>
        </div>

        <div className="w-px h-6 bg-border hidden lg:block" />

        <div className="flex items-center gap-2.5 pl-1">
          <div className="w-8 h-8 bg-primary-50 border border-primary-100 rounded-full flex items-center justify-center shrink-0">
            <User size={16} className="text-primary-600" />
          </div>
          <div className="hidden md:flex flex-col leading-none">
            <span className="text-body-sm font-medium text-text-primary">মালিক</span>
            <span className="text-caption text-text-tertiary">Owner • সক্রিয়</span>
          </div>
        </div>
      </div>
    </header>
  );
};
