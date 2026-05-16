// Centralized mock data for the PremGiri Books frontend prototype.

export type VoucherStatus = "POSTED" | "DRAFT" | "CANCELLED";

export interface VoucherRow {
  id: string;
  number: string;
  date: string;
  type: "Sales" | "Purchase" | "Receipt" | "Payment" | "Journal" | "Contra";
  party: string;
  amount: number;
  status: VoucherStatus;
}

export const recentVouchers: VoucherRow[] = [
  { id: "1", number: "BPG-INV-2025-0142", date: "2025-04-30", type: "Sales", party: "Sharma Hardware", amount: 48250, status: "POSTED" },
  { id: "2", number: "BPG-RCT-2025-0098", date: "2025-04-30", type: "Receipt", party: "Verma Paints Co.", amount: 125000, status: "POSTED" },
  { id: "3", number: "BPG-PUR-2025-0067", date: "2025-04-29", type: "Purchase", party: "Asian Pigments Ltd", amount: 234500, status: "POSTED" },
  { id: "4", number: "BPG-INV-2025-0141", date: "2025-04-29", type: "Sales", party: "Modern Builders", amount: 89400, status: "POSTED" },
  { id: "5", number: "BPG-PAY-2025-0054", date: "2025-04-28", type: "Payment", party: "Indian Oil Corp", amount: 67800, status: "POSTED" },
  { id: "6", number: "BPG-INV-2025-0140", date: "2025-04-28", type: "Sales", party: "Royal Decorators", amount: 32100, status: "DRAFT" },
  { id: "7", number: "BPG-JRN-2025-0021", date: "2025-04-27", type: "Journal", party: "Depreciation Adj.", amount: 15000, status: "POSTED" },
  { id: "8", number: "BPG-INV-2025-0139", date: "2025-04-27", type: "Sales", party: "Kumar Construction", amount: 156750, status: "POSTED" },
  { id: "9", number: "BPG-CON-2025-0009", date: "2025-04-26", type: "Contra", party: "HDFC → Cash", amount: 50000, status: "POSTED" },
  { id: "10", number: "BPG-INV-2025-0138", date: "2025-04-26", type: "Sales", party: "Sunshine Interiors", amount: 28900, status: "CANCELLED" },
];

export const salesTrend30d: { date: string; sales: number }[] = Array.from({ length: 30 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - (29 - i));
  const base = 35000 + Math.sin(i / 3) * 12000 + (i % 7) * 2500;
  return {
    date: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
    sales: Math.round(base),
  };
});

export const topCustomers = [
  { name: "Sharma Hardware", outstanding: 124500, invoices: 8 },
  { name: "Modern Builders", outstanding: 89400, invoices: 5 },
  { name: "Kumar Construction", outstanding: 67200, invoices: 4 },
  { name: "Royal Decorators", outstanding: 38900, invoices: 6 },
  { name: "Verma Paints Co.", outstanding: 22000, invoices: 3 },
];

export const lowStockItems = [
  { code: "BPG-ITEM-0042", name: "Asian Apex Ultima White 20L", stock: 4, reorder: 10 },
  { code: "BPG-ITEM-0019", name: "Berger Silk 4L Off-White", stock: 2, reorder: 8 },
  { code: "BPG-ITEM-0107", name: "Primer Wall 10L", stock: 6, reorder: 15 },
];

// ───────────────────────── Sales / Purchase invoices ─────────────────────────

export interface InvoiceRow {
  id: string;
  number: string;
  date: string;
  party: string;
  taxable: number;
  gst: number;
  total: number;
  balance: number;
  status: "POSTED" | "DRAFT" | "CANCELLED" | "OVERDUE";
}

