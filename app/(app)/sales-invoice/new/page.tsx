"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";

import { useUiStore } from "@/lib/stores/uiStore";
import { salesInvoiceSchema, type SalesInvoiceInput } from "@/lib/schemas/vouchers";
import { GuidedWizard, type WizardStep } from "@/components/shared/GuidedWizard";
import { LineItemsTable, type StockItemOption } from "@/components/voucher/LineItemsTable";
import { GSTSummaryPanel } from "@/components/voucher/GSTSummaryPanel";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import InvoiceForm from "./InvoiceForm";

import { Decimal } from "decimal.js";
import { calculateGST, type GSTTaxType } from "@/lib/services/GSTCalculator";
import { useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PartyOption {
  id: string;
  name: string;
  stateCode?: string;
  gstin?: string;
  partyType?: string;
}

interface CompanySession {
  user?: {
    companyId?: string;
    stateCode?: string;
    name?: string;
  };
  stateCode?: string;
}

// ---------------------------------------------------------------------------
// Quick Customer Create Dialog (simple mode)
// ---------------------------------------------------------------------------

function QuickCustomerDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (party: PartyOption) => void;
}) {
  const [name, setName] = useState("");
  const [gstin, setGstin] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/v1/masters/ledgers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partyType: "customer",
          name: name.trim(),
          gstin: gstin.trim() || undefined,
          phone: phone.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.issues?.[0]?.message ?? err?.error ?? "Failed to create customer");
        return;
      }
      const ledger = await res.json();
      toast.success(`Customer "${ledger.name}" created`);
      onCreated({ id: ledger.id, name: ledger.name, partyType: "Customer" });
      setName(""); setGstin(""); setPhone("");
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); setName(""); setGstin(""); setPhone(""); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New Customer</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Name <span className="text-red-500">*</span></Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer name" />
          </div>
          <div className="space-y-1.5">
            <Label>GSTIN <span className="text-gray-400 text-xs font-normal">(optional)</span></Label>
            <Input value={gstin} onChange={(e) => setGstin(e.target.value)} placeholder="29ABCDE1234F1Z5" />
          </div>
          <div className="space-y-1.5">
            <Label>Phone <span className="text-gray-400 text-xs font-normal">(optional)</span></Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Mobile number" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            className="bg-purple-600 hover:bg-purple-700 text-white"
            onClick={handleSave}
            disabled={saving || !name.trim()}
          >
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : "Create Customer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// SalesInvoiceWizard — Simple Mode only (not exported)
// ---------------------------------------------------------------------------

