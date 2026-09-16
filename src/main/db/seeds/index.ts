/**
 * Seed configuration for Phase 2 — roles, permissions, MFS providers, expense categories, units
 */

export const SEED_ROLES = [
  { code: 'owner', name: 'Owner', nameBn: 'মালিক', description: 'Full access', isSystem: true },
  { code: 'manager', name: 'Manager', nameBn: 'ম্যানেজার', description: 'Manage operations', isSystem: true },
  { code: 'cashier', name: 'Cashier', nameBn: 'ক্যাশিয়ার', description: 'POS and sales', isSystem: true },
  { code: 'salesman', name: 'Salesman', nameBn: 'সেলসম্যান', description: 'Sales only', isSystem: true },
  { code: 'accountant', name: 'Accountant', nameBn: 'হিসাবরক্ষক', description: 'Finance and reports', isSystem: true },
];

export const SEED_PERMISSIONS = [
  // Dashboard
  { code: 'dashboard.view', name: 'View Dashboard', nameBn: 'ড্যাশবোর্ড দেখুন', module: 'dashboard' },
  { code: 'dashboard.financial', name: 'View Financial Dashboard', nameBn: 'আর্থিক ড্যাশবোর্ড', module: 'dashboard' },

  // POS
  { code: 'pos.sell', name: 'POS Sell', nameBn: 'POS বিক্রয়', module: 'pos' },
  { code: 'pos.discount', name: 'Apply Discount', nameBn: 'ডিসকাউন্ট প্রয়োগ', module: 'pos' },
  { code: 'pos.hold', name: 'Hold Sale', nameBn: 'বিক্রয় হোল্ড', module: 'pos' },
  { code: 'pos.return', name: 'Sales Return', nameBn: 'বিক্রয় ফেরত', module: 'pos' },

  // Products
  { code: 'products.view', name: 'View Products', nameBn: 'পণ্য দেখুন', module: 'products' },
  { code: 'products.create', name: 'Create Product', nameBn: 'পণ্য তৈরি', module: 'products' },
  { code: 'products.edit', name: 'Edit Product', nameBn: 'পণ্য সম্পাদনা', module: 'products' },
  { code: 'products.delete', name: 'Delete Product', nameBn: 'পণ্য মুছুন', module: 'products' },
  { code: 'products.import', name: 'Import Products', nameBn: 'পণ্য আমদানি', module: 'products' },

  // Categories, Brands, Units
  { code: 'categories.manage', name: 'Manage Categories', nameBn: 'ক্যাটাগরি পরিচালনা', module: 'products' },
  { code: 'brands.manage', name: 'Manage Brands', nameBn: 'ব্র্যান্ড পরিচালনা', module: 'products' },
  { code: 'units.manage', name: 'Manage Units', nameBn: 'ইউনিট পরিচালনা', module: 'products' },

  // Inventory
  { code: 'inventory.view', name: 'View Inventory', nameBn: 'ইনভেন্টরি দেখুন', module: 'inventory' },
  { code: 'inventory.adjust', name: 'Adjust Stock', nameBn: 'স্টক সমন্বয়', module: 'inventory' },
  { code: 'inventory.count', name: 'Stock Count', nameBn: 'স্টক গণনা', module: 'inventory' },
  { code: 'inventory.transfer', name: 'Transfer Stock', nameBn: 'স্টক স্থানান্তর', module: 'inventory' },

  // Purchasing
  { code: 'purchases.view', name: 'View Purchases', nameBn: 'ক্রয় দেখুন', module: 'purchases' },
  { code: 'purchases.create', name: 'Create Purchase', nameBn: 'ক্রয় তৈরি', module: 'purchases' },
  { code: 'purchases.payment', name: 'Purchase Payment', nameBn: 'ক্রয় পেমেন্ট', module: 'purchases' },
  { code: 'suppliers.manage', name: 'Manage Suppliers', nameBn: 'সাপ্লায়ার পরিচালনা', module: 'purchases' },

  // Customers
  { code: 'customers.view', name: 'View Customers', nameBn: 'কাস্টমার দেখুন', module: 'customers' },
  { code: 'customers.manage', name: 'Manage Customers', nameBn: 'কাস্টমার পরিচালনা', module: 'customers' },
  { code: 'customers.payment', name: 'Customer Payment', nameBn: 'কাস্টমার পেমেন্ট', module: 'customers' },

  // Expenses
  { code: 'expenses.view', name: 'View Expenses', nameBn: 'খরচ দেখুন', module: 'expenses' },
  { code: 'expenses.manage', name: 'Manage Expenses', nameBn: 'খরচ পরিচালনা', module: 'expenses' },

  // Finance
  { code: 'finance.cash', name: 'Cash Management', nameBn: 'ক্যাশ ব্যবস্থাপনা', module: 'finance' },
  { code: 'finance.bank', name: 'Bank Management', nameBn: 'ব্যাংক ব্যবস্থাপনা', module: 'finance' },
  { code: 'finance.mfs', name: 'MFS Management', nameBn: 'MFS ব্যবস্থাপনা', module: 'finance' },

  // Reports
  { code: 'reports.view', name: 'View Reports', nameBn: 'রিপোর্ট দেখুন', module: 'reports' },
  { code: 'reports.export', name: 'Export Reports', nameBn: 'রিপোর্ট এক্সপোর্ট', module: 'reports' },
  { code: 'reports.profit', name: 'View Profit Reports', nameBn: 'লাভের রিপোর্ট', module: 'reports' },

  // Settings
  { code: 'settings.view', name: 'View Settings', nameBn: 'সেটিংস দেখুন', module: 'settings' },
  { code: 'settings.manage', name: 'Manage Settings', nameBn: 'সেটিংস পরিচালনা', module: 'settings' },
  { code: 'settings.users', name: 'Manage Users', nameBn: 'ব্যবহারকারী পরিচালনা', module: 'settings' },
  { code: 'settings.backup', name: 'Backup/Restore', nameBn: 'ব্যাকআপ/রিস্টোর', module: 'settings' },

  // Shifts
  { code: 'shifts.view', name: 'View Shifts', nameBn: 'শিফট দেখুন', module: 'shifts' },
  { code: 'shifts.manage', name: 'Manage Shifts', nameBn: 'শিফট পরিচালনা', module: 'shifts' },
];

