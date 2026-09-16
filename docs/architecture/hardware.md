# Hardware Architecture — MERQO RetailOS

## 1. Overview

MERQO must work with commodity hardware available in Bangladesh retail market:

- Barcode scanners: USB HID, Bluetooth HID, wireless dongle (2.4G HID)
- Printers: A4 laser/inkjet (Windows spooler), 80mm thermal, 58mm thermal (USB, Bluetooth, Network)
- Cash drawer: kick via printer
- Optional: Customer display, weighing scale (future)

All hardware access via **Hardware Abstraction Layer (HAL)** — UI never talks directly to hardware.

---

## 2. Barcode Hardware

### 2.1 Scanner Types in Market

- **USB HID Keyboard Emulation:** Most common (e.g., Netum, Inateck, generic). Acts as keyboard, types barcode + Enter.
- **USB COM / Serial:** Less common, appears as virtual COM port. Requires serial reading.
- **Bluetooth HID:** Pairs as Bluetooth keyboard, same as USB HID.
- **Wireless 2.4G Dongle HID:** USB dongle + wireless scanner, acts as HID.
- **Bluetooth BLE / SPP:** Rare, needs BLE.

**V1 Support:** USB HID, Bluetooth HID, Wireless HID (all keyboard emulation). COM/Serial as future.

### 2.2 No Paid Barcode APIs

- No external barcode lookup APIs. All lookup local DB.
- Barcode parsing local.

### 2.3 Detection & Routing — Design

#### Problem
HID scanners act as keyboard — how to distinguish from human typing? Need to avoid typing in search box being interpreted as barcode, and barcode being typed into wrong field.

#### Solution: Timing Heuristic + Global Listener

- **Global Listener:** Main process listens? Actually renderer can listen global keydown via `window.addEventListener('keydown')` in POS screen.
- **Heuristic:**
  - Scanner types very fast: inter-key interval < 30ms, total barcode length 8-48 chars, ends with Enter, total time < 300ms.
  - Human typing: interval > 80ms, slower.
  - Implement `BarcodeScannerService` in renderer (or preload) that:
    1. Buffers keydown events when focus is not in text input? Actually always buffer but check timing.
    2. If buffer length >= 6 and ends with Enter and time between first and last key < 500ms and average interval < 50ms → treat as scanner.
    3. Prevent default, emit `barcode:scanned` event, clear buffer.
    4. Otherwise, treat as normal typing.

- **Focus Safety:**
  - When barcode detected, route to POS cart regardless of current focus (except when in modal that explicitly handles barcode?).
  - If user is typing in product search, scanner still works — search field will receive barcode but we also handle via global listener.
  - Option: If focus is in input and barcode detected, still process as scan (add to cart) and clear input.

- **Configuration:**
  - Settings → Hardware → Barcode Scanner:
    - Enable/disable global listener
    - Min length (default 6)
    - Suffix (Enter, Tab, None) — most scanners configurable to add Enter.
    - Timeout (ms)
    - Test area: scan here to see detected code and timing.

- **Implementation (Renderer):**
  ```ts
  class BarcodeScannerService {
    buffer = ''
    lastTime = 0
    timeoutId = null
    onScan: (code: string) => void

    handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Enter') {
        if (this.buffer.length >= minLength && this.isFast()) {
          e.preventDefault()
          this.onScan(this.buffer)
          this.reset()
          return
        }
      }
      // ... timing logic
    }
  }
  ```

- **Alternative: node-hid / node-usb:** For advanced, main process could use `node-hid` to read HID raw, but requires drivers. V1 uses keyboard heuristic for simplicity and compatibility.

- **Bluetooth HID:** Same as USB HID — OS pairs as keyboard, heuristic works.

- **Wireless Dongle:** Same.

#### Routing