export const salesInvoices: InvoiceRow[] = [
  { id: "1", number: "BPG-INV-2025-0142", date: "2025-04-30", party: "Sharma Hardware", taxable: 40890, gst: 7360, total: 48250, balance: 48250, status: "POSTED" },
  { id: "2", number: "BPG-INV-2025-0141", date: "2025-04-29", party: "Modern Builders", taxable: 75763, gst: 13637, total: 89400, balance: 0, status: "POSTED" },
  { id: "3", number: "BPG-INV-2025-0140", date: "2025-04-28", party: "Royal Decorators", taxable: 27203, gst: 4897, total: 32100, balance: 32100, status: "DRAFT" },
  { id: "4", number: "BPG-INV-2025-0139", date: "2025-04-27", party: "Kumar Construction", taxable: 132839, gst: 23911, total: 156750, balance: 56750, status: "POSTED" },
  { id: "5", number: "BPG-INV-2025-0138", date: "2025-04-26", party: "Sunshine Interiors", taxable: 24492, gst: 4408, total: 28900, balance: 28900, status: "CANCELLED" },
  { id: "6", number: "BPG-INV-2025-0137", date: "2025-04-25", party: "Verma Paints Co.", taxable: 105932, gst: 19068, total: 125000, balance: 0, status: "POSTED" },
  { id: "7", number: "BPG-INV-2025-0136", date: "2025-04-24", party: "Sharma Hardware", taxable: 60169, gst: 10831, total: 71000, balance: 71000, status: "OVERDUE" },
  { id: "8", number: "BPG-INV-2025-0135", date: "2025-04-22", party: "Anand Hardware", taxable: 18644, gst: 3356, total: 22000, balance: 0, status: "POSTED" },
];

export const purchaseInvoices: InvoiceRow[] = [
  { id: "1", number: "BPG-PUR-2025-0067", date: "2025-04-29", party: "Asian Pigments Ltd", taxable: 198729, gst: 35771, total: 234500, balance: 234500, status: "POSTED" },
  { id: "2", number: "BPG-PUR-2025-0066", date: "2025-04-26", party: "Berger India", taxable: 89831, gst: 16169, total: 106000, balance: 0, status: "POSTED" },
  { id: "3", number: "BPG-PUR-2025-0065", date: "2025-04-23", party: "Indian Oil Corp", taxable: 57458, gst: 10342, total: 67800, balance: 67800, status: "POSTED" },
  { id: "4", number: "BPG-PUR-2025-0064", date: "2025-04-20", party: "Packaging Co.", taxable: 11865, gst: 2135, total: 14000, balance: 0, status: "POSTED" },
  { id: "5", number: "BPG-PUR-2025-0063", date: "2025-04-18", party: "Asian Pigments Ltd", taxable: 152542, gst: 27458, total: 180000, balance: 60000, status: "DRAFT" },
];

// Receipts / Payments
export interface MoneyMoveRow {
  id: string;
  number: string;
  date: string;
  party: string;
  mode: "Cash" | "Bank" | "UPI" | "Cheque" | "NEFT";
  amount: number;
  status: "POSTED" | "DRAFT";
  reference?: string;
}

export const receipts: MoneyMoveRow[] = [
  { id: "1", number: "BPG-RCT-2025-0098", date: "2025-04-30", party: "Verma Paints Co.", mode: "NEFT", amount: 125000, status: "POSTED", reference: "UTR-9821" },
  { id: "2", number: "BPG-RCT-2025-0097", date: "2025-04-29", party: "Modern Builders", mode: "Cheque", amount: 89400, status: "POSTED", reference: "CHQ-441002" },
  { id: "3", number: "BPG-RCT-2025-0096", date: "2025-04-28", party: "Kumar Construction", mode: "UPI", amount: 100000, status: "POSTED", reference: "UPI-ABX1" },
  { id: "4", number: "BPG-RCT-2025-0095", date: "2025-04-26", party: "Sharma Hardware", mode: "Cash", amount: 22000, status: "DRAFT" },
];

export const payments: MoneyMoveRow[] = [
  { id: "1", number: "BPG-PAY-2025-0054", date: "2025-04-28", party: "Indian Oil Corp", mode: "NEFT", amount: 67800, status: "POSTED", reference: "UTR-7712" },
  { id: "2", number: "BPG-PAY-2025-0053", date: "2025-04-26", party: "Berger India", mode: "Cheque", amount: 106000, status: "POSTED", reference: "CHQ-441001" },
  { id: "3", number: "BPG-PAY-2025-0052", date: "2025-04-22", party: "Salaries", mode: "Bank", amount: 245000, status: "POSTED" },
];

// Journal & Contra
export interface JournalRow {
  id: string;
  number: string;
  date: string;
  narration: string;
  amount: number;
  status: "POSTED" | "DRAFT";
}

