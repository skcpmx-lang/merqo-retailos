# UI/UX Design System — MERQO RetailOS

## 1. Design Philosophy

MERQO must feel like a **premium commercial enterprise product**, not a cheap template, not Bootstrap, not generic SaaS.

**Inspiration:** Linear, Stripe Dashboard, Notion (clean), but with retail POS density.

**Principles:**
- **Light Mode Only:** No dark mode for V1. Clean white, subtle gray, professional.
- **Density:** Retail POS needs information density — not excessive whitespace, but not cramped. Use 4px grid.
- **Bangla-First:** All UI text natural, polished Bangla — not robotic translation. Example: "পণ্য যোগ করুন" not "পণ্য যুক্ত করুন" (both okay but be consistent and natural).
- **Professional:** No emoji icons, no glassmorphism, no excessive gradients, no excessive rounded cards.
- **Keyboard-First:** Focus states obvious, tab order logical, shortcuts visible.
- **No Placeholder:** Empty states are helpful, not fake.

---

## 2. Color Tokens

### 2.1 Base Palette (Light Only)

- **Background:**
  - `bg-canvas`: #F8F9FB (app background)
  - `bg-surface`: #FFFFFF (cards, modals)
  - `bg-subtle`: #F1F3F5 (hover, secondary)
  - `bg-muted`: #E9ECEF (borders, disabled)

- **Text:**
  - `text-primary`: #111827 (gray-900)
  - `text-secondary`: #4B5563 (gray-600)
  - `text-tertiary`: #6B7280 (gray-500)
  - `text-disabled`: #9CA3AF

- **Border:**
  - `border-default`: #E5E7EB
  - `border-strong`: #D1D5DB
  - `border-focus`: #2563EB (blue-600)

- **Primary (MERQO Brand):**
  - `primary-50`: #EFF6FF
  - `primary-100`: #DBEAFE
  - `primary-500`: #2563EB (main)
  - `primary-600`: #1D4ED8 (hover)
  - `primary-700`: #1E40AF (active)
  - `primary-foreground`: #FFFFFF

- **Semantic:**
  - `success-50`: #ECFDF5, `success-500`: #10B981, `success-600`: #059669
  - `warning-50`: #FFFBEB, `warning-500`: #F59E0B, `warning-600`: #D97706
  - `danger-50`: #FEF2F2, `danger-500`: #EF4444, `danger-600`: #DC2626
  - `info-50`: #EFF6FF, `info-500`: #3B82F6

- **Chart (for dashboard):**
  - `chart-1`: #2563EB
  - `chart-2`: #10B981
  - `chart-3`: #F59E0B
  - `chart-4`: #8B5CF6
  - `chart-5`: #EC4899

### 2.2 Usage Rules

- Primary only for main actions, not for everything.
- No gradient backgrounds except subtle primary-50 to white for empty states (max 5% opacity).
- No glassmorphism.
- Cards have border, not shadow, or subtle shadow `shadow-sm` only.

---

## 3. Typography

### 3.1 Font Strategy — Bangla + English

- **Primary Bangla Font:** `Noto Sans Bengali` (Google) — clean, professional, good for UI and print. Alternative: `Hind Siliguri` — also good. Choose one.
  - Weights: 400 (regular), 500 (medium), 600 (semibold), 700 (bold)
- **English Font:** `Inter` — pairs well with Noto Sans Bengali, excellent for numbers, tables.
- **Monospace (for numbers, SKU, barcode):** `JetBrains Mono` or `Inter` tabular numbers.

- **Implementation:** Bundle fonts in app (woff2), no CDN (offline). Use `@font-face`.

- **Font Stack:**
  ```css
  --font-sans: "Noto Sans Bengali", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-mono: "JetBrains Mono", monospace;
  ```

### 3.2 Type Scale

