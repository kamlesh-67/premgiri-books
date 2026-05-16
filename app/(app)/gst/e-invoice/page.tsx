"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatINR } from "@/lib/utils/format";
import { formatDate } from "@/lib/utils/format";

type EInvoice = {
  id: string;
  voucherNo: string;
  date: string;
  totalAmount: string;
  irn: string | null;
  irnGeneratedAt: string | null;
  eWayBillNo: string | null;
  eWayBillValidUntil: string | null;
  status: string;
  partyLedger: { name: string; gstin: string | null };
};

export default function EInvoicePage() {
  const [statusFilter, setStatusFilter] = useState("ALL");

  const { data, isLoading, error } = useQuery({
    queryKey: ["einvoice-list", statusFilter],
    queryFn: async () => {
      const params = statusFilter !== "ALL" ? `?status=${statusFilter}` : "";
      const r = await fetch(`/api/v1/gst/einvoice${params}`);
      if (!r.ok) throw new Error("Failed to load e-Invoice list");
      return r.json() as Promise<{ data: EInvoice[]; meta: { total: number } }>;
    },
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="e-Invoice"
        subtitle="Manage IRN generation for GST-registered sales invoices"
      />

      {/* Status filter */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Invoices</SelectItem>
            <SelectItem value="PENDING">Pending IRN</SelectItem>
            <SelectItem value="GENERATED">IRN Generated</SelectItem>
          </SelectContent>
        </Select>
        {data?.meta?.total !== undefined && (
          <span className="text-sm text-gray-500">
            {data.meta.total} invoices
          </span>
        )}
      </div>

      <SectionCard title="e-Invoice Register">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 text-red-600 py-6 px-4">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Failed to load e-Invoices</span>
          </div>
        )}
        {data && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Invoice No
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Party
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  IRN Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  e-Way Bill
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.data.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {inv.voucherNo}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {formatDate(inv.date)}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {inv.partyLedger.name}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                    {formatINR(inv.totalAmount)}
                  </td>
                  <td className="px-4 py-3">
                    {inv.irn ? (
                      <div>
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-700">
                          IRN Generated
                        </span>
                        <div className="text-xs text-gray-400 mt-1 font-mono">
                          {inv.irn.slice(0, 16)}&hellip;
                        </div>
                      </div>
                    ) : (
                      <StatusBadge status="PENDING" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {inv.eWayBillNo ? (
                      <div>
                        <span className="text-xs font-medium text-green-700">
                          {inv.eWayBillNo}
                        </span>
                        {inv.eWayBillValidUntil && (
                          <div className="text-xs text-gray-400">
                            Valid till: {formatDate(inv.eWayBillValidUntil)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">&mdash;</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Button variant="outline" size="sm" asChild>
                      <a href={`/sales-invoice/${inv.id}`}>View</a>
                    </Button>
                  </td>
                </tr>
              ))}
              {data.data.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-gray-400 text-sm"
                  >
                    No invoices found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </SectionCard>
    </div>
  );
}