export const journals: JournalRow[] = [
  { id: "1", number: "BPG-JRN-2025-0021", date: "2025-04-27", narration: "Depreciation on plant & machinery", amount: 15000, status: "POSTED" },
  { id: "2", number: "BPG-JRN-2025-0020", date: "2025-04-25", narration: "Provision for outstanding wages", amount: 32500, status: "POSTED" },
  { id: "3", number: "BPG-JRN-2025-0019", date: "2025-04-21", narration: "Round-off adjustment", amount: 1200, status: "DRAFT" },
];

export const contras: JournalRow[] = [
  { id: "1", number: "BPG-CON-2025-0009", date: "2025-04-26", narration: "Cash withdrawn from HDFC Bank", amount: 50000, status: "POSTED" },
  { id: "2", number: "BPG-CON-2025-0008", date: "2025-04-22", narration: "Cash deposit to ICICI Bank", amount: 80000, status: "POSTED" },
];

// ───────────────────────── GST ─────────────────────────

export const gstr1B2B = [
  { gstin: "27AAACS1234F1Z5", party: "Sharma Hardware", invoice: "BPG-INV-2025-0142", date: "2025-04-30", taxable: 40890, igst: 0, cgst: 3680, sgst: 3680, total: 48250 },
  { gstin: "27AABCV5678G1Z2", party: "Verma Paints Co.", invoice: "BPG-INV-2025-0137", date: "2025-04-25", taxable: 105932, igst: 19068, cgst: 0, sgst: 0, total: 125000 },
  { gstin: "29AAACK9876H1Z4", party: "Kumar Construction", invoice: "BPG-INV-2025-0139", date: "2025-04-27", taxable: 132839, igst: 23911, cgst: 0, sgst: 0, total: 156750 },
];

export const gstr3bSummary = [
  { label: "3.1(a) Outward taxable supplies", taxable: 1284560, igst: 84210, cgst: 62120, sgst: 62120 },
  { label: "3.1(b) Outward zero-rated supplies", taxable: 0, igst: 0, cgst: 0, sgst: 0 },
  { label: "3.1(c) Other outward supplies (Nil)", taxable: 12500, igst: 0, cgst: 0, sgst: 0 },
  { label: "3.1(d) Inward supplies (reverse charge)", taxable: 22500, igst: 4050, cgst: 0, sgst: 0 },
];

export const itcRecon = [
  { gstin: "27AAACA0001Z1Z5", supplier: "Asian Pigments Ltd", books: 35771, gstr2b: 35771, diff: 0, status: "MATCHED" },
  { gstin: "27AAACB0002Z1Z6", supplier: "Berger India", books: 16169, gstr2b: 16169, diff: 0, status: "MATCHED" },
  { gstin: "27AAACI0003Z1Z7", supplier: "Indian Oil Corp", books: 10342, gstr2b: 9842, diff: 500, status: "MISMATCH" },
  { gstin: "27AAACP0004Z1Z8", supplier: "Packaging Co.", books: 2135, gstr2b: 0, diff: 2135, status: "MISSING IN 2B" },
];

export const eInvoices = [
  { irn: "a1b2c3d4e5f6...9821", invoice: "BPG-INV-2025-0142", date: "2025-04-30", party: "Sharma Hardware", total: 48250, ackNo: "112412345678901", status: "UPLOADED" },
  { irn: "b2c3d4e5f6g7...4452", invoice: "BPG-INV-2025-0141", date: "2025-04-29", party: "Modern Builders", total: 89400, ackNo: "112412345678902", status: "UPLOADED" },
  { irn: "—", invoice: "BPG-INV-2025-0140", date: "2025-04-28", party: "Royal Decorators", total: 32100, ackNo: "—", status: "PENDING" },
  { irn: "—", invoice: "BPG-INV-2025-0138", date: "2025-04-26", party: "Sunshine Interiors", total: 28900, ackNo: "—", status: "ERROR" },
];

export const ewayBills = [
  { ewb: "131234567890", invoice: "BPG-INV-2025-0142", date: "2025-04-30", from: "Mumbai", to: "Pune", distance: 150, valid: "2025-05-02", status: "ACTIVE" },
  { ewb: "131234567889", invoice: "BPG-INV-2025-0141", date: "2025-04-29", from: "Mumbai", to: "Nashik", distance: 165, valid: "2025-05-01", status: "ACTIVE" },
  { ewb: "131234567888", invoice: "BPG-INV-2025-0136", date: "2025-04-24", from: "Mumbai", to: "Surat", distance: 285, valid: "2025-04-27", status: "EXPIRED" },
];

// ───────────────────────── Masters ─────────────────────────

