import React, { useEffect, useState } from 'react';
import { AppShell } from './components/layout/AppShell';
import { Dashboard } from './screens/Dashboard';
import { SupplierList } from './screens/purchasing/SupplierList';
import { SupplierDetail } from './screens/purchasing/SupplierDetail';
import { PurchaseList } from './screens/purchasing/PurchaseList';
import { PurchaseForm } from './screens/purchasing/PurchaseForm';
import { PurchaseDetail } from './screens/purchasing/PurchaseDetail';
import './lib/i18n';

type Screen = 'dashboard' | 'suppliers' | 'supplier-detail' | 'purchases' | 'purchase-form' | 'purchase-detail';

export const App: React.FC = () => {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<Screen>('dashboard');
  const [businessId, setBusinessId] = useState<string>('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string>('');

  useEffect(() => {
    async function init() {
      try {
        if (!window.merqo) {
          throw new Error('Preload bridge not available');
        }

        const dbStatus = await window.merqo.db.getStatus();
        if (!dbStatus.success) {
          throw new Error(dbStatus.error?.message || 'DB failed');
        }

        // Get business id
        const bizRes = await window.merqo.business.get();
        if (bizRes.success && bizRes.data) {
          setBusinessId(bizRes.data.id);
        } else {
          // Fallback: try to get from DB directly via first business
          // For now, use a placeholder that will be overridden by first business in list
          // We'll fetch business list via suppliers? Actually need business
          // Let's try to query businesses table via a temporary IPC? For now, set empty and UI will handle
          // In real app, first-run will create business
          setBusinessId('default-biz');
        }

        setReady(true);
      } catch (e) {
        setError(String(e));
      }
    }

    init();
  }, []);

  const navigate = (key: string) => {
    setActiveKey(key as Screen);
  };

  if (error) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-canvas">
        <div className="card max-w-md p-6 text-center">
          <h2 className="text-h2 text-danger-600">ত্রুটি</h2>
          <p className="text-body-sm text-text-secondary mt-2">{error}</p>
          <p className="text-caption text-text-tertiary mt-4">সাপোর্ট: merqoonline@gmail.com</p>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-canvas">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-body text-text-secondary">অ্যাপ লোড হচ্ছে...</p>
          <p className="text-caption text-text-tertiary">MERQO RetailOS — Phase 3A Purchasing</p>
        </div>
      </div>
    );
  }

  const renderScreen = () => {
    switch (activeKey) {
      case 'suppliers':
        return (
          <SupplierList
            businessId={businessId}
            onSelectSupplier={id => {
              setSelectedSupplierId(id);
              setActiveKey('supplier-detail');
            }}
          />
        );
      case 'supplier-detail':
        return (
          <SupplierDetail supplierId={selectedSupplierId} businessId={businessId} onBack={() => setActiveKey('suppliers')} />
        );
      case 'purchases':
        return (
          <PurchaseList
            businessId={businessId}
            onSelect={id => {
              setSelectedPurchaseId(id);
              setActiveKey('purchase-detail');
            }}
            onCreate={() => setActiveKey('purchase-form')}
          />
        );
      case 'purchase-form':
        return (
          <PurchaseForm
            businessId={businessId}
            onBack={() => setActiveKey('purchases')}
            onSuccess={id => {
              setSelectedPurchaseId(id);
              setActiveKey('purchase-detail');
            }}
          />
        );
      case 'purchase-detail':
        return (
          <PurchaseDetail purchaseId={selectedPurchaseId} businessId={businessId} onBack={() => setActiveKey('purchases')} />
        );
      default:
        return <Dashboard />;
    }
  };

  return (
    <AppShell activeKey={activeKey} onNavigate={navigate}>
      {renderScreen()}
    </AppShell>
  );
};
