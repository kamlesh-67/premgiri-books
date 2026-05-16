import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SectionCard } from "@/components/primitives/SectionCard";
import { DataTable, type Column } from "@/components/primitives/DataTable";
import { stockLedger } from "@/lib/mockData";

const cols: Column<typeof stockLedger[number]>[] = [
  { key: "date", header: "Date", cell: (r) => r.date },
  { key: "voucher", header: "Voucher", cell: (r) => <span className="font-medium">{r.voucher}</span> },
  { key: "type", header: "Type", cell: (r) => <span className="rounded-md bg-muted px-2 py-0.5 text-xs">{r.type}</span> },
  { key: "inward", header: "Inward", align: "right", cell: (r) => r.inward || "—" },
  { key: "outward", header: "Outward", align: "right", cell: (r) => r.outward || "—" },
  { key: "balance", header: "Balance", align: "right", cell: (r) => <span className="font-semibold">{r.balance}</span> },
];

export default function StockLedger() {
  return (
    <div>
      <PageHeader title="Stock Ledger" subtitle="Item-wise inward / outward history."
        actions={<Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Export</Button>} />
      <SectionCard title="Item: Asian Apex Ultima White 20L">
        <DataTable columns={cols} rows={stockLedger} rowKey={(r) => r.voucher} />
      </SectionCard>
    </div>
  );
}