export const ledgers = [
  { code: "1001", name: "Cash in Hand", group: "Current Assets", opening: 125000, debit: 480000, credit: 410000, closing: 195000 },
  { code: "1002", name: "HDFC Bank — 4421", group: "Bank Accounts", opening: 845000, debit: 2150000, credit: 1980000, closing: 1015000 },
  { code: "1100", name: "Sundry Debtors", group: "Current Assets", opening: 480000, debit: 1284560, credit: 1100000, closing: 664560 },
  { code: "2100", name: "Sundry Creditors", group: "Current Liabilities", opening: -320000, debit: 250000, credit: 312000, closing: -382000 },
  { code: "4001", name: "Sales — Paints", group: "Direct Income", opening: 0, debit: 0, credit: 1284560, closing: -1284560 },
  { code: "5001", name: "Purchase — Raw", group: "Direct Expense", opening: 0, debit: 602300, credit: 0, closing: 602300 },
  { code: "6001", name: "Salaries", group: "Indirect Expense", opening: 0, debit: 245000, credit: 0, closing: 245000 },
  { code: "6010", name: "Rent", group: "Indirect Expense", opening: 0, debit: 60000, credit: 0, closing: 60000 },
];

export const stockItems = [
  { code: "BPG-ITEM-0042", name: "Asian Apex Ultima White 20L", category: "Exterior", uom: "Litre", stock: 4, rate: 4250, value: 17000, hsn: "3209", gst: 18 },
  { code: "BPG-ITEM-0019", name: "Berger Silk 4L Off-White", category: "Interior", uom: "Litre", stock: 2, rate: 1180, value: 2360, hsn: "3209", gst: 18 },
  { code: "BPG-ITEM-0107", name: "Primer Wall 10L", category: "Primer", uom: "Litre", stock: 6, rate: 980, value: 5880, hsn: "3208", gst: 18 },
  { code: "BPG-ITEM-0203", name: "Roller Brush 9 inch", category: "Accessories", uom: "Pcs", stock: 84, rate: 145, value: 12180, hsn: "9603", gst: 12 },
  { code: "BPG-ITEM-0301", name: "Putty Wall White 20kg", category: "Putty", uom: "Kg", stock: 145, rate: 380, value: 55100, hsn: "3214", gst: 18 },
  { code: "BPG-ITEM-0410", name: "Thinner General 5L", category: "Solvent", uom: "Litre", stock: 32, rate: 240, value: 7680, hsn: "3814", gst: 18 },
];

export const parties = [
  { code: "C-0001", name: "Sharma Hardware", type: "Customer", gstin: "27AAACS1234F1Z5", state: "Maharashtra", phone: "+91 98200 11122", outstanding: 124500 },
  { code: "C-0002", name: "Modern Builders", type: "Customer", gstin: "27AABCM5566K1Z9", state: "Maharashtra", phone: "+91 98201 22233", outstanding: 89400 },
  { code: "C-0003", name: "Kumar Construction", type: "Customer", gstin: "29AAACK9876H1Z4", state: "Karnataka", phone: "+91 98441 33344", outstanding: 67200 },
  { code: "S-0001", name: "Asian Pigments Ltd", type: "Supplier", gstin: "27AAACA0001Z1Z5", state: "Maharashtra", phone: "+91 22 4422 0001", outstanding: -180000 },
  { code: "S-0002", name: "Berger India", type: "Supplier", gstin: "27AAACB0002Z1Z6", state: "Maharashtra", phone: "+91 22 4422 0002", outstanding: 0 },
];

export const employees = [
  { code: "EMP-001", name: "Rajesh Kumar", designation: "Accountant", department: "Finance", doj: "2021-06-12", ctc: 540000, status: "ACTIVE" },
  { code: "EMP-002", name: "Priya Sharma", designation: "Sales Manager", department: "Sales", doj: "2020-03-04", ctc: 720000, status: "ACTIVE" },
  { code: "EMP-003", name: "Amit Verma", designation: "Warehouse Lead", department: "Operations", doj: "2022-01-18", ctc: 360000, status: "ACTIVE" },
  { code: "EMP-004", name: "Sneha Patil", designation: "Cashier", department: "Finance", doj: "2023-09-01", ctc: 240000, status: "ACTIVE" },
];

