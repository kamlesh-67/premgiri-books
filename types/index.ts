import { Decimal } from 'decimal.js'

export type DrCr = 'DR' | 'CR'
export type VoucherType = 'SALES' | 'PURCHASE' | 'RECEIPT' | 'PAYMENT' | 'JOURNAL' | 'CONTRA' | 'CREDIT_NOTE' | 'DEBIT_NOTE'
export type VoucherStatus = 'DRAFT' | 'POSTED' | 'CANCELLED'
export type AccountNature = 'ASSET' | 'LIABILITY' | 'INCOME' | 'EXPENSE'
export type GstRegType = 'REGULAR' | 'COMPOSITION' | 'UNREGISTERED' | 'CONSUMER'
export type SupplyType = 'B2B' | 'B2C' | 'EXPORT' | 'SEZ'
export type GstrStatus = 'PENDING' | 'UPLOADED' | 'FILED'
export type OrderType = 'PURCHASE_ORDER' | 'SALES_ORDER'
export type OrderStatus = 'DRAFT' | 'APPROVED' | 'PARTIALLY_FULFILLED' | 'CLOSED' | 'CANCELLED'
export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'CANCEL' | 'POST'
export type UiMode = 'simple' | 'advanced'

export interface FormattedAmount {
  raw: Decimal
  display: string // e.g. "₹1,23,456.00"
}
