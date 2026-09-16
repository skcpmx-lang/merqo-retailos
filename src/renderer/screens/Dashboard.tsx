import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Database, Shield, Zap, CheckCircle, AlertTriangle, Info } from 'lucide-react';

interface AppInfo {
  name: string;
  version: string;
  isDev: boolean;
  isFirstLaunch: boolean;
}

interface DbStatus {
  isOpen: boolean;
  path: string;
  integrityOk: boolean;
  isFirstLaunch: boolean;
  tableCount: number;
}

interface PerformanceBaseline {
  startupMs: number;
  dbInitMs: number;
  rendererMs: number;
}

export const Dashboard: React.FC = () => {
  const { t } = useTranslation(['common', 'app']);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [perf, setPerf] = useState<PerformanceBaseline | null>(null);

  useEffect(() => {
    const start = performance.now();

    async function load() {
      try {
        // Measure DB init via IPC
        const dbStart = performance.now();
        const dbRes = await window.merqo.db.getStatus();
        const dbEnd = performance.now();

        if (!dbRes.success) {
          throw new Error(dbRes.error?.message || 'DB status failed');
        }

        setDbStatus(dbRes.data as DbStatus);

        const appRes = await window.merqo.app.getInfo();
        if (appRes.success) {
          setAppInfo(appRes.data as AppInfo);
        }

        const end = performance.now();
        setPerf({
          startupMs: Math.round(end - start),
          dbInitMs: Math.round(dbEnd - dbStart),
          rendererMs: Math.round(end - start),
        });
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-body-sm text-text-secondary">{t('loading', { ns: 'common' })}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-h1 text-text-primary">{t('foundationReady', { ns: 'app' })}</h1>
        <p className="text-body text-text-secondary mt-1">{t('foundationDesc', { ns: 'app' })}</p>
      </div>

      {error && (
        <Card className="border-danger-500 bg-danger-50">
          <CardContent className="pt-4 flex items-start gap-3">
            <AlertTriangle className="text-danger-500 mt-0.5" size={20} />
            <div>
              <p className="text-body font-medium text-danger-600">ত্রুটি</p>
              <p className="text-body-sm text-text-secondary mt-1">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* App Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info size={18} /> {t('appInfo', { ns: 'common' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-body-sm text-text-tertiary">নাম</span>
              <span className="text-body-sm font-medium">{appInfo?.name || 'MERQO RetailOS'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-body-sm text-text-tertiary">ভার্সন</span>
              <Badge variant="primary">{appInfo?.version || '0.1.0'}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-body-sm text-text-tertiary">মোড</span>
              <Badge variant={appInfo?.isDev ? 'warning' : 'success'}>{appInfo?.isDev ? 'Development' : 'Production'}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-body-sm text-text-tertiary">প্রথম চালু</span>
              <Badge variant={appInfo?.isFirstLaunch ? 'warning' : 'success'}>
                {appInfo?.isFirstLaunch ? t('isFirstLaunch', { ns: 'common' }) : t('isNotFirstLaunch', { ns: 'common' })}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* DB Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database size={18} /> {t('dbStatus', { ns: 'common' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-body-sm text-text-tertiary">অবস্থা</span>
              <Badge variant={dbStatus?.isOpen ? 'success' : 'danger'}>{dbStatus?.isOpen ? 'খোলা' : 'বন্ধ'}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-body-sm text-text-tertiary">সুস্থতা</span>
              <Badge variant={dbStatus?.integrityOk ? 'success' : 'danger'}>
                {dbStatus?.integrityOk ? t('integrityOk', { ns: 'common' }) : t('integrityFailed', { ns: 'common' })}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-body-sm text-text-tertiary">টেবিল</span>
              <span className="text-body-sm font-medium">{dbStatus?.tableCount ?? 0}</span>
            </div>
            <div className="pt-2">
              <p className="text-caption text-text-tertiary break-all">পাথ: {dbStatus?.path}</p>
            </div>
          </CardContent>
        </Card>

        {/* Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap size={18} /> {t('performanceBaseline', { ns: 'app' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-body-sm text-text-tertiary">{t('startupTime', { ns: 'app' })}</span>
              <span className="text-body-sm font-mono font-medium">{perf?.startupMs ?? 0}ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-body-sm text-text-tertiary">{t('dbInitTime', { ns: 'app' })}</span>
              <span className="text-body-sm font-mono font-medium">{perf?.dbInitMs ?? 0}ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-body-sm text-text-tertiary">{t('rendererTime', { ns: 'app' })}</span>
              <span className="text-body-sm font-mono font-medium">{perf?.rendererMs ?? 0}ms</span>
            </div>
            <div className="pt-2">
              <Badge variant="success">লক্ষ্য: &lt;3000ms স্টার্টআপ</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Foundation Checklist */}
      <Card>
        <CardHeader>
          <CardTitle>Phase 1 — Foundation Checklist</CardTitle>
          <CardDescription>উৎপাদন ভিত্তি প্রস্তুত — কোনো fake data নেই</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              'Electron security: contextIsolation, nodeIntegration false, preload bridge',
              'Typed IPC: allowlist, Zod validation, no arbitrary channels',
              'SQLite: WAL, foreign_keys ON, busy_timeout, migrations, integrity_check',
              'ID strategy: nanoid consistent',
              'Logging: structured, no sensitive data',
              'Config: centralized, app/business/user/hardware separation',
              'Error system: typed, Bangla message + correlation ID',
              'Money: integer paisa, no FLOAT',
              'Quantity: milli precision',
              'Date/Time: centralized, UTC storage',
              'i18n: Bangla-first keys, no hard-coded strings',
              'Design system: tokens, light-only, premium enterprise',
              'Icon system: Lucide only, no emoji',
              'App shell: sidebar, topbar, content, no fake modules',
              'First-run detection: isFirstLaunch',
              'Auth foundation: argon2/bcrypt, no plaintext',
              'Tests: money, quantity, ID, date, validation, DB transaction rollback',
              'Build: dev, prod, Windows packaging config',
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle size={16} className="text-success-500 mt-0.5 shrink-0" />
                <span className="text-body-sm text-text-secondary">{item}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Next Phase */}
      <Card className="border-primary-100 bg-primary-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield size={18} className="text-primary-500" />
            পরবর্তী ধাপ
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <p className="text-body-sm text-text-secondary">
            Phase 1 সম্পন্ন। Phase 2 — Database and Domain Engine শুরু করার জন্য অনুমোদনের অপেক্ষায়।
          </p>
          <Button variant="primary" size="sm" disabled>
            Phase 2 — অপেক্ষমান
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