export const uoms = [
  { code: "L", name: "Litre", baseUom: "—", factor: 1 },
  { code: "ML", name: "Millilitre", baseUom: "Litre", factor: 0.001 },
  { code: "KG", name: "Kilogram", baseUom: "—", factor: 1 },
  { code: "G", name: "Gram", baseUom: "Kilogram", factor: 0.001 },
  { code: "PCS", name: "Pieces", baseUom: "—", factor: 1 },
  { code: "BOX", name: "Box (12 pcs)", baseUom: "Pieces", factor: 12 },
];

export const godowns = [
  { code: "GOD-MAIN", name: "Main Warehouse — Bhiwandi", address: "Bhiwandi, MH", items: 312, value: 1845000 },
  { code: "GOD-RTL1", name: "Retail Store — Dadar", address: "Dadar West, Mumbai", items: 84, value: 285000 },
  { code: "GOD-RTL2", name: "Retail Store — Pune", address: "Kothrud, Pune", items: 64, value: 198000 },
];

export const categories = [
  { code: "CAT-EXT", name: "Exterior", parent: "Paints", items: 28 },
  { code: "CAT-INT", name: "Interior", parent: "Paints", items: 42 },
  { code: "CAT-PRM", name: "Primer", parent: "Paints", items: 12 },
  { code: "CAT-PUT", name: "Putty", parent: "Allied", items: 8 },
  { code: "CAT-ACC", name: "Accessories", parent: "Allied", items: 36 },
];

// ───────────────────────── Inventory ─────────────────────────

export const stockSummary = stockItems.map((s) => ({
  code: s.code,
  name: s.name,
  category: s.category,
  inward: Math.round(s.stock * 1.6),
  outward: Math.round(s.stock * 1.2),
  closing: s.stock,
  value: s.value,
}));

export const stockLedger = [
  { date: "2025-04-30", voucher: "BPG-INV-2025-0142", type: "Sales", inward: 0, outward: 4, balance: 4 },
  { date: "2025-04-28", voucher: "BPG-PUR-2025-0066", type: "Purchase", inward: 12, outward: 0, balance: 8 },
  { date: "2025-04-25", voucher: "BPG-INV-2025-0137", type: "Sales", inward: 0, outward: 6, balance: -4 },
  { date: "2025-04-22", voucher: "BPG-PUR-2025-0064", type: "Purchase", inward: 24, outward: 0, balance: 2 },
];

export const stockAgeing = [
  { code: "BPG-ITEM-0042", name: "Asian Apex Ultima White 20L", b0_30: 2, b31_60: 1, b61_90: 1, b90: 0, value: 17000 },
  { code: "BPG-ITEM-0019", name: "Berger Silk 4L Off-White", b0_30: 0, b31_60: 1, b61_90: 0, b90: 1, value: 2360 },
  { code: "BPG-ITEM-0301", name: "Putty Wall White 20kg", b0_30: 100, b31_60: 30, b61_90: 10, b90: 5, value: 55100 },
  { code: "BPG-ITEM-0203", name: "Roller Brush 9 inch", b0_30: 40, b31_60: 24, b61_90: 12, b90: 8, value: 12180 },
];

// ───────────────────────── Payroll ─────────────────────────

export const salaryStructures = [
  { code: "SAL-MGR", name: "Manager Grade", basic: 35000, hra: 14000, special: 8000, gross: 57000, pf: 4200, esic: 0, net: 52800 },
  { code: "SAL-EXE", name: "Executive Grade", basic: 22000, hra: 8800, special: 4200, gross: 35000, pf: 2640, esic: 263, net: 32097 },
  { code: "SAL-OPS", name: "Operations Grade", basic: 16000, hra: 6400, special: 2600, gross: 25000, pf: 1920, esic: 188, net: 22892 },
];

export const attendance = [
  { code: "EMP-001", name: "Rajesh Kumar", present: 24, absent: 1, leave: 1, ot: 4 },
  { code: "EMP-002", name: "Priya Sharma", present: 25, absent: 0, leave: 1, ot: 0 },
  { code: "EMP-003", name: "Amit Verma", present: 22, absent: 2, leave: 2, ot: 8 },
  { code: "EMP-004", name: "Sneha Patil", present: 26, absent: 0, leave: 0, ot: 0 },
];

