import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import {
  usePrinters,
  useDefaultPrinter,
  useConfiguredPrinter,
  useSavePrinterConfig,
  useTestPrinter,
  useScannerConfig,
  useSaveScannerConfig,
  useHardwareDiagnostics,
  useBarcodeTest,
  usePrinterStatus,
} from '../../hooks/useHardware';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { Printer, ScanLine, Settings, AlertTriangle, CheckCircle, Monitor, FileText, Receipt, Wrench, Info } from 'lucide-react';

export const HardwareSettingsScreen: React.FC = () => {
  const { data: printersData, isLoading: printersLoading, refetch: refetchPrinters } = usePrinters();
  const { data: defaultPrinter } = useDefaultPrinter();
  const { data: configuredPrinter, isLoading: configLoading } = useConfiguredPrinter();
  const { data: scannerConfig, isLoading: scannerLoading } = useScannerConfig();
  const { data: diagnostics, refetch: refetchDiagnostics } = useHardwareDiagnostics();

  const savePrinterMut = useSavePrinterConfig();
  const saveScannerMut = useSaveScannerConfig();
  const testPrinterMut = useTestPrinter();
  const barcodeTestMut = useBarcodeTest();

  const printers = printersData?.printers || [];

  const [selectedPrinterId, setSelectedPrinterId] = useState<string>('');
  const [selectedPrinterName, setSelectedPrinterName] = useState<string>('');
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>('80mm');
  const [a4PrinterId, setA4PrinterId] = useState<string>('');
  const [a4PrinterName, setA4PrinterName] = useState<string>('');
  const [autoPrint, setAutoPrint] = useState(false);
  const [copies, setCopies] = useState(1);
  const [footer, setFooter] = useState('ধন্যবাদ, আবার আসবেন');

  const [scannerEnabled, setScannerEnabled] = useState(true);
  const [scannerSuffix, setScannerSuffix] = useState<'Enter' | 'Tab' | 'None'>('Enter');
  const [minLength, setMinLength] = useState(3);
  const [charThreshold, setCharThreshold] = useState(50);
  const [scanTimeout, setScanTimeout] = useState(150);

  const [testBarcode, setTestBarcode] = useState('');
  const [lastScanned, setLastScanned] = useState<{ barcode: string; isScanner: boolean; timestamp: number } | null>(null);

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load config into form
  useEffect(() => {
    if (configuredPrinter) {
      setSelectedPrinterId(configuredPrinter.selectedPrinterId || '');
      setSelectedPrinterName(configuredPrinter.selectedPrinterName || '');
      setPaperWidth(configuredPrinter.paperWidth === '58mm' ? '58mm' : '80mm');
      setA4PrinterId(configuredPrinter.a4PrinterId || '');
      setA4PrinterName(configuredPrinter.a4PrinterName || '');
      setAutoPrint(!!configuredPrinter.autoPrintOnSale);
      setCopies(configuredPrinter.copies || 1);
      setFooter(configuredPrinter.receiptFooter || 'ধন্যবাদ, আবার আসবেন');
    }
  }, [configuredPrinter]);

  useEffect(() => {
    if (scannerConfig) {
      setScannerEnabled(scannerConfig.enabled !== false);
      setScannerSuffix(scannerConfig.suffix || 'Enter');
      setMinLength(scannerConfig.minLength || 3);
      setCharThreshold(scannerConfig.charThresholdMs || 50);
      setScanTimeout(scannerConfig.scanTimeoutMs || 150);
    }
  }, [scannerConfig]);

  const scanner = useBarcodeScanner({
    onScan: (barcode, isScanner) => {
      setLastScanned({ barcode, isScanner, timestamp: Date.now() });
      setTestBarcode(barcode);
    },
    enabled: scannerEnabled,
    minLength,
    maxLength: 64,
    scanTimeoutMs: scanTimeout,
    charThresholdMs: charThreshold,
    suffix: scannerSuffix,
  });

  const handleSavePrinter = async () => {
    try {
      await savePrinterMut.mutateAsync({
        selectedPrinterId: selectedPrinterId || null,
        selectedPrinterName: selectedPrinterName || null,
        paperWidth,
        a4PrinterId: a4PrinterId || null,
        a4PrinterName: a4PrinterName || null,
        autoPrintOnSale: autoPrint,
        copies,
        receiptFooter: footer,
      });
      setMessage({ type: 'success', text: 'প্রিন্টার সেটিংস সংরক্ষিত হয়েছে' });
      setTimeout(() => setMessage(null), 3000);
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    }
  };

  const handleSaveScanner = async () => {
    try {
      await saveScannerMut.mutateAsync({
        enabled: scannerEnabled,
        minLength,
        suffix: scannerSuffix,
        charThresholdMs: charThreshold,
        scanTimeoutMs: scanTimeout,
      });
      setMessage({ type: 'success', text: 'স্ক্যানার সেটিংস সংরক্ষিত হয়েছে' });
      setTimeout(() => setMessage(null), 3000);
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    }
  };

  const handleTestPrinter = async (printerId: string) => {
    try {
      const result = await testPrinterMut.mutateAsync(printerId);
      if (result.success) {
        setMessage({ type: 'success', text: `প্রিন্ট সফল: ${result.printerName || printerId}` });
      } else {
        setMessage({ type: 'error', text: result.messageBn || 'প্রিন্ট ব্যর্থ' });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    }
  };

  const handleBarcodeLookup = async () => {
    if (!testBarcode.trim()) return;
    try {
      const result = await barcodeTestMut.mutateAsync(testBarcode.trim());
      if (result.found) {
        setMessage({ type: 'success', text: `${result.products.length} টি পণ্য পাওয়া গেছে` });
      } else {
        setMessage({ type: 'error', text: result.messageBn || 'পণ্য পাওয়া যায়নি' });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h3 font-semibold tracking-tight font-bold text-text-primary flex items-center gap-2">
            <Wrench size={20} className="text-primary-500" />
            হার্ডওয়্যার সেটিংস
          </h1>
          <p className="text-body-sm text-text-secondary mt-1">বারকোড স্ক্যানার ও প্রিন্টার কনফিগারেশন — অফলাইন, কোনো ক্লাউড নেই</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => { refetchPrinters(); refetchDiagnostics(); }}>
          রিফ্রেশ
        </Button>
      </div>

      {message && (
        <div className={`p-3 rounded border flex items-start gap-2 ${message.type === 'success' ? 'bg-success-50 border-success-200 text-success-700' : 'bg-danger-50 border-danger-200 text-danger-700'}`}>
          {message.type === 'success' ? <CheckCircle size={16} className="mt-0.5" /> : <AlertTriangle size={16} className="mt-0.5" />}
          <span className="text-body-sm">{message.text}</span>
          <Button variant="ghost" size="sm" className="ml-auto h-6" onClick={() => setMessage(null)}>✕</Button>
        </div>
      )}

      {/* Diagnostics */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-body">
            <Monitor size={16} /> ডায়াগনস্টিকস
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-body-sm">
          <div className="bg-subtle p-3 rounded">
            <div className="text-caption text-text-tertiary">প্রিন্টার পাওয়া গেছে</div>
            <div className="font-mono font-bold text-h3">{diagnostics?.printersDetected ?? printers.length}</div>
          </div>
          <div className="bg-subtle p-3 rounded">
            <div className="text-caption text-text-tertiary">ডিফল্ট প্রিন্টার</div>
            <div className="font-medium truncate">{diagnostics?.defaultPrinter || defaultPrinter?.name || 'পাওয়া যায়নি'}</div>
          </div>
          <div className="bg-subtle p-3 rounded">
            <div className="text-caption text-text-tertiary">কনফিগার্ড রসিদ প্রিন্টার</div>
            <div className="font-medium truncate">{diagnostics?.configuredPrinter || configuredPrinter?.selectedPrinterName || 'নির্বাচিত নয়'}</div>
          </div>
          <div className="bg-subtle p-3 rounded">
            <div className="text-caption text-text-tertiary">A4 প্রিন্টার</div>
            <div className="font-medium truncate">{diagnostics?.a4Printer || configuredPrinter?.a4PrinterName || 'নির্বাচিত নয়'}</div>
          </div>
          {diagnostics?.lastPrintResult && (
            <div className="col-span-2 md:col-span-4 bg-subtle p-3 rounded border">
              <div className="text-caption">শেষ প্রিন্ট: {diagnostics.lastPrintResult.success ? 'সফল' : 'ব্যর্থ'} — {diagnostics.lastPrintResult.messageBn} — {new Date(diagnostics.lastPrintResult.timestamp).toLocaleString('bn-BD')}</div>
            </div>
          )}
          {diagnostics?.lastPrintError && (
            <div className="col-span-2 md:col-span-4 bg-danger-50 p-3 rounded border border-danger-200 text-danger-700 text-caption">
              শেষ ত্রুটি: {diagnostics.lastPrintError}
            </div>
          )}
          <div className="col-span-2 md:col-span-4 text-caption text-text-tertiary">
            প্ল্যাটফর্ম: {diagnostics?.systemInfo?.platform} • আর্ক: {diagnostics?.systemInfo?.arch} • Electron: {diagnostics?.systemInfo?.electronVersion} • অ্যাপ: {diagnostics?.systemInfo?.appVersion}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scanner */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScanLine size={18} /> বারকোড স্ক্যানার
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {scannerLoading ? (
              <div className="text-body-sm text-text-tertiary">লোড হচ্ছে...</div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <label className="text-body-sm font-medium">স্ক্যানার সক্রিয়</label>
                  <input type="checkbox" checked={scannerEnabled} onChange={e => setScannerEnabled(e.target.checked)} className="w-5 h-5" />
                </div>

                <div>
                  <label className="text-caption block mb-1">সাফিক্স (স্ক্যানার কী পাঠায়)</label>
                  <select value={scannerSuffix} onChange={e => setScannerSuffix(e.target.value as any)} className="w-full h-9 px-3 rounded-sm border border-border bg-surface text-body-sm">
                    <option value="Enter">Enter (সবচেয়ে সাধারণ)</option>
                    <option value="Tab">Tab</option>
                    <option value="None">None (টাইমআউট ভিত্তিক)</option>
                  </select>
                  <p className="text-caption text-text-tertiary mt-1">অধিকাংশ USB HID স্ক্যানার Enter পাঠায়, কিছু Tab</p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-caption block mb-1">ন্যূনতম দৈর্ঘ্য</label>
                    <Input type="number" value={minLength} onChange={e => setMinLength(parseInt(e.target.value) || 3)} className="h-8" />
                  </div>
                  <div>
                    <label className="text-caption block mb-1">চার থ্রেশহোল্ড (ms)</label>
                    <Input type="number" value={charThreshold} onChange={e => setCharThreshold(parseInt(e.target.value) || 50)} className="h-8" />
                  </div>
                  <div>
                    <label className="text-caption block mb-1">টাইমআউট (ms)</label>
                    <Input type="number" value={scanTimeout} onChange={e => setScanTimeout(parseInt(e.target.value) || 150)} className="h-8" />
                  </div>
                </div>

                <div className="bg-subtle p-3 rounded text-caption space-y-1">
                  <p className="font-medium">ডিটেকশন আচরণ:</p>
                  <p>• স্ক্যানার: দ্রুত টাইপিং &lt;{charThreshold}ms প্রতি অক্ষর, মোট &lt;500ms, দৈর্ঘ্য ≥6 → স্ক্যানার হিসাবে গণ্য</p>
                  <p>• মানুষ: ধীর টাইপিং &gt;{charThreshold}ms → সাধারণ টাইপিং, বারকোড ফিল্ডে Enter দিয়ে ম্যানুয়াল এন্ট্রি</p>
                  <p>• স্টেল বাফার {scanTimeout}ms পরিষ্কার, অপ্রাসঙ্গিক ফিল্ডে লিক প্রতিরোধ</p>
                </div>

                <Button onClick={handleSaveScanner} loading={saveScannerMut.isPending} className="w-full">
                  <Settings size={14} className="mr-1" /> স্ক্যানার সংরক্ষণ
                </Button>

                <div className="border-t pt-3">
                  <label className="text-caption font-medium block mb-2">স্ক্যানার টেস্ট — এখানে স্ক্যান করুন</label>
                  <div className={`p-3 rounded border-2 ${scanner.isScanning ? 'border-primary-500 bg-primary-50' : 'border-border bg-surface'}`}>
                    <div className="flex items-center gap-2">
                      <ScanLine size={16} className={scanner.isScanning ? 'text-primary-500 animate-pulse' : 'text-text-tertiary'} />
                      <span className="text-body-sm">{scanner.isScanning ? 'স্ক্যান হচ্ছে...' : 'স্ক্যানার প্রস্তুত'}</span>
                      {scanner.isScanning && <Badge variant="primary">বাফার: {String((scanner as any).buffer || '')}</Badge>}
                    </div>
                    <Input
                      value={testBarcode}
                      onChange={e => setTestBarcode(e.target.value)}
                      placeholder="বারকোড স্ক্যান করুন বা টাইপ করুন..."
                      className="mt-2 font-mono"
                      data-barcode-input
                    />
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="secondary" onClick={handleBarcodeLookup} loading={barcodeTestMut.isPending}>
                        পণ্য খুঁজুন
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setTestBarcode(''); setLastScanned(null); scanner.clear(); }}>
                        পরিষ্কার
                      </Button>
                    </div>
                    {lastScanned && (
                      <div className="mt-2 p-2 bg-surface border rounded text-caption">
                        <div>শেষ স্ক্যান: <span className="font-mono font-bold">{lastScanned.barcode}</span></div>
                        <div>ধরন: {lastScanned.isScanner ? 'স্ক্যানার (দ্রুত)' : 'ম্যানুয়াল'} • সময়: {new Date(lastScanned.timestamp).toLocaleTimeString('bn-BD')}</div>
                      </div>
                    )}
                    {barcodeTestMut.data && (
                      <div className="mt-2 p-2 bg-surface border rounded text-body-sm">
                        {barcodeTestMut.data.found ? (
                          <div>
                            <div className="text-success-600 font-medium">✓ {barcodeTestMut.data.products.length} টি পণ্য পাওয়া গেছে</div>
                            {barcodeTestMut.data.products.map((p: any, i: number) => (
                              <div key={i} className="mt-1 text-caption border-t pt-1">
                                {p.product.name} — {p.product.sku} — স্টক: {p.stockMilli / 1000} — {p.product.isActive ? 'সক্রিয়' : 'নিষ্ক্রিয়'} — {p.product.isSellable ? 'বিক্রয়যোগ্য' : 'বিক্রয়যোগ্য নয়'}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-danger-600">{barcodeTestMut.data.messageBn || 'পণ্য পাওয়া যায়নি'}</div>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-caption text-text-tertiary mt-2">
                    USB HID, Bluetooth HID, Wireless HID — কীবোর্ড হিসাবে কাজ করে, কোনো ড্রাইভার বা SDK প্রয়োজন নেই, অফলাইন
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Printer */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Printer size={18} /> রসিদ প্রিন্টার
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {configLoading ? (
              <div className="text-body-sm text-text-tertiary">লোড হচ্ছে...</div>
            ) : (
              <>
                <div>
                  <label className="text-caption block mb-1">উপলব্ধ প্রিন্টার ({printers.length} টি)</label>
                  {printersLoading ? (
                    <div className="text-caption">প্রিন্টার খুঁজছে...</div>
                  ) : printers.length === 0 ? (
                    <div className="p-3 bg-warning-50 border border-warning-200 rounded text-body-sm text-warning-700">
                      <div className="flex items-start gap-2">
                        <AlertTriangle size={14} className="mt-0.5" />
                        <div>
                          <p>কোনো প্রিন্টার পাওয়া যায়নি</p>
                          <p className="text-caption mt-1">Windows Settings → Printers এ প্রিন্টার যোগ করুন, তারপর রিফ্রেশ করুন। প্রিন্টার ছাড়াও বিক্রয় কাজ করবে, প্রিন্ট ব্যর্থ হলেও বিক্রয় রেকর্ড থাকবে।</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <select
                      value={selectedPrinterId}
                      onChange={e => {
                        const id = e.target.value;
                        setSelectedPrinterId(id);
                        const found = printers.find((p: any) => p.id === id || p.name === id);
                        setSelectedPrinterName(found?.name || id);
                      }}
                      className="w-full h-9 px-3 rounded-sm border border-border bg-surface text-body-sm"
                    >
                      <option value="">প্রিন্টার নির্বাচন করুন</option>
                      {printers.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.displayName || p.name} {p.isDefault ? '(ডিফল্ট)' : ''} — {p.status}
                        </option>
                      ))}
                    </select>
                  )}
                  <p className="text-caption text-text-tertiary mt-1">Windows spooler প্রিন্টার — USB, Network, Bluetooth (Windows এ ইনস্টল করা)</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-caption block mb-1">কাগজের প্রস্থ</label>
                    <select value={paperWidth} onChange={e => setPaperWidth(e.target.value as any)} className="w-full h-9 px-3 rounded-sm border border-border bg-surface text-body-sm">
                      <option value="80mm">80mm (সাধারণ)</option>
                      <option value="58mm">58mm (ছোট)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-caption block mb-1">কপি</label>
                    <Input type="number" min={1} max={10} value={copies} onChange={e => setCopies(parseInt(e.target.value) || 1)} className="h-8" />
                  </div>
                </div>

                <div>
                  <label className="text-caption block mb-1">A4 প্রিন্টার (ইনভয়েস)</label>
                  <select
                    value={a4PrinterId}
                    onChange={e => {
                      const id = e.target.value;
                      setA4PrinterId(id);
                      const found = printers.find((p: any) => p.id === id || p.name === id);
                      setA4PrinterName(found?.name || id);
                    }}
                    className="w-full h-9 px-3 rounded-sm border border-border bg-surface text-body-sm"
                  >
                    <option value="">A4 প্রিন্টার নির্বাচন করুন (ঐচ্ছিক)</option>
                    {printers.map((p: any) => (
                      <option key={p.id + '_a4'} value={p.id}>
                        {p.displayName || p.name} {p.isDefault ? '(ডিফল্ট)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-body-sm">বিক্রয়ের পর স্বয়ংক্রিয় প্রিন্ট</label>
                  <input type="checkbox" checked={autoPrint} onChange={e => setAutoPrint(e.target.checked)} className="w-5 h-5" />
                </div>

                <div>
                  <label className="text-caption block mb-1">রসিদ ফুটার</label>
                  <Input value={footer} onChange={e => setFooter(e.target.value)} placeholder="ধন্যবাদ, আবার আসবেন" className="h-8" />
                </div>

                <Button onClick={handleSavePrinter} loading={savePrinterMut.isPending} className="w-full">
                  <Settings size={14} className="mr-1" /> প্রিন্টার সংরক্ষণ
                </Button>

                <div className="border-t pt-3 space-y-2">
                  <label className="text-caption font-medium block">টেস্ট প্রিন্ট</label>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!selectedPrinterId && printers.length === 0}
                      onClick={() => handleTestPrinter(selectedPrinterId || printers[0]?.id || printers[0]?.name)}
                      loading={testPrinterMut.isPending}
                    >
                      <Printer size={14} className="mr-1" /> টেস্ট প্রিন্ট (80mm)
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => refetchPrinters()}>
                      প্রিন্টার রিফ্রেশ
                    </Button>
                  </div>
                  <p className="text-caption text-text-tertiary">
                    টেস্ট পেজে বাংলা (চাল, ডাল), ইংরেজি, সংখ্যা, দীর্ঘ নাম পরীক্ষা করা হবে। থার্মাল প্রিন্টার বাংলা HTML রেন্ডারিং ব্যবহার করে (Chromium), ESC/POS raw text নয় — ফলে বাংলা সঠিক দেখাবে।
                  </p>
                  {testPrinterMut.data && (
                    <div className={`p-2 rounded text-caption border ${testPrinterMut.data.success ? 'bg-success-50 border-success-200 text-success-700' : 'bg-danger-50 border-danger-200 text-danger-700'}`}>
                      {testPrinterMut.data.messageBn} {testPrinterMut.data.printerName ? `— ${testPrinterMut.data.printerName}` : ''}
                    </div>
                  )}
                </div>

                <div className="bg-subtle p-3 rounded text-caption space-y-1">
                  <p className="font-medium flex items-center gap-1"><Info size={12} /> প্রিন্ট ব্যর্থতা নিরাপত্তা:</p>
                  <p>• প্রিন্ট ব্যর্থ হলেও বিক্রয়, স্টক, পেমেন্ট, গ্রাহক বকেয়া অপরিবর্তিত থাকবে</p>
                  <p>• পুনরায় প্রিন্ট নিরাপদ — নতুন বিক্রয়/পেমেন্ট তৈরি করবে না, শুধু অডিট লগ</p>
                  <p>• দ্রুত ডাবল-ক্লিক প্রিন্ট একই বিক্রয় দুবার প্রিন্ট করতে পারে কিন্তু আর্থিক ডেটা ডুপ্লিকেট হবে না</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* A4 Invoice */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-body">
            <FileText size={16} /> A4 ইনভয়েস • 58mm/80mm রসিদ • বাংলা রেন্ডারিং
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-body-sm">
          <div className="bg-surface border rounded p-3">
            <div className="font-medium flex items-center gap-2"><Receipt size={14} /> 58mm রসিদ</div>
            <div className="text-caption text-text-tertiary mt-1">প্রায় ৩২-৪২ অক্ষর, ফন্ট ১০px, কমপ্যাক্ট, খুচরা দোকানের জন্য। বাংলা পণ্য নাম wrap, পরিমাণ/দাম ডানদিকে, মোট স্পষ্ট।</div>
            <div className="mt-2 p-2 bg-canvas rounded font-mono text-[10px] leading-tight">
              MERQO Shop<br />---<br />INV: SAL-0001<br />চাল ১কেজি × ৳৮৫.০০<br />মোট: ৳৮৫.০০<br />---<br />ধন্যবাদ
            </div>
          </div>
          <div className="bg-surface border rounded p-3">
            <div className="font-medium flex items-center gap-2"><Receipt size={14} /> 80mm রসিদ</div>
            <div className="text-caption text-text-tertiary mt-1">প্রায় ৪২-৫৬ অক্ষর, ফন্ট ১১px, বেশি তথ্য, সুপারশপের জন্য। ব্যবসা নাম, ঠিকানা, গ্রাহক, পেমেন্ট, বাকি/ফেরত, বারকোড।</div>
            <div className="mt-2 p-2 bg-canvas rounded font-mono text-[11px] leading-tight">
              MERQO Super Shop<br />১২৩ মেইন রোড, ঢাকা<br />INV: SAL-0001 • ১৬/০৯/২০২৬<br />গ্রাহক: রহিম (০১৭...)<br />---<br />১. চাল ২কেজি × ৳৮৫ = ৳১৭০<br />২. ডাল ১কেজি × ৳১২০ = ৳১২০<br />মোট: ৳২৯০ • বাকি: ৳০<br />---<br />*SAL-0001* • ধন্যবাদ
            </div>
          </div>
          <div className="bg-surface border rounded p-3">
            <div className="font-medium flex items-center gap-2"><FileText size={14} /> A4 ইনভয়েস</div>
            <div className="text-caption text-text-tertiary mt-1">২১০×২৯৭mm, মার্জিন ১৫mm, Noto Sans Bengali, ব্যবসা লোগো (যদি থাকে), গ্রাহক, আইটেম টেবিল, মোট, পেমেন্ট, বাকি, ফুটার। PDF/Print।</div>
            <div className="mt-2 p-2 bg-canvas rounded text-[10px]">
              <div className="font-bold">MERQO RetailOS — ইনভয়েস SAL-0001</div>
              <div>গ্রাহক: করিম | তারিখ: ১৬/০৯/২০২৬</div>
              <div className="border-t mt-1 pt-1"># পণ্য | পরিমাণ | দাম | মোট</div>
              <div>১ | চাল | ২ কেজি | ৳৮৫ | ৳১৭০</div>
              <div className="font-bold border-t mt-1">মোট: ৳১৭০ | পরিশোধিত: ৳১৭০</div>
            </div>
          </div>
          <div className="col-span-1 md:col-span-3 bg-info-50 border border-info-200 rounded p-3 text-caption">
            <p className="font-medium">বাংলা রেন্ডারিং:</p>
            <p>• Noto Sans Bengali + Inter ফন্ট, Chromium রেন্ডারিং — থার্মাল প্রিন্টার HTML প্রিন্ট পথ ব্যবহার করে, raw ESC/POS টেক্সট নয়, ফলে বাংলা গ্লিফ, যুক্তাক্ষর, দীর্ঘ নাম সঠিক।</p>
            <p>• ভাঙা গ্লিফ, টফু বক্স, ওভারল্যাপ এড়ানো — প্রিন্ট CSS word-wrap, overflow hidden।</p>
            <p>• যদি থার্মাল প্রিন্টার raw text এ বাংলা না দেখায়, HTML ইমেজ রেন্ডারিং পথ ব্যবহার করা হয়েছে (Electron print)।</p>
          </div>
        </CardContent>
      </Card>

      {/* Cash Drawer */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-body flex items-center gap-2">
            <Settings size={16} /> ক্যাশ ড্রয়ার • ESC/POS
          </CardTitle>
        </CardHeader>
        <CardContent className="text-body-sm space-y-2">
          <div className="flex items-start gap-2">
            <Badge variant="warning">V1 — সীমিত</Badge>
            <span>ক্যাশ ড্রয়ার সরাসরি সমর্থন নেই, তবে প্রিন্টার kick সিগন্যাল (ESC/POS 0x1B 0x70) মাধ্যমে ভবিষ্যতে সমর্থন করা যাবে। বর্তমানে নগদ বিক্রয়ে ড্রয়ার স্বয়ংক্রিয় খোলা হয় না।</span>
          </div>
          <div className="text-caption text-text-tertiary">
            • যদি ড্রয়ার প্রিন্টারের সাথে RJ11 দিয়ে সংযুক্ত থাকে, প্রিন্টারের মাধ্যমে kick করা যায় — ভবিষ্যতে PrinterService.kickDrawer() যোগ করা হবে।<br />
            • কোনো অতিরিক্ত নেটিভ ডিপেন্ডেন্সি যোগ করা হয়নি, কারণ Windows spooler প্রিন্টিং বাংলা রেন্ডারিং এর জন্য নির্ভরযোগ্য।
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
