// Shared API types for AccountERP

export type Navigate = (module: string, params?: Record<string, string>) => void

export interface TaxRate {
  id: string
  name: string
  rate: number
  category: string
  isDefault?: boolean
}

export interface Business {
  id: string
  name: string
  legalName: string | null
  trn: string | null
  email: string | null
  phone: string | null
  baseCurrency: string
  vatRegistered: boolean
  vatRate: number
  invoicePrefix: string
  billPrefix: string
  tenantId: string
  [key: string]: unknown
}

export interface PaginatedResponse<T> {
  items: T[]
  nextCursor: string | null
  hasMore: boolean
}