export const payRuns = [
  { id: "PR-2025-04", period: "Apr 2025", employees: 24, gross: 1284000, deductions: 96000, net: 1188000, status: "PROCESSING" },
  { id: "PR-2025-03", period: "Mar 2025", employees: 24, gross: 1276000, deductions: 95400, net: 1180600, status: "POSTED" },
  { id: "PR-2025-02", period: "Feb 2025", employees: 23, gross: 1224000, deductions: 91200, net: 1132800, status: "POSTED" },
];

// ───────────────────────── Banking ─────────────────────────

export const bankRecon = [
  { date: "2025-04-30", description: "NEFT — Verma Paints Co.", reference: "UTR-9821", debit: 0, credit: 125000, status: "MATCHED" },
  { date: "2025-04-29", description: "Cheque — Modern Builders", reference: "CHQ-441002", debit: 0, credit: 89400, status: "MATCHED" },
  { date: "2025-04-28", description: "NEFT — Indian Oil Corp", reference: "UTR-7712", debit: 67800, credit: 0, status: "PENDING" },
  { date: "2025-04-26", description: "Cash deposit", reference: "DEP-9981", debit: 0, credit: 80000, status: "MATCHED" },
];

export const cheques = [
  { number: "441001", date: "2025-04-26", party: "Berger India", amount: 106000, type: "ISSUED", status: "CLEARED" },
  { number: "441002", date: "2025-04-29", party: "Modern Builders", amount: 89400, type: "RECEIVED", status: "CLEARED" },
  { number: "441003", date: "2025-04-30", party: "Indian Oil Corp", amount: 67800, type: "ISSUED", status: "PENDING" },
  { number: "441004", date: "2025-04-30", party: "Sharma Hardware", amount: 22000, type: "RECEIVED", status: "BOUNCED" },
];

// ───────────────────────── Reports ─────────────────────────

export const balanceSheet = {
  assets: [
    { group: "Fixed Assets", items: [
      { name: "Plant & Machinery", value: 1450000 },
      { name: "Furniture & Fixtures", value: 320000 },
      { name: "Vehicles", value: 540000 },
    ]},
    { group: "Current Assets", items: [
      { name: "Sundry Debtors", value: 664560 },
      { name: "Inventory", value: 2328000 },
      { name: "Cash in Hand", value: 195000 },
      { name: "HDFC Bank", value: 1015000 },
    ]},
  ],
  liabilities: [
    { group: "Capital Account", items: [
      { name: "Owner's Capital", value: 4500000 },
      { name: "Reserves & Surplus", value: 845000 },
    ]},
    { group: "Current Liabilities", items: [
      { name: "Sundry Creditors", value: 382000 },
      { name: "GST Payable", value: 84210 },
      { name: "Outstanding Expenses", value: 101350 },
    ]},
    { group: "Loans", items: [
      { name: "Bank Term Loan", value: 600000 },
    ]},
  ],
};

export const profitLoss = {
  income: [
    { name: "Sales — Paints", value: 1284560 },
    { name: "Sales — Allied", value: 384200 },
    { name: "Other Income", value: 24500 },
  ],
  expenses: [
    { name: "Purchase — Raw", value: 602300 },
    { name: "Purchase — Allied", value: 184500 },
    { name: "Salaries", value: 245000 },
    { name: "Rent", value: 60000 },
    { name: "Power & Fuel", value: 32400 },
    { name: "Office & Admin", value: 28900 },
    { name: "Depreciation", value: 15000 },
  ],
};

export const dayBook = [
  { time: "10:14", voucher: "BPG-INV-2025-0142", type: "Sales", party: "Sharma Hardware", debit: 48250, credit: 0 },
  { time: "10:32", voucher: "BPG-RCT-2025-0098", type: "Receipt", party: "Verma Paints Co.", debit: 0, credit: 125000 },
  { time: "11:48", voucher: "BPG-PAY-2025-0054", type: "Payment", party: "Indian Oil Corp", debit: 67800, credit: 0 },
  { time: "14:02", voucher: "BPG-JRN-2025-0021", type: "Journal", party: "Depreciation Adj.", debit: 15000, credit: 15000 },
  { time: "16:21", voucher: "BPG-CON-2025-0009", type: "Contra", party: "HDFC → Cash", debit: 50000, credit: 50000 },
];