export const ROLE_PERMISSIONS_MAP: Record<string, string[]> = {
  owner: SEED_PERMISSIONS.map(p => p.code), // all
  manager: [
    'dashboard.view',
    'dashboard.financial',
    'pos.sell',
    'pos.discount',
    'pos.hold',
    'pos.return',
    'products.view',
    'products.create',
    'products.edit',
    'categories.manage',
    'brands.manage',
    'units.manage',
    'inventory.view',
    'inventory.adjust',
    'inventory.count',
    'purchases.view',
    'purchases.create',
    'purchases.payment',
    'suppliers.manage',
    'customers.view',
    'customers.manage',
    'customers.payment',
    'expenses.view',
    'expenses.manage',
    'finance.cash',
    'finance.bank',
    'finance.mfs',
    'reports.view',
    'reports.export',
    'reports.profit',
    'settings.view',
    'shifts.view',
    'shifts.manage',
  ],
  cashier: [
    'dashboard.view',
    'pos.sell',
    'pos.hold',
    'pos.return',
    'products.view',
    'inventory.view',
    'customers.view',
    'customers.manage',
    'expenses.view',
    'finance.cash',
    'reports.view',
    'shifts.view',
  ],
  salesman: [
    'dashboard.view',
    'pos.sell',
    'products.view',
    'customers.view',
  ],
  accountant: [
    'dashboard.view',
    'dashboard.financial',
    'purchases.view',
    'suppliers.manage',
    'customers.view',
    'expenses.view',
    'expenses.manage',
    'finance.cash',
    'finance.bank',
    'finance.mfs',
    'reports.view',
    'reports.export',
    'reports.profit',
  ],
};

export const SEED_MFS_PROVIDERS = [
  { code: 'bkash', name: 'bKash', nameBn: 'বিকাশ' },
  { code: 'nagad', name: 'Nagad', nameBn: 'নগদ' },
  { code: 'rocket', name: 'Rocket', nameBn: 'রকেট' },
  { code: 'upay', name: 'Upay', nameBn: 'উপায়' },
  { code: 'mcash', name: 'mCash', nameBn: 'এমক্যাশ' },
  { code: 'surecash', name: 'SureCash', nameBn: 'শিওরক্যাশ' },
];

export const SEED_EXPENSE_CATEGORIES = [
  { name: 'Rent', nameBn: 'ভাড়া', isSystem: true },
  { name: 'Electricity', nameBn: 'বিদ্যুৎ', isSystem: true },
  { name: 'Salary', nameBn: 'বেতন', isSystem: true },
  { name: 'Transport', nameBn: 'পরিবহন', isSystem: true },
  { name: 'Internet', nameBn: 'ইন্টারনেট', isSystem: true },
  { name: 'Maintenance', nameBn: 'রক্ষণাবেক্ষণ', isSystem: true },
  { name: 'Marketing', nameBn: 'মার্কেটিং', isSystem: true },
  { name: 'Office Supplies', nameBn: 'অফিস সরবরাহ', isSystem: true },
  { name: 'Miscellaneous', nameBn: 'বিবিধ', isSystem: true },
];

export const SEED_UNITS = [
  { name: 'Piece', shortName: 'pcs', nameBn: 'পিস', unitGroup: 'piece', isBase: true },
  { name: 'Kilogram', shortName: 'kg', nameBn: 'কেজি', unitGroup: 'weight', isBase: true },
  { name: 'Gram', shortName: 'g', nameBn: 'গ্রাম', unitGroup: 'weight', isBase: false },
  { name: 'Liter', shortName: 'L', nameBn: 'লিটার', unitGroup: 'volume', isBase: true },
  { name: 'Milliliter', shortName: 'ml', nameBn: 'মিলিলিটার', unitGroup: 'volume', isBase: false },
  { name: 'Dozen', shortName: 'doz', nameBn: 'ডজন', unitGroup: 'piece', isBase: false },
  { name: 'Carton', shortName: 'ctn', nameBn: 'কার্টন', unitGroup: 'piece', isBase: false },
  { name: 'Box', shortName: 'box', nameBn: 'বক্স', unitGroup: 'piece', isBase: false },
  { name: 'Packet', shortName: 'pkt', nameBn: 'প্যাকেট', unitGroup: 'piece', isBase: false },
  { name: 'Bag', shortName: 'bag', nameBn: 'ব্যাগ', unitGroup: 'piece', isBase: false },
];
