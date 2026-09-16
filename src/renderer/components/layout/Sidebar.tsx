import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Truck,
  Wallet,
  BarChart3,
  Settings,
  Printer,
  Database,
  Shield,
  Store,
  Building2,
  Smartphone,
  Receipt,
  ArrowLeftRight,
  Clock,
} from 'lucide-react';

interface NavItem {
  key: string;
  labelKey: string;
  icon: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  comingSoon?: boolean;
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  activeKey?: string;
  onNavigate?: (key: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle, activeKey = 'dashboard', onNavigate }) => {
  const { t } = useTranslation('common');

  const navItems: NavItem[] = [
    { key: 'dashboard', labelKey: 'dashboard', icon: <LayoutDashboard size={20} />, active: activeKey === 'dashboard' },
    { key: 'pos', labelKey: 'pos', icon: <ShoppingCart size={20} />, active: activeKey === 'pos' },
    { key: 'sales', labelKey: 'sales', icon: <Store size={20} />, active: activeKey === 'sales' || activeKey.startsWith('sale') },
    { key: 'customers', labelKey: 'customers', icon: <Users size={20} />, active: activeKey === 'customers' || activeKey.startsWith('customer') },
    { key: 'purchases', labelKey: 'purchases', icon: <Truck size={20} />, active: activeKey === 'purchases' || activeKey.startsWith('purchase') },
    { key: 'suppliers', labelKey: 'suppliers', icon: <Truck size={20} />, active: activeKey === 'suppliers' || activeKey.startsWith('supplier') },
    { key: 'finance', labelKey: 'finance', icon: <Wallet size={20} />, active: activeKey === 'finance' },
    { key: 'cash-accounts', labelKey: 'cash-accounts', icon: <Wallet size={20} />, active: activeKey === 'cash-accounts' },
    { key: 'bank-accounts', labelKey: 'bank-accounts', icon: <Building2 size={20} />, active: activeKey === 'bank-accounts' },
    { key: 'mfs-accounts', labelKey: 'mfs-accounts', icon: <Smartphone size={20} />, active: activeKey === 'mfs-accounts' },
    { key: 'expenses', labelKey: 'expenses', icon: <Receipt size={20} />, active: activeKey === 'expenses' },
    { key: 'transfers', labelKey: 'transfers', icon: <ArrowLeftRight size={20} />, active: activeKey === 'transfers' },
    { key: 'shifts', labelKey: 'shifts', icon: <Clock size={20} />, active: activeKey === 'shifts' },
    { key: 'products', labelKey: 'products', icon: <Package size={20} />, disabled: true, comingSoon: true },
    { key: 'inventory', labelKey: 'inventory', icon: <Database size={20} />, disabled: true, comingSoon: true },
    { key: 'reports', labelKey: 'reports', icon: <BarChart3 size={20} />, disabled: true, comingSoon: true },
    { key: 'hardware', labelKey: 'hardware', icon: <Printer size={20} />, active: activeKey === 'hardware' },
    { key: 'users', labelKey: 'users', icon: <Shield size={20} />, disabled: true, comingSoon: true },
    { key: 'settings', labelKey: 'settings', icon: <Settings size={20} />, disabled: true, comingSoon: true },
  ];

  return (
    <aside
      className={cn(
        'flex flex-col bg-surface border-r border-border transition-all duration-200 ease-out',
        collapsed ? 'w-16' : 'w-60'
      )}
      style={{ minWidth: collapsed ? '64px' : '240px' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 h-14 px-4 border-b border-border">
        <div className="w-8 h-8 bg-primary-500 rounded-sm flex items-center justify-center text-white font-bold text-body">
          M
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-body font-semibold text-text-primary leading-none">MERQO</span>
            <span className="text-caption text-text-tertiary leading-none">RetailOS</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {navItems.map(item => (
          <button
            key={item.key}
            disabled={item.disabled}
            onClick={() => !item.disabled && onNavigate?.(item.key)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-sm text-body-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100',
              item.active
                ? 'bg-primary-50 text-primary-600 border-l-2 border-primary-500'
                : 'text-text-secondary hover:bg-subtle hover:text-text-primary',
              item.disabled && 'opacity-50 cursor-not-allowed',
              collapsed && 'justify-center px-2'
            )}
            title={collapsed ? t(item.labelKey) : undefined}
          >
            <span className="shrink-0">{item.icon}</span>
            {!collapsed && (
              <>
                <span className="flex-1 text-left truncate">{t(item.labelKey)}</span>
                {item.comingSoon && (
                  <span className="text-caption bg-muted px-1.5 py-0.5 rounded-sm text-text-tertiary">শীঘ্রই</span>
                )}
              </>
            )}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-border">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-sm text-body-sm text-text-secondary hover:bg-subtle hover:text-text-primary transition-colors"
        >
          <span className="text-caption">{collapsed ? '→' : '←'}</span>
          {!collapsed && <span>{collapsed ? '' : 'সংকুচিত'}</span>}
        </button>
      </div>
    </aside>
  );
};