function SalesInvoiceWizard({ onSuccess }: { onSuccess: (id: string) => void }) {
  const queryClient = useQueryClient();

  const form = useForm<SalesInvoiceInput>({
    resolver: zodResolver(salesInvoiceSchema),
    defaultValues: {
      voucherType: "SALES",
      status: "POSTED",
      date: new Date().toISOString().split("T")[0],
      items: [{ itemId: "", qty: "1", rate: "0", discountPct: "0", itcEligible: false }],
    },
  });

  const { data: sessionData } = useQuery<CompanySession>({
    queryKey: ["session"],
    queryFn: () => fetch("/api/auth/session").then((r) => r.json()),
  });

  const { data: stockItems = [] } = useQuery<StockItemOption[]>({
    queryKey: ["stock-items"],
    queryFn: () =>
      fetch("/api/v1/masters/stock-items").then((r) => {
        if (!r.ok) throw new Error("Failed to load products");
        return r.json();
      }),
  });

  const { data: parties = [] } = useQuery<PartyOption[]>({
    queryKey: ["parties"],
    queryFn: () =>
      fetch("/api/v1/masters/ledgers?type=party").then((r) => {
        if (!r.ok) throw new Error("Failed to load parties");
        return r.json();
      }),
  });

  const [selectedPartyId, setSelectedPartyId] = useState<string>("");
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const companyStateCode = sessionData?.user?.stateCode ?? "";
  const selectedParty = parties.find((p) => p.id === selectedPartyId);
  const partyStateCode = selectedParty?.stateCode ?? "";

  const watchedItems = form.watch("items");

  const totals = useMemo(() => {
    let taxable = new Decimal(0);
    let cgst = new Decimal(0);
    let sgst = new Decimal(0);
    let igst = new Decimal(0);

    for (const item of watchedItems ?? []) {
      const qty = new Decimal(String(item?.qty || "0"));
      const rate = new Decimal(String(item?.rate || "0"));
      const discPct = new Decimal(String(item?.discountPct || "0"));
      const taxableValue = qty
        .times(rate)
        .times(new Decimal(1).minus(discPct.dividedBy(100)));
      taxable = taxable.plus(taxableValue);

      const gstRate = new Decimal(
        String((item as Record<string, unknown>)?.gstRateOverride ?? (item as Record<string, unknown>)?._gstRate ?? 0)
      );
      const result = calculateGST({
        taxableValue,
        gstRate,
        companyStateCode,
        partyStateCode,
      });
      cgst = cgst.plus(result.cgst);
      sgst = sgst.plus(result.sgst);
      igst = igst.plus(result.igst);
    }

    const grandRaw = taxable.plus(cgst).plus(sgst).plus(igst);
    const grandRounded = grandRaw.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
    return {
      taxable,
      cgst,
      sgst,
      igst,
      roundOff: grandRounded.minus(grandRaw),
      grand: grandRounded,
      taxType: (cgst.gt(0) ? "INTRA_STATE" : igst.gt(0) ? "INTER_STATE" : "EXEMPT") as GSTTaxType,
    };
  }, [watchedItems, companyStateCode, partyStateCode]);

  const postMutation = useMutation({
    mutationFn: async (data: SalesInvoiceInput) => {
      const res = await fetch("/api/v1/vouchers", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to create invoice");
      }
      return res.json() as Promise<{ id: string; voucherNo: string }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      toast.success(`Invoice ${data.voucherNo} created successfully`);
      onSuccess(data.id);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Step 1 — Who
  const step1: WizardStep = {
    id: "who",
    label: "Customer",
    component: (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="party" className="text-sm font-medium text-gray-700">
            Customer <span className="text-red-500">*</span>
          </Label>
          <div className="flex gap-1.5">
            <select
              id="party"
              className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-600"
              value={selectedPartyId}
              onChange={(e) => {
                setSelectedPartyId(e.target.value);
                form.setValue("partyLedgerId", e.target.value);
              }}
            >
              <option value="">Select a customer...</option>
              {parties
                .filter((p) => p.partyType === "Customer")
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="px-2 shrink-0 text-gray-500 hover:text-purple-600 border-gray-200"
              onClick={() => setShowNewCustomer(true)}
              title="New customer"
            >
              <UserPlus className="h-4 w-4" />
            </Button>
          </div>
          {form.formState.errors.partyLedgerId && (
            <p className="text-xs text-red-500">
              {form.formState.errors.partyLedgerId.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="date" className="text-sm font-medium text-gray-700">
            Invoice Date <span className="text-red-500">*</span>
          </Label>
          <Input
            id="date"
            type="date"
            {...form.register("date")}
            className="text-sm"
          />
          {form.formState.errors.date && (
            <p className="text-xs text-red-500">
              {form.formState.errors.date.message}
            </p>
          )}
        </div>
      </div>
    ),
    onValidate: async () => {
      const valid = await form.trigger(["partyLedgerId", "date"]);
      return valid;
    },
  };

  // Step 2 — What
  const step2: WizardStep = {
    id: "what",
    label: "Items",
    component: (
      <div className="space-y-4">
        <LineItemsTable
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          control={form.control as any}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setValue={form.setValue as any}
          voucherType="SALES"
          companyStateCode={companyStateCode}
          partyStateCode={partyStateCode}
          stockItems={stockItems}
        />
        <GSTSummaryPanel
          taxableTotal={totals.taxable.toFixed(2)}
          cgstTotal={totals.cgst.toFixed(2)}
          sgstTotal={totals.sgst.toFixed(2)}
          igstTotal={totals.igst.toFixed(2)}
          roundOff={totals.roundOff.toFixed(2)}
          grandTotal={totals.grand.toFixed(2)}
          taxType={totals.taxType}
          uiMode="simple"
        />
      </div>
    ),
    onValidate: async () => {
      const valid = await form.trigger(["items"]);
      return valid;
    },
  };

  // Step 3 — Confirm
  const step3: WizardStep = {
    id: "confirm",
    label: "Confirm",
    component: (
      <div className="space-y-4">
        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Customer</span>
            <span className="font-medium text-gray-900">
              {parties.find((p) => p.id === form.getValues("partyLedgerId"))?.name ?? "—"}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Date</span>
            <span className="font-medium text-gray-900">{form.getValues("date")}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Items</span>
            <span className="font-medium text-gray-900">
              {form.getValues("items").length} item(s)
            </span>
          </div>
        </div>
        <GSTSummaryPanel
          taxableTotal={totals.taxable.toFixed(2)}
          cgstTotal={totals.cgst.toFixed(2)}
          sgstTotal={totals.sgst.toFixed(2)}
          igstTotal={totals.igst.toFixed(2)}
          roundOff={totals.roundOff.toFixed(2)}
          grandTotal={totals.grand.toFixed(2)}
          taxType={totals.taxType}
          uiMode="simple"
        />
      </div>
    ),
  };

  const handleComplete = async () => {
    const data = form.getValues();
    await postMutation.mutateAsync(data);
  };

  return (
    <>
      <GuidedWizard
        steps={[step1, step2, step3]}
        onComplete={handleComplete}
        title="Create Invoice"
      />
      <QuickCustomerDialog
        open={showNewCustomer}
        onClose={() => setShowNewCustomer(false)}
        onCreated={(party) => {
          queryClient.invalidateQueries({ queryKey: ["parties"] });
          setSelectedPartyId(party.id);
          form.setValue("partyLedgerId", party.id);
          setShowNewCustomer(false);
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Page component — mode switch
// ---------------------------------------------------------------------------

export default function SalesInvoiceNewPage() {
  const router = useRouter();
  const { uiMode } = useUiStore();

  if (uiMode === "simple") {
    return (
      <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
        <PageHeader
          title="Create Invoice"
          subtitle="Create an invoice for a customer"
          action={
            <Button variant="outline" onClick={() => router.push("/sales-invoice")}>
              Cancel
            </Button>
          }
        />
        <div className="max-w-2xl mx-auto">
          <SalesInvoiceWizard onSuccess={(id) => router.push(`/sales-invoice/${id}`)} />
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="New Sales Invoice"
        subtitle="Advanced mode — full ledger control"
        action={
          <Button variant="outline" onClick={() => router.push("/sales-invoice")}>
            Cancel
          </Button>
        }
      />
      <InvoiceForm
        voucherType="SALES"
        onSuccess={(id) => router.push(`/sales-invoice/${id}`)}
      />
    </div>
  );
}