- POS screen subscribes to `barcode:scanned` via `window.merqo.onBarcodeScanned(callback)`.
- On scan, lookup product:
  - First check `product_barcodes` table exact match
  - Then `products.barcode`
  - Then `product_variants.barcode`
  - If multiple products share barcode (should be unique but handle), show disambiguation.
- If found, add to cart (or increment qty if already in cart).
- If not found, show toast "বারকোড পাওয়া যায়নি: X" + option to create product with that barcode.
- Play beep sound (configurable) on success/failure.

#### Edge Cases

- Scanner configured without Enter suffix → need timeout: if buffer not typed for 100ms after last char and length >= min, treat as scan.
- Human pasting barcode (Ctrl+V) → not treated as scanner (interval large or paste event).
- Scanner while modal open → queue or ignore? If payment modal open, ignore scanning.

---

## 3. Printing Architecture

### 3.1 Printer Types

- **A4 Printers:** Laser, inkjet, connected via USB, network, Windows installed. Used for invoices, reports, statements.
- **80mm Thermal:** Most common receipt printer (Epson, Xprinter, Bixolon, generic). ESC/POS.
- **58mm Thermal:** Smaller receipt, same ESC/POS but narrower.
- **Connection Types:**
  - Windows-installed (spooler) — appears in Windows printers list.
  - USB direct (ESC/POS via USB)
  - Bluetooth (paired, appears as COM or printer)
  - Network (IP, port 9100)

### 3.2 Printer Abstraction Strategy

#### Interface

```ts
interface IPrinter {
  id: string
  name: string
  type: 'a4' | '80mm' | '58mm' | 'pdf'
  connection: 'windows_spooler' | 'usb' | 'bluetooth' | 'network' | 'pdf'
  isDefault: boolean
  isActive: boolean
  getStatus(): Promise<PrinterStatus> // online, offline, paper_out, error
  print(job: PrintJob): Promise<PrintResult>
  test(): Promise<PrintResult>
}

interface PrintJob {
  template: 'invoice_a4' | 'receipt_80mm' | 'receipt_58mm' | 'report' | 'barcode_label'
  data: any // sale, report, etc.
  options?: { copies?: number, paperSize?: string, margins?: Margins }
}

interface PrintResult {
  success: boolean
  message?: string
  jobId?: string
}
```

#### Implementations

1. **WindowsSpoolerPrinter:**
   - Uses Electron `webContents.print()` or `webContents.printToPDF()` then send to printer via `printer` module? Actually Electron's `webContents.print({ silent: false, deviceName })` can print HTML to Windows printer.
   - For A4: Render React component to HTML (via hidden window), then `print()` with deviceName.
   - For thermal if printer installed as Windows printer: same, but HTML styled for 80mm width.
   - Pros: Works with any Windows-installed printer, no ESC/POS needed.
   - Cons: Thermal printing via spooler may be slower, formatting limited.

2. **EscPosPrinter:**
   - Uses `node-thermal-printer` library (supports Epson, Star, etc.) or direct ESC/POS commands.
   - For USB: `node-thermal-printer` with `interface: 'printer:PrinterName'` or `usb` via `escpos-usb`.
   - For Network: `tcp://192.168.1.100:9100`
   - For Bluetooth: `\\.\COMx` or via `node-bluetooth`?
   - Converts receipt data to ESC/POS commands: text, barcode, QR, cut, kick drawer.
   - Need to handle Bengali: ESC/POS printers often don't support Bengali natively. Solution:
     - Option A: Render receipt as image (canvas) with Bengali font, then print image via ESC/POS `printImage`.
     - Option B: Use printer's Unicode support if available (some support).
     - Decision: For thermal, render receipt to image (using hidden BrowserWindow with canvas) then print image for perfect Bengali rendering. Slower but accurate.
     - For A4, HTML printing handles Bengali via browser.

3. **PdfPrinter:**
   - Uses `pdf-lib` or Electron `printToPDF` to generate PDF file.
   - Save to user-chosen location.
   - Preview via PDF viewer.

#### Factory

