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
  Printer,
  Store,
  Building2,
  Smartphone,
  Receipt,
  ArrowLeftRight,
  Clock,
  HardDrive,
  ShoppingBag,
  Boxes,
} from 'lucide-react';

interface NavItem {
  key: string;
  label: string;
  labelBn: string;
  icon: React.ReactNode;
  active?: boolean;
  group?: string;
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  activeKey?: string;
  onNavigate?: (key: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle, activeKey = 'dashboard', onNavigate }) => {
  const { t } = useTranslation('common');

  // Grouped navigation — only production screens, no dead navigation
  const navGroups: { title: string; items: NavItem[] }[] = [
    {
      title: 'প্রধান',
      items: [
        { key: 'dashboard', label: t('dashboard'), labelBn: 'ড্যাশবোর্ড', icon: <LayoutDashboard size={18} />, active: activeKey === 'dashboard', group: 'main' },
        { key: 'pos', label: t('pos'), labelBn: 'পিওএস', icon: <ShoppingCart size={18} />, active: activeKey === 'pos', group: 'main' },
      ],
    },
    {
      title: 'বিক্রয়',
      items: [
        { key: 'sales', label: 'বিক্রয়', labelBn: 'বিক্রয়', icon: <Store size={18} />, active: activeKey === 'sales' || activeKey.startsWith('sale'), group: 'sales' },
        { key: 'customers', label: 'গ্রাহক', labelBn: 'গ্রাহক', icon: <Users size={18} />, active: activeKey === 'customers' || activeKey.startsWith('customer'), group: 'sales' },
      ],
    },
    {
      title: 'ক্রয়',
      items: [
        { key: 'purchases', label: 'ক্রয়', labelBn: 'ক্রয়', icon: <ShoppingBag size={18} />, active: activeKey === 'purchases' || activeKey.startsWith('purchase'), group: 'purchase' },
        { key: 'suppliers', label: 'সরবরাহকারী', labelBn: 'সরবরাহকারী', icon: <Truck size={18} />, active: activeKey === 'suppliers' || activeKey.startsWith('supplier'), group: 'purchase' },
      ],
    },
    {
      title: 'অর্থ',
      items: [
        { key: 'finance', label: 'ফাইন্যান্স', labelBn: 'অর্থ', icon: <Wallet size={18} />, active: activeKey === 'finance', group: 'finance' },
        { key: 'cash-accounts', label: 'নগদ', labelBn: 'নগদ হিসাব', icon: <Wallet size={18} />, active: activeKey === 'cash-accounts', group: 'finance' },
        { key: 'bank-accounts', label: 'ব্যাংক', labelBn: 'ব্যাংক হিসাব', icon: <Building2 size={18} />, active: activeKey === 'bank-accounts', group: 'finance' },
        { key: 'mfs-accounts', label: 'MFS', labelBn: 'মোবাইল ফাইন্যান্স', icon: <Smartphone size={18} />, active: activeKey === 'mfs-accounts', group: 'finance' },
        { key: 'expenses', label: 'খরচ', labelBn: 'খরচ', icon: <Receipt size={18} />, active: activeKey === 'expenses', group: 'finance' },
        { key: 'transfers', label: 'স্থানান্তর', labelBn: 'স্থানান্তর', icon: <ArrowLeftRight size={18} />, active: activeKey === 'transfers', group: 'finance' },
        { key: 'shifts', label: 'শিফট', labelBn: 'শিফট', icon: <Clock size={18} />, active: activeKey === 'shifts', group: 'finance' },
      ],
    },
    {
      title: 'বিশ্লেষণ',
      items: [
        { key: 'reports', label: t('reports'), labelBn: 'রিপোর্ট', icon: <BarChart3 size={18} />, active: activeKey === 'reports', group: 'analytics' },
      ],
    },
    {
      title: 'সিস্টেম',
      items: [
        { key: 'hardware', label: 'হার্ডওয়্যার', labelBn: 'হার্ডওয়্যার', icon: <Printer size={18} />, active: activeKey === 'hardware', group: 'system' },
        { key: 'backup', label: 'ব্যাকআপ', labelBn: 'ব্যাকআপ', icon: <HardDrive size={18} />, active: activeKey === 'backup', group: 'system' },
      ],
    },
  ];

  return (
    <aside
      className={cn(
        'flex flex-col bg-surface border-r border-border transition-all duration-200 ease-out shrink-0',
        collapsed ? 'w-16' : 'w-[240px]'
      )}
      style={{ minWidth: collapsed ? '64px' : '240px' }}
      aria-label="প্রধান নেভিগেশন"
    >
      {/* Logo — premium, calm */}
      <div className="flex items-center gap-3 h-14 px-4 border-b border-border shrink-0">
        <div className="w-8 h-8 bg-primary-600 rounded-sm flex items-center justify-center text-white font-bold text-body shadow-xs shrink-0">
          M
        </div>
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="text-body font-semibold text-text-primary leading-none tracking-tight">MERQO</span>
            <span className="text-caption text-text-tertiary leading-none mt-0.5">RetailOS</span>
          </div>
        )}
      </div>

      {/* Nav — grouped, information-dense, no clutter */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 space-y-4" role="navigation">
        {navGroups.map(group => (
          <div key={group.title} className="px-2">
            {!collapsed && (
              <h4 className="text-caption font-medium text-text-tertiary uppercase tracking-wider px-2 mb-1.5 select-none">
                {group.title}
              </h4>
            )}
            <div className="space-y-0.5">
              {group.items.map(item => (
                <button
                  key={item.key}
                  onClick={() => onNavigate?.(item.key)}
                  className={cn(
                    'w-full flex items-center gap-3 px-2.5 py-2 rounded-sm text-body-sm font-medium transition-all duration-100',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100 focus-visible:ring-inset',
                    'text-left relative',
                    item.active
                      ? 'bg-primary-50 text-primary-700 border border-primary-100 shadow-xs'
                      : 'text-text-secondary hover:bg-subtle hover:text-text-primary border border-transparent',
                    collapsed && 'justify-center px-2'
                  )}
                  title={collapsed ? item.labelBn : undefined}
                  aria-current={item.active ? 'page' : undefined}
                  aria-label={item.labelBn}
                >
                  {item.active && !collapsed && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary-500 rounded-full" aria-hidden="true" />
                  )}
                  <span className={cn('shrink-0', item.active ? 'text-primary-600' : 'text-text-tertiary')}>{item.icon}</span>
                  {!collapsed && <span className="flex-1 truncate leading-tight">{item.labelBn}</span>}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer — collapse toggle */}
      <div className="p-2 border-t border-border shrink-0">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-sm text-body-sm text-text-secondary hover:bg-subtle hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
          aria-label={collapsed ? 'সাইডবার প্রসারিত করুন' : 'সাইডবার সংকুচিত করুন'}
          title={collapsed ? 'প্রসারিত' : 'সংকুচিত'}
        >
          <span className="text-body-sm font-mono" aria-hidden="true">
            {collapsed ? '→' : '←'}
          </span>
          {!collapsed && <span className="text-caption">সংকুচিত</span>}
        </button>
      </div>
    </aside>
  );
};
