import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

interface AppShellProps {
  children: React.ReactNode;
  activeKey: string;
  onNavigate: (key: string) => void;
}

export const AppShell: React.FC<AppShellProps> = ({ children, activeKey, onNavigate }) => {
  const { t } = useTranslation('common');
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved) {
      setCollapsed(saved === 'true');
    }
  }, []);

  const handleToggle = () => {
    const newCollapsed = !collapsed;
    setCollapsed(newCollapsed);
    localStorage.setItem('sidebar-collapsed', String(newCollapsed));
  };

  const titleMap: Record<string, string> = {
    dashboard: t('dashboard'),
    suppliers: 'সাপ্লায়ার',
    purchases: 'ক্রয়',
    products: t('products'),
    inventory: t('inventory'),
    pos: t('pos'),
    sales: 'বিক্রয়',
    customers: 'গ্রাহক',
    expenses: t('expenses'),
    reports: t('reports'),
  };

  return (
    <div className="flex w-screen h-screen overflow-hidden bg-canvas">
      <Sidebar collapsed={collapsed} onToggle={handleToggle} activeKey={activeKey} onNavigate={onNavigate} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar title={titleMap[activeKey] || t('dashboard')} subtitle="MERQO RetailOS — Phase 3B Sales & Customer" notificationCount={0} />
        <main className="flex-1 overflow-auto p-6 bg-canvas">
          {children}
        </main>
        <footer className="h-6 px-4 bg-surface border-t border-border flex items-center justify-between text-caption text-text-tertiary shrink-0">
          <span>MERQO RetailOS • Phase 3B Sales & Customer • Light Mode Only</span>
          <span className="hidden md:inline">1280x720+ • Offline-First • Windows Desktop</span>
        </footer>
      </div>
    </div>
  );
};
