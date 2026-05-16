import { z } from "zod";

export const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}Z[0-9A-Z]{1}$/;

export const partySchema = z.object({
  code: z.string().trim().min(2, "Code is required").max(20),
  name: z.string().trim().min(2, "Name is required").max(100),
  type: z.enum(["Customer", "Supplier"]),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(gstinRegex, "Enter a valid 15-character GSTIN"),
  state: z.string().trim().min(2, "State is required").max(60),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  outstanding: z.coerce.number().default(0),
});
export type PartyInput = z.infer<typeof partySchema>;

export const ledgerSchema = z.object({
  code: z.string().trim().min(1, "Code is required").max(10),
  name: z.string().trim().min(2, "Name is required").max(80),
  group: z.string().trim().min(2, "Group is required").max(60),
  opening: z.coerce.number().default(0),
  debit: z.coerce.number().default(0),
  credit: z.coerce.number().default(0),
  closing: z.coerce.number().default(0),
});
export type LedgerInput = z.infer<typeof ledgerSchema>;

export const stockItemSchema = z.object({
  code: z.string().trim().min(2, "Code is required").max(30),
  name: z.string().trim().min(2, "Name is required").max(120),
  category: z.string().trim().min(2, "Category is required"),
  uom: z.string().trim().min(1, "UoM is required"),
  hsn: z
    .string()
    .trim()
    .regex(/^\d{4,8}$/u, "HSN must be 4–8 digits"),
  gst: z.coerce.number().min(0).max(28),
  stock: z.coerce.number().min(0),
  rate: z.coerce.number().min(0),
  value: z.coerce.number().min(0).default(0),
});
export type StockItemInput = z.infer<typeof stockItemSchema>;

export const employeeSchema = z.object({
  code: z.string().trim().min(2, "Code is required").max(20),
  name: z.string().trim().min(2, "Name is required").max(80),
  designation: z.string().trim().min(2, "Designation is required"),
  department: z.string().trim().min(2, "Department is required"),
  doj: z.string().trim().min(8, "Date of joining is required"),
  ctc: z.coerce.number().min(0, "CTC must be ≥ 0"),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});
export type EmployeeInput = z.infer<typeof employeeSchema>;

export const uomSchema = z.object({
  code: z.string().trim().min(1, "Code is required").max(10),
  name: z.string().trim().min(2, "Name is required").max(40),
  baseUom: z.string().trim().max(40).default("—"),
  factor: z.coerce.number().positive("Factor must be > 0"),
});
export type UomInput = z.infer<typeof uomSchema>;

export const godownSchema = z.object({
  code: z.string().trim().min(2, "Code is required"),
  name: z.string().trim().min(2, "Name is required"),
  address: z.string().trim().min(2, "Address is required"),
  items: z.coerce.number().min(0).default(0),
  value: z.coerce.number().min(0).default(0),
});
export type GodownInput = z.infer<typeof godownSchema>;

export const categorySchema = z.object({
  code: z.string().trim().min(2, "Code is required"),
  name: z.string().trim().min(2, "Name is required"),
  parent: z.string().trim().min(2, "Parent group is required"),
  items: z.coerce.number().min(0).default(0),
});
export type CategoryInput = z.infer<typeof categorySchema>;

// ─── Transactions ───

export const invoiceLineSchema = z.object({
  id: z.number(),
  item: z.string().trim().min(1, "Item required"),
  hsn: z.string().trim().min(1, "HSN required"),
  qty: z.coerce.number().positive("Qty > 0"),
  rate: z.coerce.number().min(0, "Rate ≥ 0"),
  gstPct: z.coerce.number().min(0).max(28),
});

export const invoiceSchema = z.object({
  number: z.string().trim().min(3),
  date: z.string().min(8, "Date is required"),
  party: z.string().trim().min(2, "Party is required"),
  placeOfSupply: z.string().trim().optional(),
  reference: z.string().trim().optional(),
  dueDate: z.string().optional(),
  paymentTerms: z.string().optional(),
  mode: z.string().optional(),
  narration: z.string().optional(),
  lines: z.array(invoiceLineSchema).min(1, "Add at least one line item"),
});
export type InvoiceInput = z.infer<typeof invoiceSchema>;

export const moneyMoveSchema = z.object({
  date: z.string().min(8, "Date is required"),
  party: z.string().trim().min(2, "Party is required"),
  mode: z.enum(["Cash", "Bank", "UPI", "Cheque", "NEFT"]),
  amount: z.coerce.number().positive("Amount must be > 0"),
  reference: z.string().trim().max(40).optional().or(z.literal("")),
});
export type MoneyMoveInput = z.infer<typeof moneyMoveSchema>;

export const journalLineSchema = z.object({
  id: z.number(),
  account: z.string().trim().min(2, "Account required"),
  debit: z.coerce.number().min(0),
  credit: z.coerce.number().min(0),
});

export const journalSchema = z
  .object({
    date: z.string().min(8, "Date is required"),
    narration: z.string().trim().min(3, "Narration is required"),
    lines: z.array(journalLineSchema).min(2, "At least two lines required"),
  })
  .refine(
    (v) => {
      const d = v.lines.reduce((a, l) => a + Number(l.debit || 0), 0);
      const c = v.lines.reduce((a, l) => a + Number(l.credit || 0), 0);
      return Math.abs(d - c) < 0.01 && d > 0;
    },
    { message: "Debits must equal credits and be greater than zero", path: ["lines"] },
  );
export type JournalInput = z.infer<typeof journalSchema>;

export const contraSchema = z.object({
  date: z.string().min(8, "Date is required"),
  fromAccount: z.string().trim().min(2, "From account is required"),
  toAccount: z.string().trim().min(2, "To account is required"),
  amount: z.coerce.number().positive("Amount must be > 0"),
  narration: z.string().trim().max(200).optional().or(z.literal("")),
});
export type ContraInput = z.infer<typeof contraSchema>;

// ─── Admin: Users & Roles ───

export const userSchema = z.object({
  id: z.string().trim().min(2, "ID is required").max(20),
  name: z.string().trim().min(2, "Name is required").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(120),
  role: z.string().trim().min(2, "Role is required"),
  status: z.enum(["ACTIVE", "PENDING", "INACTIVE"]).default("ACTIVE"),
  lastLogin: z.string().optional().default("—"),
});
export type UserInput = z.infer<typeof userSchema>;

export const roleSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(40),
  scopes: z.array(z.string().trim().min(1)).min(1, "Select at least one scope"),
  users: z.coerce.number().min(0).default(0),
});
export type RoleInput = z.infer<typeof roleSchema>;