- **Display:** 32px / 40px, 700 — for onboarding headings
- **H1:** 24px / 32px, 600 — page titles
- **H2:** 20px / 28px, 600 — section titles
- **H3:** 16px / 24px, 600 — card titles
- **Body Large:** 15px / 24px, 400 — main content
- **Body:** 14px / 20px, 400 — default
- **Body Small:** 13px / 18px, 400 — secondary, table cells
- **Caption:** 12px / 16px, 400 — labels, hints
- **Label:** 13px / 18px, 500 — form labels
- **Button:** 14px / 20px, 500 — buttons

All sizes in px but responsive via rem base 16px.

### 3.3 Bangla Text Rules

- Line height slightly larger for Bangla (1.6 vs 1.5 for English).
- No machine-translated Bangla. Use professional, natural phrasing. Example:
  - Good: "বিক্রয় সম্পন্ন হয়েছে"
  - Bad: "বিক্রয় সফলভাবে সম্পন্ন করা হয়েছে" (too robotic)
  - Good: "পণ্য খুঁজুন" not "পণ্য অনুসন্ধান করুন" (simpler)
- Numbers: Use English digits (0-9) even in Bangla UI (common in BD retail), but option for Bengali digits future.

---

## 4. Spacing & Sizing

### 4.1 Spacing Scale (4px base)

- `0`: 0
- `1`: 4px
- `2`: 8px
- `3`: 12px
- `4`: 16px
- `5`: 20px
- `6`: 24px
- `8`: 32px
- `10`: 40px
- `12`: 48px
- `16`: 64px

Use Tailwind default but enforce via lint: no arbitrary values like `p-[13px]`.

### 4.2 Sizing

- **Icon:** 16px (small), 20px (default), 24px (large)
- **Button Height:** 32px (sm), 36px (default), 40px (lg)
- **Input Height:** 36px
- **Table Row Height:** 44px (comfortable but dense)
- **Sidebar Width:** 240px (collapsed 64px)

### 4.3 Border Radius

- **Small:** 6px — inputs, buttons, badges
- **Medium:** 8px — cards, modals
- **Large:** 12px — large cards, onboarding
- **Full:** 9999px — pills, avatars
- **No excessive rounded:** Avoid 16px+ for cards.

### 4.4 Shadows

- `shadow-xs`: 0 1px 2px rgba(0,0,0,0.05) — subtle
- `shadow-sm`: 0 1px 3px rgba(0,0,0,0.08) — cards
- `shadow-md`: 0 4px 6px rgba(0,0,0,0.08) — dropdowns, modals
- `shadow-lg`: 0 10px 15px rgba(0,0,0,0.1) — popovers
- No colored shadows.

---

## 5. Components

### 5.1 Buttons

- **Variants:**
  - Primary: bg primary-500, text white, hover primary-600
  - Secondary: bg white, border border-default, text primary, hover bg-subtle
  - Ghost: transparent, text secondary, hover bg-subtle
  - Danger: bg danger-500, text white
  - Link: text primary, underline on hover
- **Sizes:** sm (32px), default (36px), lg (40px)
- **States:** default, hover, active, focus (ring 2px primary-100), disabled (opacity 50%), loading (spinner)
- **No gradients, no glass.**

### 5.2 Inputs

- **Text Input:** height 36px, border border-default, radius 6px, padding 12px, focus ring primary, placeholder text-tertiary
- **Search Input:** with icon left, clear button right
- **Number Input:** with stepper? For POS qty, use custom stepper with +/-
- **Textarea:** min height 80px
- **Error:** border danger-500, message below in danger-500, icon
- **Disabled:** bg muted, text disabled

### 5.3 Selects

- Use Radix Select primitive, styled with Tailwind.
- Dropdown max height 300px, searchable.
- No native select.

### 5.4 Tables

