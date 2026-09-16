import React from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, Search, User } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

interface TopbarProps {
  title?: string;
  subtitle?: string;
  onSearch?: () => void;
  notificationCount?: number;
}

export const Topbar: React.FC<TopbarProps> = ({ title, subtitle, onSearch, notificationCount = 0 }) => {
  const { t } = useTranslation('common');

  return (
    <header className="flex items-center justify-between h-14 px-6 bg-surface border-b border-border shrink-0">
      <div className="flex flex-col">
        {title && <h1 className="text-h3 text-text-primary leading-tight">{title}</h1>}
        {subtitle && <p className="text-caption text-text-tertiary leading-tight">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onSearch} aria-label={t('search')}>
          <Search size={20} />
        </Button>

        <div className="relative">
          <Button variant="ghost" size="icon" aria-label="Notifications">
            <Bell size={20} />
          </Button>
          {notificationCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-danger-500 text-white text-caption rounded-full w-5 h-5 flex items-center justify-center">
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
          )}
        </div>

        <div className="w-px h-6 bg-border mx-2" />

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
            <User size={16} className="text-primary-600" />
          </div>
          <div className="hidden md:flex flex-col">
            <span className="text-body-sm font-medium text-text-primary leading-none">মালিক</span>
            <span className="text-caption text-text-tertiary leading-none">Owner</span>
          </div>
        </div>
      </div>
    </header>
  );
};
