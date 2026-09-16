import React, { useEffect, useState } from 'react';
import { AppShell } from './components/layout/AppShell';
import { Dashboard } from './screens/Dashboard';
import { SupplierList } from './screens/purchasing/SupplierList';
import { SupplierDetail } from './screens/purchasing/SupplierDetail';
import { PurchaseList } from './screens/purchasing/PurchaseList';
import { PurchaseForm } from './screens/purchasing/PurchaseForm';
import { PurchaseDetail } from './screens/purchasing/PurchaseDetail';
import { CustomerList } from './screens/customers/CustomerList';
import { CustomerDetail } from './screens/customers/CustomerDetail';
import { SaleList } from './screens/sales/SaleList';
import { SaleForm } from './screens/sales/SaleForm';
import { SaleDetail } from './screens/sales/SaleDetail';
import { POSScreen } from './screens/pos/POSScreen';
import { FinanceOverview } from './screens/finance/FinanceOverview';
import { CashAccountsScreen } from './screens/finance/CashAccountsScreen';
import { BankAccountsScreen } from './screens/finance/BankAccountsScreen';
import { MfsAccountsScreen } from './screens/finance/MfsAccountsScreen';
import { ExpensesScreen } from './screens/finance/ExpensesScreen';
import { TransfersScreen } from './screens/finance/TransfersScreen';
import { ShiftsScreen } from './screens/finance/ShiftsScreen';
import { HardwareSettingsScreen } from './screens/hardware/HardwareSettingsScreen';
import { BackupScreen } from './screens/backup/BackupScreen';
import { ReportsScreen } from './screens/reports/ReportsScreen';
import './lib/i18n';

type Screen = 'dashboard' | 'suppliers' | 'supplier-detail' | 'purchases' | 'purchase-form' | 'purchase-detail' | 'customers' | 'customer-detail' | 'sales' | 'sale-form' | 'sale-detail' | 'pos' | 'finance' | 'cash-accounts' | 'bank-accounts' | 'mfs-accounts' | 'expenses' | 'transfers' | 'shifts' | 'hardware' | 'backup' | 'reports';

export const App: React.FC = () => {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<Screen>('dashboard');
  const [businessId, setBusinessId] = useState<string>('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedSaleId, setSelectedSaleId] = useState<string>('');

  useEffect(() => {
    async function init() {
      try {
        if (!window.merqo) throw new Error('Preload bridge not available');
        const dbStatus = await window.merqo.db.getStatus();
        if (!dbStatus.success) throw new Error(dbStatus.error?.message || 'DB failed');
        const bizRes = await window.merqo.business.get();
        if (bizRes.success && bizRes.data) setBusinessId(bizRes.data.id);
        else setBusinessId('default-biz');
        setReady(true);
      } catch (e) {
        setError(String(e));
      }
    }
    init();
  }, []);

  const navigate = (key: string) => setActiveKey(key as Screen);

  if (error) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-canvas">
        <div className="border border-danger-200 bg-danger-50 rounded-sm max-w-md p-6 text-center">
          <h2 className="text-h3 font-semibold text-danger-700">ত্রুটি</h2>
          <p className="text-body-sm text-text-secondary mt-2 leading-relaxed">{error}</p>
          <p className="text-caption text-text-tertiary mt-4">সাপোর্ট: merqoonline@gmail.com</p>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-canvas">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <div className="text-center">
            <p className="text-body font-medium text-text-primary">MERQO RetailOS লোড হচ্ছে...</p>
            <p className="text-caption text-text-tertiary mt-1">P4.5 UI/UX Polish • Light Only • Offline-first</p>
          </div>
        </div>
      </div>
    );
  }

  const renderScreen = () => {
    switch (activeKey) {
      case 'suppliers':
        return <SupplierList businessId={businessId} onSelectSupplier={id => { setSelectedSupplierId(id); setActiveKey('supplier-detail'); }} />;
      case 'supplier-detail':
        return <SupplierDetail supplierId={selectedSupplierId} businessId={businessId} onBack={() => setActiveKey('suppliers')} />;
      case 'purchases':
        return <PurchaseList businessId={businessId} onSelect={id => { setSelectedPurchaseId(id); setActiveKey('purchase-detail'); }} onCreate={() => setActiveKey('purchase-form')} />;
      case 'purchase-form':
        return <PurchaseForm businessId={businessId} onBack={() => setActiveKey('purchases')} onSuccess={id => { setSelectedPurchaseId(id); setActiveKey('purchase-detail'); }} />;
      case 'purchase-detail':
        return <PurchaseDetail purchaseId={selectedPurchaseId} businessId={businessId} onBack={() => setActiveKey('purchases')} />;
      case 'customers':
        return <CustomerList businessId={businessId} onSelectCustomer={id => { setSelectedCustomerId(id); setActiveKey('customer-detail'); }} />;
      case 'customer-detail':
        return <CustomerDetail customerId={selectedCustomerId} businessId={businessId} onBack={() => setActiveKey('customers')} />;
      case 'sales':
        return <SaleList businessId={businessId} onSelect={id => { setSelectedSaleId(id); setActiveKey('sale-detail'); }} onCreate={() => setActiveKey('sale-form')} />;
      case 'sale-form':
        return <SaleForm businessId={businessId} onBack={() => setActiveKey('sales')} onSuccess={id => { setSelectedSaleId(id); setActiveKey('sale-detail'); }} />;
      case 'sale-detail':
        return <SaleDetail saleId={selectedSaleId} businessId={businessId} onBack={() => setActiveKey('sales')} />;
      case 'pos':
        return <POSScreen businessId={businessId} />;
      case 'finance':
        return <FinanceOverview businessId={businessId} />;
      case 'cash-accounts':
        return <CashAccountsScreen businessId={businessId} />;
      case 'bank-accounts':
        return <BankAccountsScreen businessId={businessId} />;
      case 'mfs-accounts':
        return <MfsAccountsScreen businessId={businessId} />;
      case 'expenses':
        return <ExpensesScreen businessId={businessId} />;
      case 'transfers':
        return <TransfersScreen businessId={businessId} />;
      case 'shifts':
        return <ShiftsScreen businessId={businessId} />;
      case 'hardware':
        return <HardwareSettingsScreen />;
      case 'backup':
        return <BackupScreen />;
      case 'reports':
        return <ReportsScreen businessId={businessId} />;
      default:
        return <Dashboard businessId={businessId} />;
    }
  };

  return (
    <AppShell activeKey={activeKey} onNavigate={navigate}>
      {renderScreen()}
    </AppShell>
  );
};
