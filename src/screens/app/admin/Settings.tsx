import { Save, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SectionCard } from "@/components/primitives/SectionCard";
import { resetStore } from "@/lib/mockStore";

function Toggle({ label, hint, defaultOn = false }: { label: string; hint?: string; defaultOn?: boolean }) {
  return (
    <label className="flex items-start justify-between gap-4 border-b border-border py-3 last:border-0">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <input type="checkbox" defaultChecked={defaultOn} className="mt-1 h-4 w-8 cursor-pointer appearance-none rounded-full bg-muted transition-colors checked:bg-primary" />
    </label>
  );
}

export default function Settings() {
  return (
    <div>
      <PageHeader title="System Settings" subtitle="Defaults that apply across the company." actions={<Button size="sm"><Save className="mr-2 h-4 w-4" />Save</Button>} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="General">
          <Toggle label="Enable e-Invoice on post" hint="Auto-generate IRN when sales invoice is posted." defaultOn />
          <Toggle label="Enable e-Way Bill prompt" hint="Prompt for EWB when invoice value > ₹50,000." defaultOn />
          <Toggle label="Round-off automatically" defaultOn />
          <Toggle label="Lock posted vouchers" hint="Prevent edits after voucher is posted." />
        </SectionCard>
        <SectionCard title="Notifications">
          <Toggle label="GST filing reminders" defaultOn />
          <Toggle label="Low stock alerts" defaultOn />
          <Toggle label="Overdue payment alerts" defaultOn />
          <Toggle label="Weekly summary email" />
        </SectionCard>
        <SectionCard title="Demo data">
          <p className="mb-3 text-sm text-muted-foreground">
            Restore all sample masters and transactions to their original state. This wipes any records you've added or edited.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm("Reset all demo data? Your changes will be lost.")) {
                resetStore();
                toast.success("Demo data has been reset");
              }
            }}
          >
            <RotateCcw className="mr-2 h-4 w-4" />Reset demo data
          </Button>
        </SectionCard>
      </div>
    </div>
  );
}
