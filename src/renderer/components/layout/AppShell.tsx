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

  const titleMap: Record<string, { title: string; subtitle: string }> = {
    dashboard: { title: 'ড্যাশবোর্ড', subtitle: 'আজকের ব্যবসার সারসংক্ষেপ — বাস্তব ডেটা' },
    pos: { title: 'পিওএস — বিক্রয় টার্মিনাল', subtitle: 'দ্রুত বিক্রয় • বারকোড • কীবোর্ড-ফার্স্ট' },
    sales: { title: 'বিক্রয়', subtitle: 'বিক্রয় তালিকা ও বিবরণ' },
    'sale-form': { title: 'নতুন বিক্রয়', subtitle: 'বিক্রয় তৈরি' },
    'sale-detail': { title: 'বিক্রয় বিবরণ', subtitle: 'বিক্রয় তথ্য ও রসিদ' },
    customers: { title: 'গ্রাহক', subtitle: 'গ্রাহক তালিকা ও বকেয়া ব্যবস্থাপনা' },
    'customer-detail': { title: 'গ্রাহক বিবরণ', subtitle: 'লেনদেন ও বকেয়া' },
    purchases: { title: 'ক্রয়', subtitle: 'ক্রয় তালিকা ও ব্যবস্থাপনা' },
    'purchase-form': { title: 'নতুন ক্রয়', subtitle: 'ক্রয় তৈরি ও মজুত আপডেট' },
    'purchase-detail': { title: 'ক্রয় বিবরণ', subtitle: 'ক্রয় তথ্য ও সরবরাহকারী' },
    suppliers: { title: 'সরবরাহকারী', subtitle: 'সরবরাহকারী তালিকা ও পাওনা ব্যবস্থাপনা' },
    'supplier-detail': { title: 'সরবরাহকারী বিবরণ', subtitle: 'লেনদেন ও পাওনা' },
    finance: { title: 'অর্থ — সারসংক্ষেপ', subtitle: 'নগদ • ব্যাংক • MFS • খরচ • শিফট' },
    'cash-accounts': { title: 'নগদ হিসাব', subtitle: 'ক্যাশ অ্যাকাউন্ট ও লেনদেন' },
    'bank-accounts': { title: 'ব্যাংক হিসাব', subtitle: 'ব্যাংক অ্যাকাউন্ট ও লেনদেন' },
    'mfs-accounts': { title: 'মোবাইল ফাইন্যান্স', subtitle: 'বিকাশ • নগদ • রকেট • উপায়' },
    expenses: { title: 'খরচ', subtitle: 'ব্যবসার খরচ ব্যবস্থাপনা' },
    transfers: { title: 'স্থানান্তর', subtitle: 'হিসাব থেকে হিসাবে স্থানান্তর' },
    shifts: { title: 'শিফট', subtitle: 'ক্যাশিয়ার শিফট ও মিলকরণ' },
    reports: { title: 'রিপোর্ট ও বিশ্লেষণ', subtitle: 'অফলাইন রিড-অনলি — বাস্তব ডেটা' },
    hardware: { title: 'হার্ডওয়্যার', subtitle: 'প্রিন্টার • স্ক্যানার • ডায়াগনস্টিক' },
    backup: { title: 'ব্যাকআপ ও পুনরুদ্ধার', subtitle: 'অফলাইন • নিরাপদ • যাচাইকৃত' },
  };

  const current = titleMap[activeKey] || { title: t('dashboard'), subtitle: 'MERQO RetailOS — পলিশড প্রোডাকশন' };

  return (
    <div className="flex w-screen h-screen overflow-hidden bg-canvas">
      <Sidebar collapsed={collapsed} onToggle={handleToggle} activeKey={activeKey} onNavigate={onNavigate} />
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <Topbar title={current.title} subtitle={current.subtitle} />
        <main className="flex-1 overflow-auto bg-canvas p-4 lg:p-6">
          <div className="max-w-[1600px] mx-auto w-full">{children}</div>
        </main>
        <footer className="h-7 px-4 bg-surface border-t border-border flex items-center justify-between text-caption text-text-tertiary shrink-0 select-none">
          <span className="flex items-center gap-2">
            <span className="font-medium">MERQO RetailOS</span>
            <span className="hidden sm:inline">•</span>
            <span className="hidden sm:inline">P4.5 UI/UX Polish • Light Only</span>
          </span>
          <span className="hidden lg:flex items-center gap-3">
            <span>১২৮০×৭২০+</span>
            <span>•</span>
            <span>অফলাইন-ফার্স্ট</span>
            <span>•</span>
            <span>Windows Desktop</span>
          </span>
        </footer>
      </div>
    </div>
  );
};