- **Header:** bg subtle, text tertiary, uppercase? No, normal case, 13px medium.
- **Rows:** 44px height, border bottom border-default, hover bg subtle
- **Striped:** No, not needed.
- **Empty:** Show empty state illustration + CTA, not blank.
- **Pagination:** Bottom, showing total, per page selector, prev/next.
- **Sorting:** Click header to sort, icon indicator.
- **Density:** Comfortable but dense — avoid excessive padding.

### 5.5 Cards

- **Style:** bg surface, border border-default, radius 8px, shadow-xs, padding 16-20px
- **No excessive rounded, no gradient.**
- **Header:** title H3 + action button

### 5.6 Charts

- Use Recharts, custom tooltip styled with design tokens.
- Colors from chart palette, not random.
- Grid lines subtle (border-default).

### 5.7 Modals

- **Overlay:** bg black 50% opacity, backdrop blur? No blur for performance, just overlay.
- **Content:** bg surface, radius 12px, shadow-lg, max width 560px (sm), 720px (md), 960px (lg), centered.
- **Header:** title + close button
- **Footer:** actions right-aligned
- **Close:** Esc key, overlay click, close button.

### 5.8 Drawers

- Slide from right, width 400-480px, for filters, details.

### 5.9 Tabs

- Underline style, not pills. Active tab border-bottom primary-500, text primary.

### 5.10 Navigation

- **Sidebar:** 240px width, bg surface, border right border-default, logo top, nav items with icons (Lucide), active state bg primary-50 + text primary-600 + left border 3px primary.
- **Topbar:** Height 56px, breadcrumbs, search, notifications bell, user menu, shift status.
- **No hamburger for desktop** — sidebar always visible, collapsible to 64px icons only.

### 5.11 Notifications (Toasts)

- Position bottom-right, stack.
- Variants: success, error, warning, info — with icon, title, message, close.
- Auto-dismiss 4s, error stays longer.
- Bangla messages.

### 5.12 Empty States

- Illustration (simple line art, not emoji), title, description, CTA button.
- Example: No products → illustration + "কোন পণ্য নেই" + "প্রথম পণ্য যোগ করুন" button.

### 5.13 Loading States

- **Skeleton:** For tables, cards — gray shimmer, not spinner everywhere.
- **Spinner:** For buttons, small spinner.
- **Progress:** For import, backup.

### 5.14 Error States

- Illustration + error message in Bangla + retry button + support code.

### 5.15 Success States

- Checkmark + message.

### 5.16 Tooltips

- Radix Tooltip, bg gray-900, text white, radius 6px, padding 6px 8px, 12px text.

---

## 6. Iconography

- **Library:** Lucide React — consistent, clean, MIT.
- **No inconsistent libraries:** Only Lucide, no FontAwesome, no emoji.
- **Size:** 20px default, 16px small.
- **Stroke width:** 1.5-2px.

---

## 7. Responsive Desktop System

### 7.1 Minimum Supported Viewport

- **Minimum:** 1280x720 — must be usable without horizontal scroll.
- **Recommended:** 1366x768, 1920x1080.

### 7.2 Breakpoints (Desktop Only)

- `sm`: 1280px
- `md`: 1366px
- `lg`: 1440px
- `xl`: 1600px
- `2xl`: 1920px
- `3xl`: 2560px
- `4xl`: 3840px

No mobile breakpoints.

### 7.3 Sidebar Behavior

- At 1280-1366: sidebar 240px, collapsible to 64px via toggle, remembers state.
- At 1920+: sidebar 240px always expanded.
- No overlay sidebar — pushes content.

### 7.4 Table Behavior

- Horizontal scroll if needed, but important columns visible.
- Sticky header.
- At small viewport, hide less important columns (e.g., created_at) via responsive, show in detail drawer.

### 7.5 Dashboard Behavior

- Grid: 12 columns.
- At 1280: 2 columns for KPI cards, 1 column for charts.
- At 1920: 4 columns KPI, 2 columns charts.
- At 4K: 4-6 columns, but max width container 1920 centered? Actually allow full width but with max card width.

### 7.6 Modal Behavior

