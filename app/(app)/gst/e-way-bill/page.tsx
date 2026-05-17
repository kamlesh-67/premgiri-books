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
import { formatINR } from "@/lib/utils/format";
import { formatDate } from "@/lib/utils/format";

type EWayBillEntry = {
  id: string;
  voucherNo: string;
  date: string;
  totalAmount: string;
  eWayBillNo: string | null;
  eWayBillValidUntil: string | null;
  partyLedger: { name: string; gstin: string | null };
};

export default function EWayBillPage() {
  const [statusFilter, setStatusFilter] = useState("ALL");

  const { data, isLoading, error } = useQuery({
    queryKey: ["ewaybill-list", statusFilter],
    queryFn: async () => {
      const params = statusFilter !== "ALL" ? `?status=${statusFilter}` : "";
      const r = await fetch(`/api/v1/gst/ewaybill${params}`);
      if (!r.ok) throw new Error("Failed to load e-Way Bill list");
      return r.json() as Promise<{
        data: EWayBillEntry[];
        meta: { total: number };
      }>;
    },
  });

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="e-Way Bills"
        subtitle="Goods movement above ₹50,000 require an e-Way Bill from the EWB portal"
      />

      {/* Status filter */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="EXPIRED">Expired</SelectItem>
          </SelectContent>
        </Select>
        {data?.meta?.total !== undefined && (
          <span className="text-sm text-gray-500">
            {data.meta.total} records
          </span>
        )}
      </div>

      <SectionCard title="e-Way Bill Register">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 text-red-600 py-6 px-4">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Failed to load e-Way Bills</span>
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
                  e-Way Bill No
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Valid Till
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.data.map((inv) => {
                const isExpired =
                  inv.eWayBillValidUntil &&
                  new Date(inv.eWayBillValidUntil) < new Date();
                return (
                  <tr
                    key={inv.id}
                    className={`hover:bg-gray-50 ${isExpired ? "bg-amber-50" : ""}`}
                  >
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
                      {inv.eWayBillNo ? (
                        <span className="text-xs font-medium text-gray-900 font-mono">
                          {inv.eWayBillNo}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">&mdash;</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {inv.eWayBillValidUntil ? (
                        <span
                          className={
                            isExpired
                              ? "text-red-600 font-medium text-sm"
                              : "text-gray-700 text-sm"
                          }
                        >
                          {formatDate(inv.eWayBillValidUntil)}
                          {isExpired && " (Expired)"}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">&mdash;</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="outline" size="sm" asChild>
                        <a href={`/sales-invoice/${inv.id}`}>View</a>
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {data.data.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-gray-400 text-sm"
                  >
                    No e-Way Bills found
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