- `PrinterService` holds list of printer profiles from `printers` table + discovered Windows printers (via `webContents.getPrintersAsync()`).
- On print request, selects printer based on type and default, or user selection.
- Falls back: if thermal printer fails, try Windows spooler version.

### 3.3 Print Templates

- **Templates:** React components for each paper size, stored in `src/renderer/templates/`:
  - `InvoiceA4.tsx` — professional invoice with business info, customer, items table, totals, footer, terms.
  - `Receipt80mm.tsx` — compact receipt: business name, address, sale number, date, items (name, qty, price), subtotal, discount, total, payment method, due, footer, barcode of sale number.
  - `Receipt58mm.tsx` — even more compact, fewer columns.
  - `ReportTemplate.tsx` — generic report.
  - `BarcodeLabel.tsx` — product barcode labels.

- **Design Tokens for Print:**
  - Use same color tokens but print in black/white for thermal.
  - Font: For A4, use Noto Sans Bengali + Inter. For thermal image, use same.

- **Template Data:** Passed as props, no direct DB access.

- **Preview:** Before printing, show preview modal with HTML rendered, options for paper size, margins, scaling.

- **Printer Test:** Button in settings to print test page with Bengali text, barcode, QR, to verify.

### 3.4 Paper Size, Margins, Scaling

- **A4:** 210x297mm, margins 10mm default, configurable.
- **80mm:** 80mm width, variable height, margins 2mm.
- **58mm:** 58mm width.
- **Scaling:** For thermal, scale to fit width. For A4, fit to page.
- **Settings:** Per printer profile, store `paper_width_mm`, `margins`, `font_size`, `show_logo`, `show_barcode`, etc. in `settings_json`.

### 3.5 Bengali Text Rendering

- **Challenge:** Thermal printers often lack Bengali font.
- **Solution:**
  - For Windows spooler printing: browser renders Bengali correctly via HTML/CSS with web fonts (Noto Sans Bengali).
  - For ESC/POS direct: Render receipt as image:
    1. Create hidden BrowserWindow with receipt HTML.
    2. Use `webContents.capturePage()` or canvas to get image.
    3. Convert to bitmap and send via ESC/POS `printImage`.
  - Test with various printers in QA.
  - Alternative: Use `escpos` with image printing.

- **Font Strategy:** Embed Noto Sans Bengali in app, use for both UI and print.

### 3.6 Cash Drawer Kick

- Most cash drawers connected via printer (RJ11). ESC/POS command `0x1B 0x70 0x00 0x19 0xFA` kicks drawer.
- `PrinterService` has `kickDrawer(printerId)` method.
- On cash sale, auto kick if setting enabled.

---

## 4. Hardware Diagnostics

### 4.1 Diagnostics Screen

- Settings → Hardware Diagnostics
- Sections:
  - **Printers:** List discovered Windows printers + configured profiles, status (online/offline), test print button, set default.
  - **Barcode Scanner:** Test area — scan barcode, shows detected code, timing, whether recognized as scanner, product lookup result.
  - **Cash Drawer:** Select printer, kick drawer button.
  - **System Info:** OS, app version, DB size, logs path, backup path.

### 4.2 Auto-Detection

- On app start, `HardwareService` discovers printers via `getPrintersAsync()`, updates status.
- Barcode scanner detection is passive (no auto-detect, just test area).

---

## 5. Future Hardware

- **Customer Display:** Second monitor or small display via separate BrowserWindow.
- **Weighing Scale:** USB/serial scale integration for grocery (read weight, auto fill qty).
- **Card Reader:** For V1, manual entry; future integrate with local card readers via SDK.

---

## 6. Error Handling

- Printer offline → show Bangla message "প্রিন্টার সংযুক্ত নেই। অনুগ্রহ করে প্রিন্টার চালু করুন এবং কেবল পরীক্ষা করুন।" + retry.
- Barcode not found → toast + beep error sound.
- Drawer kick fails → log but don't block sale.
