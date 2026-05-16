"use client";
import { useState } from "react";
import { Download, Eye } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SectionCard } from "@/components/primitives/SectionCard";
import { DataTable, type Column } from "@/components/primitives/DataTable";
import { Toolbar } from "@/components/primitives/Toolbar";
import { StatusBadge } from "@/components/primitives/StatusBadge";
import { formatINR } from "@/lib/format";
import { useCollection } from "@/lib/mockStore";
import type { VoucherRow } from "@/lib/mockData";

const columns: Column<VoucherRow>[] = [
  { key: "number", header: "Voucher #", cell: (r) => <Link href={`/vouchers/${r.id}`} className="font-medium text-primary hover:underline">{r.number}</Link> },
  { key: "date", header: "Date", cell: (r) => r.date },
  { key: "type", header: "Type", cell: (r) => <span className="rounded-md bg-muted px-2 py-0.5 text-xs">{r.type}</span> },
  { key: "party", header: "Party / Narration", cell: (r) => r.party },
  { key: "amount", header: "Amount", align: "right", cell: (r) => <span className="font-semibold tabular-nums">{formatINR(r.amount)}</span> },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  {
    key: "actions", header: "", align: "right",
    cell: (r) => <Link href={`/vouchers/${r.id}`} className="inline-flex rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Eye className="h-4 w-4" /></Link>,
  },
];

export default function VoucherList() {
  const sales = useCollection("salesInvoices");
  const purchase = useCollection("purchaseInvoices");
  const receipts = useCollection("receipts");
  const payments = useCollection("payments");
  const journals = useCollection("journals");
  const contras = useCollection("contras");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("All");

  const all: VoucherRow[] = [
    ...sales.map((r) => ({ id: r.id, number: r.number, date: r.date, type: "Sales" as const, party: r.party, amount: r.total, status: r.status === "OVERDUE" ? "POSTED" as const : (r.status as VoucherRow["status"]) })),
    ...purchase.map((r) => ({ id: r.id, number: r.number, date: r.date, type: "Purchase" as const, party: r.party, amount: r.total, status: r.status === "OVERDUE" ? "POSTED" as const : (r.status as VoucherRow["status"]) })),
    ...receipts.map((r) => ({ id: r.id, number: r.number, date: r.date, type: "Receipt" as const, party: r.party, amount: r.amount, status: r.status as VoucherRow["status"] })),
    ...payments.map((r) => ({ id: r.id, number: r.number, date: r.date, type: "Payment" as const, party: r.party, amount: r.amount, status: r.status as VoucherRow["status"] })),
    ...journals.map((r) => ({ id: r.id, number: r.number, date: r.date, type: "Journal" as const, party: r.narration, amount: r.amount, status: r.status as VoucherRow["status"] })),
    ...contras.map((r) => ({ id: r.id, number: r.number, date: r.date, type: "Contra" as const, party: r.narration, amount: r.amount, status: r.status as VoucherRow["status"] })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const filtered = all.filter((r) => {
    if (type !== "All" && r.type !== type) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return r.number.toLowerCase().includes(q) || r.party.toLowerCase().includes(q);
  });

  return (
    <div>
      <PageHeader title="Vouchers" subtitle="All voucher types in one feed." actions={<Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Export</Button>} />
      <SectionCard>
        <Toolbar searchPlaceholder="Search vouchers, parties…" onSearchChange={setQuery}>
          <select value={type} onChange={(e) => setType(e.target.value)} className="h-9 rounded-md border border-border bg-surface px-3 text-sm">
            <option value="All">All types</option><option>Sales</option><option>Purchase</option><option>Receipt</option><option>Payment</option><option>Journal</option><option>Contra</option>
          </select>
        </Toolbar>
        <DataTable columns={columns} rows={filtered} rowKey={(r) => r.id} empty="No vouchers yet." />
      </SectionCard>
    </div>
  );
}
