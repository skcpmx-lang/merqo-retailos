import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const { t } = useTranslation('common');
  const [collapsed, setCollapsed] = useState(false);
  const [activeKey] = useState('dashboard');

  // Load collapsed state from config (future: via IPC)
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

  return (
    <div className="flex w-screen h-screen overflow-hidden bg-canvas">
      <Sidebar collapsed={collapsed} onToggle={handleToggle} activeKey={activeKey} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar title={t('dashboard')} subtitle="MERQO RetailOS — Phase 1 Foundation" notificationCount={0} />
        <main className="flex-1 overflow-auto p-6 bg-canvas">
          {children}
        </main>
        {/* Status bar */}
        <footer className="h-6 px-4 bg-surface border-t border-border flex items-center justify-between text-caption text-text-tertiary shrink-0">
          <span>MERQO RetailOS • Phase 1 Foundation • Light Mode Only</span>
          <span className="hidden md:inline">1280x720+ • Offline-First • Windows Desktop</span>
        </footer>
      </div>
    </div>
  );
};
