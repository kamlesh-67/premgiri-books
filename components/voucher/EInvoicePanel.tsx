"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileCheck, Truck, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

type TransMode = "1" | "2" | "3" | "4";
type VehType = "R" | "O";

type EInvoicePanelProps = {
  voucherId: string;
  voucher: {
    status: string;
    irn: string | null;
    eWayBillNo: string | null;
    eWayBillValidUntil: string | null;
    irnGeneratedAt: string | null;
  };
};

export function EInvoicePanel({ voucherId, voucher }: EInvoicePanelProps) {
  const queryClient = useQueryClient();
  const [showEwbForm, setShowEwbForm] = useState(false);
  const [ewbData, setEwbData] = useState<{
    TransMode: TransMode;
    Distance: string;
    VehNo: string;
    VehType: VehType;
  }>({
    TransMode: "1",
    Distance: "",
    VehNo: "",
    VehType: "R",
  });
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const generateIrnMutation = useMutation({
    mutationFn: async (withEwb: boolean) => {
      if (withEwb && !ewbData.Distance) {
        throw new Error("Distance is required to generate e-Way Bill")
      }
      const body =
        withEwb && ewbData.Distance
          ? {
              ewbDtls: {
                TransMode: ewbData.TransMode,
                Distance: parseInt(ewbData.Distance),
                VehNo: ewbData.VehNo || undefined,
                VehType: ewbData.VehType,
              },
            }
          : {};
      const r = await fetch(`/api/v1/gst/einvoice/${voucherId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const err = (await r.json()) as { error?: string };
        throw new Error(err.error ?? "IRN generation failed");
      }
      return r.json() as Promise<{ irn: string; ackNo: string; ewbNo?: string }>;
    },
    onSuccess: (data) => {
      setError(null);
      setSuccessMsg(
        `IRN generated: ${data.irn.slice(0, 20)}… (Ack: ${data.ackNo})${data.ewbNo ? ` | EWB: ${data.ewbNo}` : ""}`
      );
      void queryClient.invalidateQueries({ queryKey: ["voucher", voucherId] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const generateEwbMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/v1/gst/ewaybill/${voucherId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          TransMode: ewbData.TransMode,
          Distance: parseInt(ewbData.Distance),
          VehNo: ewbData.VehNo || undefined,
          VehType: ewbData.VehType,
        }),
      });
      if (!r.ok) {
        const err = (await r.json()) as { error?: string };
        throw new Error(err.error ?? "e-Way Bill generation failed");
      }
      return r.json() as Promise<{ ewbNo: string }>;
    },
    onSuccess: (data) => {
      setError(null);
      setSuccessMsg(`e-Way Bill generated: ${data.ewbNo}`);
      void queryClient.invalidateQueries({ queryKey: ["voucher", voucherId] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const isCancelled = voucher.status === "CANCELLED";
  const isDraft = voucher.status === "DRAFT";
  const hasIrn = !!voucher.irn;
  const hasEwb = !!voucher.eWayBillNo;

  if (isCancelled) {
    return (
      <p className="text-sm text-gray-400 py-2">
        e-Invoice not applicable — voucher is cancelled.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* IRN + EWB Status */}
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            IRN Status
          </div>
          {hasIrn ? (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm font-mono text-gray-700">
                {voucher.irn!.slice(0, 32)}&hellip;
              </span>
            </div>
          ) : (
            <span className="text-sm text-amber-600">Not generated</span>
          )}
          {voucher.irnGeneratedAt && (
            <div className="text-xs text-gray-400 mt-1">
              Generated:{" "}
              {new Date(voucher.irnGeneratedAt).toLocaleDateString("en-IN")}
            </div>
          )}
        </div>

        <div className="flex-1">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            e-Way Bill
          </div>
          {hasEwb ? (
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-green-600" />
              <span className="text-sm text-gray-700">{voucher.eWayBillNo}</span>
            </div>
          ) : (
            <span className="text-sm text-gray-400">&mdash;</span>
          )}
          {voucher.eWayBillValidUntil && (
            <div className="text-xs text-gray-400 mt-1">
              Valid till:{" "}
              {new Date(voucher.eWayBillValidUntil).toLocaleDateString("en-IN")}
            </div>
          )}
        </div>
      </div>

      {/* Error + success alerts */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {successMsg && (
        <Alert>
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">
            {successMsg}
          </AlertDescription>
        </Alert>
      )}

      {/* EWB transport form */}
      {showEwbForm && !hasIrn && (
        <div className="border border-gray-200 rounded-md p-4 space-y-3 bg-gray-50">
          <p className="text-xs font-medium text-gray-600">
            e-Way Bill details (optional — include to generate IRN + EWB in one
            step)
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Transport Mode</Label>
              <Select
                value={ewbData.TransMode}
                onValueChange={(v) =>
                  setEwbData((p) => ({ ...p, TransMode: v as TransMode }))
                }
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Road</SelectItem>
                  <SelectItem value="2">Rail</SelectItem>
                  <SelectItem value="3">Air</SelectItem>
                  <SelectItem value="4">Ship</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Distance (km) *</Label>
              <Input
                className="h-8 text-sm"
                type="number"
                min={1}
                max={4000}
                placeholder="e.g. 250"
                value={ewbData.Distance}
                onChange={(e) =>
                  setEwbData((p) => ({ ...p, Distance: e.target.value }))
                }
              />
            </div>
            <div>
              <Label className="text-xs">Vehicle No</Label>
              <Input
                className="h-8 text-sm"
                placeholder="e.g. KA01AB1234"
                value={ewbData.VehNo}
                onChange={(e) =>
                  setEwbData((p) => ({ ...p, VehNo: e.target.value }))
                }
              />
            </div>
          </div>
        </div>
      )}

      {/* EWB form for standalone EWB (after IRN already generated) */}
      {showEwbForm && hasIrn && !hasEwb && (
        <div className="border border-gray-200 rounded-md p-4 space-y-3 bg-gray-50">
          <p className="text-xs font-medium text-gray-600">
            e-Way Bill transport details
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Transport Mode</Label>
              <Select
                value={ewbData.TransMode}
                onValueChange={(v) =>
                  setEwbData((p) => ({ ...p, TransMode: v as TransMode }))
                }
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Road</SelectItem>
                  <SelectItem value="2">Rail</SelectItem>
                  <SelectItem value="3">Air</SelectItem>
                  <SelectItem value="4">Ship</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Distance (km) *</Label>
              <Input
                className="h-8 text-sm"
                type="number"
                min={1}
                max={4000}
                placeholder="e.g. 250"
                value={ewbData.Distance}
                onChange={(e) =>
                  setEwbData((p) => ({ ...p, Distance: e.target.value }))
                }
              />
            </div>
            <div>
              <Label className="text-xs">Vehicle No</Label>
              <Input
                className="h-8 text-sm"
                placeholder="e.g. KA01AB1234"
                value={ewbData.VehNo}
                onChange={(e) =>
                  setEwbData((p) => ({ ...p, VehNo: e.target.value }))
                }
              />
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-3 pt-1">
        {!hasIrn && !isDraft && (
          <>
            <Button
              size="sm"
              onClick={() => generateIrnMutation.mutate(false)}
              disabled={generateIrnMutation.isPending}
            >
              {generateIrnMutation.isPending && (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              )}
              <FileCheck className="h-3 w-3 mr-1" />
              Generate IRN
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowEwbForm((v) => !v)}
            >
              <Truck className="h-3 w-3 mr-1" />
              {showEwbForm ? "Hide EWB Form" : "Generate IRN + EWB"}
            </Button>
            {showEwbForm && ewbData.Distance && (
              <Button
                size="sm"
                onClick={() => generateIrnMutation.mutate(true)}
                disabled={generateIrnMutation.isPending}
              >
                {generateIrnMutation.isPending && (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                )}
                Generate IRN + EWB
              </Button>
            )}
          </>
        )}

        {hasIrn && !hasEwb && (
          <>
            {!showEwbForm && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowEwbForm(true)}
              >
                <Truck className="h-3 w-3 mr-1" />
                Generate e-Way Bill
              </Button>
            )}
            {showEwbForm && (
              <Button
                size="sm"
                onClick={() => generateEwbMutation.mutate()}
                disabled={generateEwbMutation.isPending || !ewbData.Distance}
              >
                {generateEwbMutation.isPending && (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                )}
                <Truck className="h-3 w-3 mr-1" />
                Confirm Generate EWB
              </Button>
            )}
          </>
        )}

        {isDraft && (
          <p className="text-xs text-gray-400">
            Post the voucher first to generate IRN.
          </p>
        )}
      </div>
    </div>
  );
}
