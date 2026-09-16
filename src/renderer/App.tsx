import React, { useEffect, useState } from 'react';
import { AppShell } from './components/layout/AppShell';
import { Dashboard } from './screens/Dashboard';
import './lib/i18n';

export const App: React.FC = () => {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        // Check if window.merqo exists (preload bridge)
        if (!window.merqo) {
          throw new Error('Preload bridge not available');
        }

        // Quick health check
        const dbStatus = await window.merqo.db.getStatus();
        if (!dbStatus.success) {
          throw new Error(dbStatus.error?.message || 'DB failed');
        }

        setReady(true);
      } catch (e) {
        setError(String(e));
      }
    }

    init();
  }, []);

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
          <p className="text-caption text-text-tertiary">MERQO RetailOS — Phase 1 Foundation</p>
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      <Dashboard />
    </AppShell>
  );
};