export const outstanding = [
  { party: "Sharma Hardware", invoice: "BPG-INV-2025-0142", date: "2025-04-30", days: 1, amount: 48250, bucket: "0-30" },
  { party: "Royal Decorators", invoice: "BPG-INV-2025-0140", date: "2025-04-28", days: 3, amount: 32100, bucket: "0-30" },
  { party: "Kumar Construction", invoice: "BPG-INV-2025-0139", date: "2025-04-27", days: 4, amount: 56750, bucket: "0-30" },
  { party: "Sharma Hardware", invoice: "BPG-INV-2025-0136", date: "2025-04-24", days: 7, amount: 71000, bucket: "0-30" },
  { party: "Modern Builders", invoice: "BPG-INV-2025-0098", date: "2025-02-12", days: 78, amount: 64000, bucket: "61-90" },
  { party: "Anand Hardware", invoice: "BPG-INV-2025-0044", date: "2024-12-10", days: 142, amount: 28000, bucket: "90+" },
];

// ───────────────────────── Admin ─────────────────────────

export const users = [
  { id: "U-001", name: "Admin User", email: "admin@premgiri.com", role: "Owner", lastLogin: "2025-04-30 10:02", status: "ACTIVE" },
  { id: "U-002", name: "Rajesh Kumar", email: "rajesh@premgiri.com", role: "Accountant", lastLogin: "2025-04-30 09:48", status: "ACTIVE" },
  { id: "U-003", name: "Priya Sharma", email: "priya@premgiri.com", role: "Sales Manager", lastLogin: "2025-04-29 18:21", status: "ACTIVE" },
  { id: "U-004", name: "Amit Verma", email: "amit@premgiri.com", role: "Warehouse", lastLogin: "2025-04-22 14:10", status: "PENDING" },
];

export const roles = [
  { name: "Owner", users: 1, scopes: ["All Modules", "Admin", "Audit Log"] },
  { name: "Accountant", users: 2, scopes: ["Transactions", "GST", "Reports"] },
  { name: "Sales Manager", users: 1, scopes: ["Sales Invoice", "Receipts", "Customers"] },
  { name: "Warehouse", users: 3, scopes: ["Stock Items", "Godowns", "Stock Ledger"] },
];

export const numberSeries = [
  { type: "Sales Invoice", prefix: "BPG-INV-", padding: 4, next: 143, sample: "BPG-INV-2025-0143" },
  { type: "Purchase Invoice", prefix: "BPG-PUR-", padding: 4, next: 68, sample: "BPG-PUR-2025-0068" },
  { type: "Receipt", prefix: "BPG-RCT-", padding: 4, next: 99, sample: "BPG-RCT-2025-0099" },
  { type: "Payment", prefix: "BPG-PAY-", padding: 4, next: 55, sample: "BPG-PAY-2025-0055" },
  { type: "Journal", prefix: "BPG-JRN-", padding: 4, next: 22, sample: "BPG-JRN-2025-0022" },
  { type: "Contra", prefix: "BPG-CON-", padding: 4, next: 10, sample: "BPG-CON-2025-0010" },
];

export const auditLog = [
  { time: "2025-04-30 10:14", user: "Rajesh Kumar", action: "CREATE", entity: "Sales Invoice", target: "BPG-INV-2025-0142", ip: "182.74.21.10" },
  { time: "2025-04-30 09:52", user: "Admin User", action: "UPDATE", entity: "User", target: "amit@premgiri.com", ip: "182.74.21.10" },
  { time: "2025-04-29 18:21", user: "Priya Sharma", action: "POST", entity: "Sales Invoice", target: "BPG-INV-2025-0141", ip: "157.32.10.4" },
  { time: "2025-04-29 17:02", user: "Rajesh Kumar", action: "DELETE", entity: "Draft Invoice", target: "BPG-INV-DRAFT-008", ip: "182.74.21.10" },
  { time: "2025-04-28 11:48", user: "Rajesh Kumar", action: "POST", entity: "Payment", target: "BPG-PAY-2025-0054", ip: "182.74.21.10" },
];

export const company = {
  name: "Baba Premgiri Paints Pvt. Ltd.",
  legalName: "Baba Premgiri Paints Private Limited",
  gstin: "27AABCB1234M1Z3",
  pan: "AABCB1234M",
  cin: "U24220MH2018PTC312045",
  email: "accounts@premgiri.com",
  phone: "+91 22 4422 1100",
  address: "Plot 18, MIDC Bhiwandi, Thane, Maharashtra 421302",
  fyStart: "01 Apr 2024",
  fyEnd: "31 Mar 2025",
  baseCurrency: "INR (₹)",
};
