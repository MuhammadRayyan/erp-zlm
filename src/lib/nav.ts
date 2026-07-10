export interface NavItem {
  id: string
  label: string
  icon: string
  group: string
}

export const NAV_GROUPS: { group: string; items: NavItem[] }[] = [
  {
    group: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', group: 'Overview' },
    ],
  },
  {
    group: 'Sales',
    items: [
      { id: 'quotations', label: 'Quotations', icon: 'FileText', group: 'Sales' },
      { id: 'invoices', label: 'Sales Invoices', icon: 'Receipt', group: 'Sales' },
      { id: 'credit-notes', label: 'Credit Notes', icon: 'FileMinus', group: 'Sales' },
      { id: 'delivery-notes', label: 'Delivery Notes', icon: 'Truck', group: 'Sales' },
      { id: 'customers', label: 'Customers', icon: 'Users', group: 'Sales' },
    ],
  },
  {
    group: 'Purchases',
    items: [
      { id: 'bills', label: 'Purchase Bills', icon: 'ShoppingCart', group: 'Purchases' },
      { id: 'suppliers', label: 'Suppliers', icon: 'Building2', group: 'Purchases' },
    ],
  },
  {
    group: 'Banking',
    items: [
      { id: 'payments', label: 'Payments', icon: 'CreditCard', group: 'Banking' },
      { id: 'banking', label: 'Bank Accounts', icon: 'Landmark', group: 'Banking' },
    ],
  },
  {
    group: 'Accounting',
    items: [
      { id: 'accounts', label: 'Chart of Accounts', icon: 'ListTree', group: 'Accounting' },
      { id: 'journal', label: 'Journal Entries', icon: 'BookOpen', group: 'Accounting' },
      { id: 'reports', label: 'Reports', icon: 'BarChart3', group: 'Accounting' },
    ],
  },
  {
    group: 'Inventory',
    items: [
      { id: 'items', label: 'Items', icon: 'Package', group: 'Inventory' },
    ],
  },
  {
    group: 'System',
    items: [
      { id: 'templates', label: 'PDF Templates', icon: 'FileEdit', group: 'System' },
      { id: 'custom-fields', label: 'Custom Fields', icon: 'Settings2', group: 'System' },
      { id: 'settings', label: 'Settings', icon: 'Settings', group: 'System' },
    ],
  },
]

export const MODULE_LABELS: Record<string, string> = Object.fromEntries(
  NAV_GROUPS.flatMap(g => g.items).map(i => [i.id, i.label])
)
