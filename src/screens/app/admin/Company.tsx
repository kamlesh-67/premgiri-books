import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SectionCard } from "@/components/primitives/SectionCard";
import { company } from "@/lib/mockData";

function Field({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <label className={full ? "md:col-span-2" : ""}>
      <span className="mb-1.5 block text-xs font-medium text-foreground">{label}</span>
      <input defaultValue={value} className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm" />
    </label>
  );
}

export default function Company() {
  return (
    <div>
      <PageHeader title="Company Profile" subtitle="Master company details printed on every document."
        actions={<Button size="sm"><Save className="mr-2 h-4 w-4" />Save changes</Button>} />
      <SectionCard title="Identity">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Trade name" value={company.name} />
          <Field label="Legal name" value={company.legalName} />
          <Field label="GSTIN" value={company.gstin} />
          <Field label="PAN" value={company.pan} />
          <Field label="CIN" value={company.cin} />
          <Field label="Base currency" value={company.baseCurrency} />
        </div>
      </SectionCard>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Contact">
          <div className="grid grid-cols-1 gap-4">
            <Field label="Email" value={company.email} />
            <Field label="Phone" value={company.phone} />
            <Field label="Address" value={company.address} />
          </div>
        </SectionCard>
        <SectionCard title="Financial year">
          <div className="grid grid-cols-2 gap-4">
            <Field label="FY start" value={company.fyStart} />
            <Field label="FY end" value={company.fyEnd} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Closing FY locks all vouchers for editing. Run year-end before closing.</p>
        </SectionCard>
      </div>
    </div>
  );
}
