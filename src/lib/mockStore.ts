// Reactive in-memory + localStorage-backed store for the prototype.
// Lets every page mutate / observe shared mock collections.

import { useSyncExternalStore } from "react";
import {
  salesInvoices as seedSales,
  purchaseInvoices as seedPurchase,
  receipts as seedReceipts,
  payments as seedPayments,
  journals as seedJournals,
  contras as seedContras,
  ledgers as seedLedgers,
  parties as seedParties,
  stockItems as seedStockItems,
  employees as seedEmployees,
  uoms as seedUoms,
  godowns as seedGodowns,
  categories as seedCategories,
  users as seedUsers,
  roles as seedRoles,
  type InvoiceRow,
  type MoneyMoveRow,
  type JournalRow,
} from "./mockData";

export type LedgerRow = (typeof seedLedgers)[number];
export type PartyRow = (typeof seedParties)[number];
export type StockItemRow = (typeof seedStockItems)[number];
export type EmployeeRow = (typeof seedEmployees)[number];
export type UomRow = (typeof seedUoms)[number];
export type GodownRow = (typeof seedGodowns)[number];
export type CategoryRow = (typeof seedCategories)[number];
export type UserRow = (typeof seedUsers)[number];
export type RoleRow = (typeof seedRoles)[number];

export interface InvoiceLine {
  id: number;
  item: string;
  hsn: string;
  qty: number;
  rate: number;
  gstPct: number;
}

/** Extended invoice row carrying line items + party meta for detail view. */
export interface InvoiceRowFull extends InvoiceRow {
  lines?: InvoiceLine[];
  placeOfSupply?: string;
  reference?: string;
  dueDate?: string;
  paymentTerms?: string;
  mode?: string;
  narration?: string;
}

export interface JournalRowFull extends JournalRow {
  lines?: { id: number; account: string; debit: number; credit: number }[];
  fromAccount?: string;
  toAccount?: string;
}

export interface CollectionMap {
  salesInvoices: InvoiceRowFull;
  purchaseInvoices: InvoiceRowFull;
  receipts: MoneyMoveRow;
  payments: MoneyMoveRow;
  journals: JournalRowFull;
  contras: JournalRowFull;
  ledgers: LedgerRow;
  parties: PartyRow;
  stockItems: StockItemRow;
  employees: EmployeeRow;
  uoms: UomRow;
  godowns: GodownRow;
  categories: CategoryRow;
  users: UserRow;
  roles: RoleRow;
}

export type CollectionKey = keyof CollectionMap;

const STORAGE_KEY = "premgiri.mockStore.v1";

function seed(): { [K in CollectionKey]: CollectionMap[K][] } {
  return {
    salesInvoices: [...seedSales],
    purchaseInvoices: [...seedPurchase],
    receipts: [...seedReceipts],
    payments: [...seedPayments],
    journals: [...seedJournals],
    contras: [...seedContras],
    ledgers: [...seedLedgers],
    parties: [...seedParties],
    stockItems: [...seedStockItems],
    employees: [...seedEmployees],
    uoms: [...seedUoms],
    godowns: [...seedGodowns],
    categories: [...seedCategories],
    users: [...seedUsers],
    roles: [...seedRoles],
  };
}

let state: { [K in CollectionKey]: CollectionMap[K][] } = (() => {
  if (typeof window === "undefined") return seed();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed();
    const parsed = JSON.parse(raw);
    const base = seed();
    return { ...base, ...parsed };
  } catch {
    return seed();
  }
})();

const listeners = new Set<() => void>();
function notify() {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore quota errors */
    }
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Reactive read of a collection. */
export function useCollection<K extends CollectionKey>(key: K): CollectionMap[K][] {
  return useSyncExternalStore(
    subscribe,
    () => state[key] as CollectionMap[K][],
    () => state[key] as CollectionMap[K][],
  );
}

/** Non-reactive read. */
export function getCollection<K extends CollectionKey>(key: K): CollectionMap[K][] {
  return state[key] as CollectionMap[K][];
}

export function findById<K extends CollectionKey>(key: K, id: string): CollectionMap[K] | undefined {
  return (state[key] as { id?: string; code?: string; name?: string }[]).find(
    (r) => (r.id ?? r.code ?? r.name) === id,
  ) as CollectionMap[K] | undefined;
}

export function add<K extends CollectionKey>(key: K, row: CollectionMap[K]): CollectionMap[K] {
  state = { ...state, [key]: [row, ...(state[key] as CollectionMap[K][])] };
  notify();
  return row;
}

export function update<K extends CollectionKey>(
  key: K,
  id: string,
  patch: Partial<CollectionMap[K]>,
): void {
  const list = state[key] as Array<{ id?: string; code?: string; name?: string }>;
  state = {
    ...state,
    [key]: list.map((r) => ((r.id ?? r.code ?? r.name) === id ? { ...r, ...patch } : r)) as CollectionMap[K][],
  };
  notify();
}

export function remove<K extends CollectionKey>(key: K, id: string): void {
  const list = state[key] as Array<{ id?: string; code?: string; name?: string }>;
  state = { ...state, [key]: list.filter((r) => (r.id ?? r.code ?? r.name) !== id) as CollectionMap[K][] };
  notify();
}

export function resetStore(): void {
  state = seed();
  notify();
}

// ───────── ID / number helpers ─────────
const year = new Date().getFullYear();

function nextNumber(prefix: string, list: { number: string }[]): string {
  const max = list.reduce((m, r) => {
    const match = r.number.match(/(\d+)\s*$/);
    return match ? Math.max(m, parseInt(match[1], 10)) : m;
  }, 0);
  return `${prefix}${year}-${String(max + 1).padStart(4, "0")}`;
}

export function nextSalesInvoiceNumber() {
  return nextNumber("BPG-INV-", state.salesInvoices);
}
export function nextPurchaseInvoiceNumber() {
  return nextNumber("BPG-PUR-", state.purchaseInvoices);
}
export function nextReceiptNumber() {
  return nextNumber("BPG-RCT-", state.receipts);
}
export function nextPaymentNumber() {
  return nextNumber("BPG-PAY-", state.payments);
}
export function nextJournalNumber() {
  return nextNumber("BPG-JRN-", state.journals);
}
export function nextContraNumber() {
  return nextNumber("BPG-CON-", state.contras);
}

export function nextCode(prefix: string, list: { code: string }[]): string {
  const max = list.reduce((m, r) => {
    const match = r.code.match(/(\d+)\s*$/);
    return match ? Math.max(m, parseInt(match[1], 10)) : m;
  }, 0);
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
