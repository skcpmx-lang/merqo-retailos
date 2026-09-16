/**
 * Backup & Restore Screen — P4.3
 * Bengali-first, offline-first, production-grade
 */

import React, { useEffect, useState } from 'react';
import {
  HardDrive,
  Archive,
  CheckCircle,
  AlertTriangle,
  Trash2,
  RefreshCw,
  FolderOpen,
  Download,
  Upload,
  Shield,
  Clock,
  Database,
  FileCheck,
  Info,
  Settings,
  X,
} from 'lucide-react';

interface BackupInfo {
  id: string;
  fileName: string;
  filePath: string;
  fileSizeBytes: number;
  checksum: string;
  createdAt: number;
  appVersion: string;
  schemaVersion: number;
  type: string;
  validationStatus: string;
  exists: boolean;
  isValid: boolean;
}

interface BackupStatus {
  totalBackups: number;
  totalSizeBytes: number;
  lastBackup: BackupInfo | null;
  config: any;
  lastError: string | null;
  backupsDir: string;
  dbPath: string;
}

export const BackupScreen: React.FC = () => {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [validating, setValidating] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string; textBn: string } | null>(null);
  const [selectedBackup, setSelectedBackup] = useState<BackupInfo | null>(null);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [restoreConfirmText, setRestoreConfirmText] = useState('');
  const [validationResult, setValidationResult] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const statusRes = await window.merqo.backup.getStatus();
      if (statusRes.success) {
        setStatus(statusRes.data);
        setConfig(statusRes.data.config);
      }
      const listRes = await window.merqo.backup.list();
      if (listRes.success) {
        setBackups(listRes.data.backups || []);
      }
    } catch (e) {
      setMessage({ type: 'error', text: String(e), textBn: 'ডেটা লোড করা যায়নি' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleString('bn-BD', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const handleCreateBackup = async () => {
    setCreating(true);
    setMessage(null);
    try {
      const res = await window.merqo.backup.create({ type: 'manual' });
      if (res.success) {
        setMessage({ type: 'success', text: `Backup created: ${res.data.backup?.fileName}`, textBn: res.data.messageBn || 'ব্যাকআপ সফলভাবে তৈরি হয়েছে।' });
        loadData();
      } else {
        setMessage({ type: 'error', text: res.error?.message || 'Failed', textBn: res.error?.messageBn || 'ব্যাকআপ তৈরি করা যায়নি। আবার চেষ্টা করুন।' });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: String(e), textBn: 'ব্যাকআপ তৈরি করা যায়নি। আবার চেষ্টা করুন।' });
    } finally {
      setCreating(false);
    }
  };

  const handleValidate = async (filePath: string) => {
    setValidating(filePath);
    setValidationResult(null);
    try {
      const res = await window.merqo.backup.validate(filePath);
      if (res.success) {
        setValidationResult(res.data);
        if (res.data.isValid) {
          setMessage({ type: 'success', text: 'Backup valid', textBn: 'ব্যাকআপ সফলভাবে যাচাই করা হয়েছে।' });
        } else {
          setMessage({ type: 'error', text: `Invalid: ${res.data.errors?.join(', ')}`, textBn: 'ব্যাকআপ ফাইলটি সঠিক নয় বা ক্ষতিগ্রস্ত হতে পারে।' });
        }
      } else {
        setMessage({ type: 'error', text: res.error?.message || 'Validation failed', textBn: res.error?.messageBn || 'যাচাই করা যায়নি' });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: String(e), textBn: 'যাচাই করা যায়নি' });
    } finally {
      setValidating(null);
    }
  };

  const handleDelete = async (filePath: string) => {
    if (!confirm('ব্যাকআপ মুছে ফেলতে চান? এই কাজটি পূর্বাবস্থায় ফেরানো যাবে না।')) return;
    setDeleting(filePath);
    try {
      const res = await window.merqo.backup.delete(filePath);
      if (res.success) {
        setMessage({ type: 'success', text: 'Backup deleted', textBn: 'ব্যাকআপ মুছে ফেলা হয়েছে' });
        loadData();
      } else {
        setMessage({ type: 'error', text: res.error?.message || 'Delete failed', textBn: res.error?.messageBn || 'মুছে ফেলা যায়নি' });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: String(e), textBn: 'মুছে ফেলা যায়নি' });
    } finally {
      setDeleting(null);
    }
  };

  const handleRestore = async () => {
    if (!selectedBackup) return;
    if (restoreConfirmText !== 'RESTORE') {
      setMessage({ type: 'error', text: 'Type RESTORE to confirm', textBn: 'নিশ্চিত করতে RESTORE লিখুন' });
      return;
    }
    setRestoring(selectedBackup.filePath);
    setMessage(null);
    try {
      const res = await window.merqo.backup.restore(selectedBackup.filePath);
      if (res.success) {
        setMessage({ type: 'success', text: `Restore succeeded`, textBn: res.data.messageBn || 'ডেটা সফলভাবে পুনরুদ্ধার করা হয়েছে।' });
        setShowRestoreDialog(false);
        setRestoreConfirmText('');
        // After restore, app should restart or reload? For now reload data
        setTimeout(() => loadData(), 1000);
      } else {
        setMessage({ type: 'error', text: res.error?.message || 'Restore failed', textBn: res.error?.messageBn || 'ডেটা পুনরুদ্ধার সম্পন্ন হয়নি। বর্তমান ডেটা নিরাপদ রাখার চেষ্টা করা হয়েছে।' });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: String(e), textBn: 'ডেটা পুনরুদ্ধার সম্পন্ন হয়নি। বর্তমান ডেটা নিরাপদ রাখার চেষ্টা করা হয়েছে।' });
    } finally {
      setRestoring(null);
    }
  };

  const handleOpenFolder = async () => {
    try {
      await window.merqo.backup.openFolder();
    } catch {}
  };

  const handleSaveConfig = async () => {
    if (!config) return;
    try {
      const res = await window.merqo.backup.saveConfig(config);
      if (res.success) {
        setMessage({ type: 'success', text: 'Config saved', textBn: 'সেটিংস সংরক্ষণ করা হয়েছে' });
      } else {
        setMessage({ type: 'error', text: res.error?.message || 'Failed', textBn: res.error?.messageBn || 'সংরক্ষণ করা যায়নি' });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: String(e), textBn: 'সংরক্ষণ করা যায়নি' });
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-50 rounded-sm flex items-center justify-center">
            <HardDrive size={20} className="text-primary-600" />
          </div>
          <div>
            <h1 className="text-h2 text-text-primary font-semibold">ব্যাকআপ ও পুনরুদ্ধার</h1>
            <p className="text-body-sm text-text-secondary">অফলাইন নিরাপদ ব্যাকআপ — কোনো ইন্টারনেট প্রয়োজন নেই</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-sm border border-border bg-surface text-body-sm hover:bg-subtle transition-colors"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            রিফ্রেশ
          </button>
          <button
            onClick={handleOpenFolder}
            className="flex items-center gap-2 px-3 py-2 rounded-sm border border-border bg-surface text-body-sm hover:bg-subtle transition-colors"
          >
            <FolderOpen size={16} />
            ফোল্ডার খুলুন
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`flex items-start gap-3 p-4 rounded-sm border ${
            message.type === 'success'
              ? 'bg-success-50 border-success-200 text-success-700'
              : message.type === 'error'
              ? 'bg-danger-50 border-danger-200 text-danger-700'
              : 'bg-info-50 border-info-200 text-info-700'
          }`}
        >
          {message.type === 'success' ? <CheckCircle size={18} /> : message.type === 'error' ? <AlertTriangle size={18} /> : <Info size={18} />}
          <div className="flex-1">
            <p className="text-body-sm font-medium">{message.textBn}</p>
            <p className="text-caption opacity-80 mt-1">{message.text}</p>
          </div>
          <button onClick={() => setMessage(null)} className="p-1 hover:bg-black/5 rounded-sm">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Status Cards */}
      {status && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-4">
            <div className="flex items-center gap-2 text-text-secondary text-body-sm">
              <Archive size={16} />
              মোট ব্যাকআপ
            </div>
            <p className="text-h3 font-semibold mt-2">{status.totalBackups}</p>
            <p className="text-caption text-text-tertiary">{formatBytes(status.totalSizeBytes)} মোট</p>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 text-text-secondary text-body-sm">
              <Clock size={16} />
              সর্বশেষ ব্যাকআপ
            </div>
            <p className="text-body-sm font-medium mt-2">
              {status.lastBackup ? formatDate(status.lastBackup.createdAt) : 'কোনো ব্যাকআপ নেই'}
            </p>
            <p className="text-caption text-text-tertiary truncate">{status.lastBackup?.fileName || '-'}</p>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 text-text-secondary text-body-sm">
              <Database size={16} />
              ডাটাবেস পাথ
            </div>
            <p className="text-caption font-mono mt-2 truncate" title={status.dbPath}>
              {status.dbPath}
            </p>
            <p className="text-caption text-text-tertiary truncate mt-1" title={status.backupsDir}>
              ব্যাকআপ: {status.backupsDir}
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="card p-5">
        <h2 className="text-h3 font-semibold flex items-center gap-2">
          <Download size={18} />
          ব্যাকআপ
        </h2>
        <p className="text-body-sm text-text-secondary mt-1">
          বর্তমান ডাটাবেসের একটি নিরাপদ কপি তৈরি করুন। ব্যাকআপ তৈরির সময় WAL সহ সম্পূর্ণ ডাটা কপি করা হয়, যাচাই করা হয় এবং checksum গণনা করা হয়।
        </p>
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={handleCreateBackup}
            disabled={creating}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-500 text-white rounded-sm text-body-sm font-medium hover:bg-primary-600 disabled:opacity-50 transition-colors"
          >
            {creating ? <RefreshCw size={16} className="animate-spin" /> : <Archive size={16} />}
            {creating ? 'ব্যাকআপ তৈরি হচ্ছে...' : 'এখনই ব্যাকআপ নিন'}
          </button>
          <span className="text-caption text-text-tertiary">অফলাইন, কোনো ইন্টারনেট লাগে না</span>
        </div>
        {status?.lastError && (
          <div className="mt-3 p-3 bg-danger-50 border border-danger-100 rounded-sm text-body-sm text-danger-700">
            শেষ ত্রুটি: {status.lastError}
          </div>
        )}
      </div>

      {/* Backup List */}
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-h3 font-semibold flex items-center gap-2">
            <FileCheck size={18} />
            ব্যাকআপ তালিকা
          </h2>
          <span className="text-caption text-text-tertiary">{backups.length} টি ফাইল</span>
        </div>

        {backups.length === 0 ? (
          <div className="text-center py-12 text-text-secondary">
            <Archive size={32} className="mx-auto opacity-50" />
            <p className="text-body-sm mt-3">কোনো ব্যাকআপ পাওয়া যায়নি</p>
            <p className="text-caption mt-1">এখনই ব্যাকআপ নিন বাটনে ক্লিক করুন</p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-body-sm">
              <thead>
                <tr className="border-b border-border text-left text-caption text-text-tertiary">
                  <th className="pb-2 font-medium">তারিখ</th>
                  <th className="pb-2 font-medium">ধরন</th>
                  <th className="pb-2 font-medium">আকার</th>
                  <th className="pb-2 font-medium">সংস্করণ</th>
                  <th className="pb-2 font-medium">যাচাই</th>
                  <th className="pb-2 font-medium">অবস্থান</th>
                  <th className="pb-2 font-medium text-right">ক্রিয়া</th>
                </tr>
              </thead>
              <tbody>
                {backups.map(b => (
                  <tr key={b.filePath} className="border-b border-border/50 hover:bg-subtle/50">
                    <td className="py-3">
                      <div className="font-medium">{formatDate(b.createdAt)}</div>
                      <div className="text-caption text-text-tertiary truncate max-w-[200px]">{b.fileName}</div>
                    </td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-0.5 rounded-sm text-caption ${
                          b.type === 'manual'
                            ? 'bg-primary-50 text-primary-700'
                            : b.type === 'safety-pre-restore'
                            ? 'bg-warning-50 text-warning-700'
                            : 'bg-subtle text-text-secondary'
                        }`}
                      >
                        {b.type === 'manual' ? 'ম্যানুয়াল' : b.type === 'safety-pre-restore' ? 'নিরাপত্তা' : b.type}
                      </span>
                    </td>
                    <td className="py-3">{formatBytes(b.fileSizeBytes)}</td>
                    <td className="py-3">
                      <div className="text-caption">{b.appVersion}</div>
                      <div className="text-caption text-text-tertiary">schema {b.schemaVersion}</div>
                    </td>
                    <td className="py-3">
                      {b.validationStatus === 'valid' ? (
                        <span className="flex items-center gap-1 text-success-600 text-caption">
                          <CheckCircle size={14} /> বৈধ
                        </span>
                      ) : b.validationStatus === 'invalid' ? (
                        <span className="flex items-center gap-1 text-danger-600 text-caption">
                          <AlertTriangle size={14} /> অবৈধ
                        </span>
                      ) : (
                        <span className="text-caption text-text-tertiary">অজানা</span>
                      )}
                    </td>
                    <td className="py-3 max-w-[150px] truncate text-caption" title={b.filePath}>
                      {b.filePath}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleValidate(b.filePath)}
                          disabled={validating === b.filePath}
                          className="p-1.5 rounded-sm hover:bg-subtle text-text-secondary hover:text-text-primary transition-colors"
                          title="যাচাই"
                        >
                          {validating === b.filePath ? <RefreshCw size={14} className="animate-spin" /> : <FileCheck size={14} />}
                        </button>
                        <button
                          onClick={() => {
                            setSelectedBackup(b);
                            setShowRestoreDialog(true);
                          }}
                          disabled={restoring === b.filePath}
                          className="p-1.5 rounded-sm hover:bg-primary-50 text-primary-600 hover:text-primary-700 transition-colors"
                          title="পুনরুদ্ধার"
                        >
                          {restoring === b.filePath ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
                        </button>
                        <button
                          onClick={() => handleDelete(b.filePath)}
                          disabled={deleting === b.filePath}
                          className="p-1.5 rounded-sm hover:bg-danger-50 text-text-secondary hover:text-danger-600 transition-colors"
                          title="মুছুন"
                        >
                          {deleting === b.filePath ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Validation Result */}
      {validationResult && (
        <div className="card p-5 border-l-4 border-l-primary-500">
          <h3 className="text-body font-semibold flex items-center gap-2">
            <Shield size={16} />
            যাচাই ফলাফল
          </h3>
          <div className="grid grid-cols-2 gap-3 mt-3 text-body-sm">
            <div>
              <span className="text-caption text-text-tertiary">Integrity Check:</span>{' '}
              {validationResult.integrityCheck?.ok ? <span className="text-success-600">OK</span> : <span className="text-danger-600">FAIL</span>}
            </div>
            <div>
              <span className="text-caption text-text-tertiary">Foreign Key:</span>{' '}
              {validationResult.foreignKeyCheck?.ok ? <span className="text-success-600">OK</span> : <span className="text-danger-600">FAIL</span>}
            </div>
            <div>
              <span className="text-caption text-text-tertiary">Tables:</span> {validationResult.tablesCheck?.existingTables?.length || 0} found
            </div>
            <div>
              <span className="text-caption text-text-tertiary">Migrations:</span> {validationResult.migrationsCheck?.count || 0}
            </div>
            {validationResult.checksum && (
              <div className="col-span-2">
                <span className="text-caption text-text-tertiary">SHA-256:</span>{' '}
                <span className="font-mono text-caption">{validationResult.checksum.slice(0, 16)}...</span>
              </div>
            )}
          </div>
          {validationResult.errors?.length > 0 && (
            <div className="mt-3 p-3 bg-danger-50 rounded-sm text-body-sm text-danger-700">
              {validationResult.errors.map((e: string, i: number) => (
                <div key={i}>• {e}</div>
              ))}
            </div>
          )}
          {validationResult.warnings?.length > 0 && (
            <div className="mt-2 p-3 bg-warning-50 rounded-sm text-body-sm text-warning-700">
              {validationResult.warnings.map((w: string, i: number) => (
                <div key={i}>• {w}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Config */}
      <div className="card p-5">
        <h2 className="text-h3 font-semibold flex items-center gap-2">
          <Settings size={18} />
          ব্যাকআপ সেটিংস
        </h2>
        {config && (
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-body-sm font-medium">অটো ব্যাকআপ স্টার্টআপে</p>
                <p className="text-caption text-text-tertiary">অ্যাপ চালু হলে স্বয়ংক্রিয় ব্যাকআপ</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.autoBackupOnStartup}
                  onChange={e => setConfig({ ...config, autoBackupOnStartup: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-body-sm font-medium">সংরক্ষণ সংখ্যা</p>
                <p className="text-caption text-text-tertiary">সর্বশেষ কতটি ব্যাকআপ রাখা হবে</p>
              </div>
              <input
                type="number"
                min={1}
                max={100}
                value={config.retentionCount}
                onChange={e => setConfig({ ...config, retentionCount: parseInt(e.target.value) || 10 })}
                className="w-20 px-2 py-1.5 border border-border rounded-sm text-body-sm"
              />
            </div>
            <button
              onClick={handleSaveConfig}
              className="px-4 py-2 bg-surface border border-border rounded-sm text-body-sm hover:bg-subtle transition-colors"
            >
              সংরক্ষণ করুন
            </button>
            <div className="pt-3 border-t border-border text-caption text-text-tertiary">
              <p>• ব্যাকআপ ফাইলগুলিতে ব্যবসার সংবেদনশীল তথ্য থাকে, নিরাপদে সংরক্ষণ করুন</p>
              <p>• ক্লাউড ব্যাকআপ V1 এ নেই, ভবিষ্যৎ পরিকল্পনা</p>
              <p>• ব্যাকআপ ফোল্ডার অ্যাপ আপডেটে মুছে যায় না (userData)</p>
            </div>
          </div>
        )}
      </div>

      {/* Restore Dialog */}
      {showRestoreDialog && selectedBackup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-lg w-full p-6">
            <div className="flex items-center gap-3 text-danger-600">
              <AlertTriangle size={24} />
              <h3 className="text-h3 font-semibold">ব্যাকআপ পুনরুদ্ধার</h3>
            </div>
            <div className="mt-4 space-y-3 text-body-sm">
              <p>ব্যাকআপ পুনরুদ্ধার করলে বর্তমান ডেটা প্রতিস্থাপিত হবে। চালিয়ে যাওয়ার আগে বর্তমান ডেটার একটি নিরাপত্তা ব্যাকআপ তৈরি করা হবে।</p>
              <div className="p-3 bg-subtle rounded-sm text-caption">
                <div>ফাইল: {selectedBackup.fileName}</div>
                <div>তারিখ: {formatDate(selectedBackup.createdAt)}</div>
                <div>আকার: {formatBytes(selectedBackup.fileSizeBytes)}</div>
                <div>সংস্করণ: {selectedBackup.appVersion} (schema {selectedBackup.schemaVersion})</div>
                <div>ধরন: {selectedBackup.type}</div>
              </div>
              <div className="p-3 bg-warning-50 border border-warning-200 rounded-sm text-warning-800">
                <p className="font-medium">সতর্কতা:</p>
                <p>• বর্তমান ডেটা ব্যাকআপ করা হবে, যাচাই করা হবে, তারপর পুনরুদ্ধার হবে</p>
                <p>• যদি নিরাপত্তা ব্যাকআপ ব্যর্থ হয়, পুনরুদ্ধার বন্ধ হবে</p>
                <p>• পুনরুদ্ধার ব্যর্থ হলে স্বয়ংক্রিয়ভাবে আগের ডেটায় ফিরে যাওয়ার চেষ্টা করা হবে</p>
              </div>
              <div>
                <label className="text-body-sm font-medium">নিশ্চিত করতে RESTORE লিখুন</label>
                <input
                  type="text"
                  value={restoreConfirmText}
                  onChange={e => setRestoreConfirmText(e.target.value)}
                  placeholder="RESTORE"
                  className="w-full mt-1 px-3 py-2 border border-border rounded-sm text-body-sm font-mono"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowRestoreDialog(false);
                  setRestoreConfirmText('');
                }}
                className="px-4 py-2 rounded-sm border border-border bg-surface text-body-sm hover:bg-subtle"
              >
                বাতিল
              </button>
              <button
                onClick={handleRestore}
                disabled={restoring !== null || restoreConfirmText !== 'RESTORE'}
                className="px-5 py-2 rounded-sm bg-danger-600 text-white text-body-sm font-medium hover:bg-danger-700 disabled:opacity-50 flex items-center gap-2"
              >
                {restoring ? <RefreshCw size={16} className="animate-spin" /> : <Upload size={16} />}
                পুনরুদ্ধার করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Recovery Info */}
      <div className="card p-5 bg-info-50/50 border-info-200">
        <h3 className="text-body font-semibold flex items-center gap-2">
          <Info size={16} />
          ম্যানুয়াল রিকভারি (সাপোর্টের জন্য)
        </h3>
        <div className="mt-2 text-caption text-text-secondary space-y-1">
          <p>• userData সাধারণত: %APPDATA%\MERQO RetailOS\ (Windows) — merqo.db</p>
          <p>• ব্যাকআপ: {status?.backupsDir || '...\\backups'}</p>
          <p>• ব্যাকআপ ফাইল: MERQO-RetailOS-Backup-YYYY-MM-DD-HH-mm-ss-*.db + .json</p>
          <p>• পুনরুদ্ধারের আগে বর্তমান merqo.db সংরক্ষণ করুন</p>
          <p>• অ্যাপের মাধ্যমে পুনরুদ্ধার করুন, সরাসরি ফাইল এডিট করবেন না</p>
          <p>• অ্যাপ চালু না হলে logs ফোল্ডার দেখুন</p>
        </div>
      </div>
    </div>
  );
};