- At 1280: modal max width 90vw, max height 90vh, scroll inside.
- At 1920: fixed max widths.
- No modal overflow outside viewport.

### 7.7 POS Behavior

- POS is special layout:
  - Left: product search + categories + product grid (60%)
  - Right: cart + customer + payment (40%)
  - At 1280: left 55%, right 45%, product grid 3 columns
  - At 1920: left 65%, right 35%, product grid 5 columns
  - At 4K: product grid 6-8 columns, but cart fixed 400px min.

### 7.8 No Overflow Rule

- Nothing important may overflow outside viewport.
- All containers have `overflow-auto` or `overflow-hidden` with scroll.
- Test at 1280x720.

---

## 8. Accessibility

### 8.1 Keyboard Navigation

- All interactive elements focusable via Tab.
- Tab order logical: top to bottom, left to right.
- Focus visible: ring 2px primary-100 + border primary-500.
- Skip to content link? For desktop app, not needed but good.

### 8.2 Focus States

- Buttons, inputs, selects, table rows (if interactive) have focus ring.
- No `outline: none` without replacement.

### 8.3 Readable Contrast

- Text primary on bg surface: contrast ratio >= 4.5:1 (WCAG AA)
- Text secondary >= 4.5:1
- Check via tool.

### 8.4 Text Sizing

- Base 14px, but user can zoom via Ctrl+? Actually Electron supports zoom — allow 90%-120% zoom setting in Settings → Appearance.

### 8.5 Tab Order

- Defined explicitly where needed.

### 8.6 Accessible Labels

- All inputs have associated label (visible or aria-label).
- Icons have aria-label or title.
- Buttons have text, not just icon (or aria-label if icon-only).

### 8.7 Error Identification

- Form errors announced via aria-live, with error message below input, linked via aria-describedby.

---

## 9. Localization — Bangla-First

### 9.1 Architecture

- Use `i18next` + `react-i18next`.
- Translation files: `src/locales/bn/*.json` (default), `src/locales/en/*.json` (future).
- Structure:
  ```json
  {
    "common": { "save": "সংরক্ষণ করুন", "cancel": "বাতিল", ... },
    "product": { "title": "পণ্য", "add": "পণ্য যোগ করুন", ... },
    "pos": { "cart": "কার্ট", "total": "মোট", ... }
  }
  ```
- No hard-coded strings in components — always `t('key')`.
- Lint rule: no literal Bangla/English text in JSX outside `t()`.

### 9.2 Bangla Quality

- Professional, natural, polished — not robotic.
- Use common retail terms used in BD: "বাকি" for due, "জমা" for payment, "ক্রয়" for purchase, "বিক্রয়" for sale.
- Avoid overly formal Sadhu Bangla — use Cholito but professional.
- Review by native speaker.

### 9.3 Future English Support

- Architecture ready: all keys in JSON, language switcher in settings (future), date/number formatting via Intl.

---

## 10. Design System Implementation Steps

1. Create `src/renderer/styles/tokens.css` with CSS variables for colors, spacing, radius, shadows, fonts.
2. Create Tailwind config extending tokens.
3. Create `src/renderer/components/ui/` with Radix + Tailwind primitives: Button, Input, Select, Table, Card, Modal, etc.
4. Create Storybook? For V1, not required but good — maybe use `src/renderer/components/ui/*.stories.tsx` with Vitest.
5. Document usage in `docs/ui/` (future).

---

## 11. Avoid List (Enforced)

- No Bootstrap appearance
- No cheap template appearance
- No excessive rounded cards (max 12px)
- No excessive gradients
- No glassmorphism
- No emoji icons
- No inconsistent icon libraries
- No excessive whitespace (use 4px grid)
- No random padding/margins
- No inconsistent component sizing
- No robotic Bangla
- No machine-translated Bangla
- No meaningless wording
- No excessive animation (max 150ms transitions, ease-out)
