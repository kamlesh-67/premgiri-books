"use client"

/**
 * Reconciliation Page — Bank Statement Import + Transaction Matching
 *
 * Replaces the mockData stub. Implements:
 *  - Upload section (bank selector, ledger dropdown, CSV file input)
 *  - Previously imported statements list (clickable)
 *  - Transaction matching table with All/Matched/Unmatched tabs
 *  - KPI strip (total entries, matched, unmatched)
 *  - Closing balance indicator (reconciled/gap)
 *  - Confirm/Reject inline actions for AUTO_* matches
 *  - Create Voucher shortcut for UNMATCHED/REJECTED rows (D-08)
 *  - Export: PDF (R2 pre-signed URL) + Excel (streaming attachment)
 *  - Re-match button
 *  - Simple Mode labels via useUiStore
 *
 * Rules:
 *  - All amounts: Decimal from 'decimal.js' — no parseFloat on financial values
 *  - r.ok guard in every mutationFn before r.json()
 *  - All labels mode-gated via useUiStore().uiMode
 */

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Decimal } from "decimal.js"
import {
  Upload,
  RefreshCw,
  Download,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Check,
  X,
  FileText,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs"
import { PageHeader } from "@/components/primitives/PageHeader"
import { SectionCard } from "@/components/primitives/SectionCard"
import { KpiCard } from "@/components/primitives/KpiCard"
import { StatusBadge } from "@/components/primitives/StatusBadge"
import { useUiStore } from "@/lib/stores/uiStore"
import { formatINR } from "@/lib/format"

// ── Types ─────────────────────────────────────────────────────────────────────

type BankName = "SBI" | "HDFC" | "ICICI" | "Axis" | "Kotak"

type StatementMeta = {
  id: string
  bank: string
  ledgerName: string
  fromDate: string
  toDate: string
  uploadedAt: string
  rowCount: number
}

type BankTransaction = {
  id: string
  txDate: string
  description: string
  debitAmount: string | null
  creditAmount: string | null
  balance: string | null
  matchStatus: "UNMATCHED" | "AUTO_HIGH" | "AUTO_MEDIUM" | "AUTO_LOW" | "CONFIRMED" | "REJECTED"
  matchedVoucherId: string | null
  confidence: "HIGH" | "MEDIUM" | "LOW" | null
  matchedVoucher?: {
    voucherNo: string
    date: string
    totalAmount: string
  }
}

type BrsData = {
  bankClosingBalance: string
  booksClosingBalance: string
  difference: string
  isReconciled: boolean
  totalTx: number
  matchedCount: number
  unmatchedCount: number
}

type StatementDetail = {
  statement: StatementMeta
  transactions: BankTransaction[]
  brsData: BrsData | null
  totalCount: number
}

type LedgerOption = {
  id: string
  name: string
  groupPath?: string
}

// ── Confidence badge variant helper ──────────────────────────────────────────

function confidenceVariant(
  confidence: "HIGH" | "MEDIUM" | "LOW" | null,
  matchStatus: BankTransaction["matchStatus"]
): "posted" | "due-soon" | "draft" {
  if (matchStatus === "CONFIRMED") return "posted"
  if (confidence === "HIGH") return "posted"
  if (confidence === "MEDIUM" || confidence === "LOW") return "due-soon"
  return "draft"
}

function confidenceLabel(
  confidence: "HIGH" | "MEDIUM" | "LOW" | null,
  matchStatus: BankTransaction["matchStatus"]
): string {
  if (matchStatus === "CONFIRMED") return "CONFIRMED"
  if (matchStatus === "REJECTED") return "REJECTED"
  if (matchStatus === "UNMATCHED") return "UNMATCHED"
  return confidence ?? "UNKNOWN"
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ReconciliationPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const { uiMode } = useUiStore()
  const isSimple = uiMode === "simple"

  // ── State ──────────────────────────────────────────────────────────────────
  const [selectedStatementId, setSelectedStatementId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"all" | "matched" | "unmatched">("all")
  const [bank, setBank] = useState<BankName | "">("")
  const [ledgerId, setLedgerId] = useState<string>("")
  const [file, setFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Queries ────────────────────────────────────────────────────────────────

  // List of past bank statement imports
  const { data: statements = [], isLoading: loadingStatements } = useQuery<StatementMeta[]>({
    queryKey: ["bank-statements"],
    queryFn: async () => {
      const r = await fetch("/api/v1/bank-statements")
      if (!r.ok) throw new Error(await r.text())
      return r.json()
    },
  })

  // Ledger dropdown — fetch all active ledgers (user selects bank account ledger)
  const { data: ledgers = [] } = useQuery<LedgerOption[]>({
    queryKey: ["ledgers-all"],
    queryFn: async () => {
      const r = await fetch("/api/v1/masters/ledgers")
      if (!r.ok) throw new Error(await r.text())
      const data = await r.json()
      return data.map((l: { id: string; name: string; groupPath?: string }) => ({
        id: l.id,
        name: l.name,
        groupPath: l.groupPath,
      }))
    },
  })

  // Statement detail with transactions + BRS data
  const {
    data: stmtDetail,
    isLoading: loadingDetail,
    isError: detailError,
  } = useQuery<StatementDetail>({
    queryKey: ["bank-statement-detail", selectedStatementId],
    queryFn: async () => {
      const r = await fetch(`/api/v1/bank-statements/${selectedStatementId}?limit=200`)
      if (!r.ok) throw new Error(await r.text())
      return r.json()
    },
    enabled: !!selectedStatementId,
  })

  // ── Mutations ──────────────────────────────────────────────────────────────

  // Upload CSV statement
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file || !bank || !ledgerId) {
        throw new Error("Please select a bank, ledger, and CSV file")
      }
      const formData = new FormData()
      formData.append("file", file)
      formData.append("bank", bank)
      formData.append("ledgerId", ledgerId)

      const r = await fetch("/api/v1/bank-statements", {
        method: "POST",
        body: formData,
      })
      if (!r.ok) throw new Error(await r.text())
      return r.json() as Promise<{ id: string; rowCount: number }>
    },
    onSuccess: (data) => {
      toast.success(`Imported ${data.rowCount} transactions`)
      qc.invalidateQueries({ queryKey: ["bank-statements"] })
      setSelectedStatementId(data.id)
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // Confirm / Reject match
  const matchActionMutation = useMutation({
    mutationFn: async ({ txId, action }: { txId: string; action: "confirm" | "reject" }) => {
      const r = await fetch(`/api/v1/bank-transactions/${txId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (!r.ok) throw new Error(await r.text())
      return r.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bank-statement-detail", selectedStatementId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // Re-run matching
  const rematchMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/v1/bank-statements/${selectedStatementId}/match`, {
        method: "POST",
      })
      if (!r.ok) throw new Error(await r.text())
      return r.json()
    },
    onSuccess: () => {
      toast.success("Re-matching complete")
      qc.invalidateQueries({ queryKey: ["bank-statement-detail", selectedStatementId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // Download PDF
  const downloadPdfMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/v1/bank-statements/${selectedStatementId}/pdf`)
      if (!r.ok) throw new Error(await r.text())
      return r.json() as Promise<{ url: string }>
    },
    onSuccess: (data) => {
      window.open(data.url, "_blank")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // ── Derived data ───────────────────────────────────────────────────────────

  const transactions = stmtDetail?.transactions ?? []
  const brsData = stmtDetail?.brsData

  const filteredTransactions = transactions.filter((tx) => {
    if (activeTab === "matched") {
      return ["AUTO_HIGH", "AUTO_MEDIUM", "AUTO_LOW", "CONFIRMED"].includes(tx.matchStatus)
    }
    if (activeTab === "unmatched") {
      return ["UNMATCHED", "REJECTED"].includes(tx.matchStatus)
    }
    return true
  })

  // ── Helpers ────────────────────────────────────────────────────────────────

  function fmtAmt(str: string | null | undefined): string {
    if (!str || str === "0.00") return "—"
    return formatINR(new Decimal(str).toNumber())
  }

  function fmtDate(isoStr: string): string {
    try {
      const d = new Date(isoStr)
      return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    } catch {
      return isoStr
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const pageTitle = isSimple ? "Match Transactions" : "Bank Reconciliation"
  const pageSubtitle = isSimple
    ? "Upload your bank statement and match transactions"
    : "Import bank statement CSV and reconcile against books"

  const uploadBtnLabel = isSimple ? "Upload Statement" : "Import CSV"
  const bankFieldLabel = isSimple ? "Select your bank" : "Bank"
  const ledgerFieldLabel = isSimple ? "My Bank Account" : "Bank Ledger"

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title={pageTitle}
        subtitle={pageSubtitle}
        actions={
          selectedStatementId ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => rematchMutation.mutate()}
                disabled={rematchMutation.isPending}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${rematchMutation.isPending ? "animate-spin" : ""}`} />
                Re-match
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadPdfMutation.mutate()}
                disabled={downloadPdfMutation.isPending}
              >
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  window.location.href = `/api/v1/bank-statements/${selectedStatementId}/excel`
                }}
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Download Excel
              </Button>
            </div>
          ) : undefined
        }
      />

      {/* ── Upload Section ─────────────────────────────────────────────────── */}
      <SectionCard title={isSimple ? "Upload Statement" : "Import Bank Statement"}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Bank selector */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">{bankFieldLabel}</label>
            <Select value={bank} onValueChange={(v) => setBank(v as BankName)}>
              <SelectTrigger>
                <SelectValue placeholder="Select bank..." />
              </SelectTrigger>
              <SelectContent>
                {(["SBI", "HDFC", "ICICI", "Axis", "Kotak"] as BankName[]).map((b) => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Ledger dropdown */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">{ledgerFieldLabel}</label>
            <Select value={ledgerId} onValueChange={setLedgerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select ledger..." />
              </SelectTrigger>
              <SelectContent>
                {ledgers.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* File input */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">CSV File (.csv)</label>
            <Input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="cursor-pointer"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Button
            onClick={() => uploadMutation.mutate()}
            disabled={uploadMutation.isPending || !bank || !ledgerId || !file}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            <Upload className="mr-2 h-4 w-4" />
            {uploadMutation.isPending ? "Uploading..." : uploadBtnLabel}
          </Button>
          {file && (
            <span className="text-sm text-gray-500">{file.name}</span>
          )}
        </div>
      </SectionCard>

      {/* ── Previously Imported Statements ────────────────────────────────── */}
      {statements.length > 0 && (
        <SectionCard title="Previous Imports">
          {loadingStatements ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {statements.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedStatementId(s.id)}
                  className={`rounded-lg border px-4 py-2.5 text-left text-sm transition-colors ${
                    selectedStatementId === s.id
                      ? "border-purple-500 bg-purple-50 text-purple-700"
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <div className="font-medium">{s.bank} — {s.ledgerName}</div>
                  <div className="mt-0.5 text-xs text-gray-500">
                    {fmtDate(s.fromDate)} to {fmtDate(s.toDate)} · {s.rowCount} rows
                  </div>
                </button>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {/* ── Statement Detail (only when a statement is selected) ──────────── */}
      {selectedStatementId && (
        <>
          {loadingDetail && (
            <div className="py-8 text-center text-sm text-gray-500">Loading transactions...</div>
          )}

          {detailError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              Failed to load statement details. Please try again.
            </div>
          )}

          {stmtDetail && brsData && (
            <>
              {/* ── KPI Strip ──────────────────────────────────────────────── */}
              <div className="grid grid-cols-3 gap-4">
                <KpiCard
                  title="Total Entries"
                  value={String(brsData.totalTx)}
                  icon={FileText}
                  iconTone="primary"
                />
                <KpiCard
                  title="Matched"
                  value={String(brsData.matchedCount)}
                  icon={Check}
                  iconTone="success"
                />
                <KpiCard
                  title="Unmatched"
                  value={String(brsData.unmatchedCount)}
                  icon={AlertCircle}
                  iconTone="warning"
                />
              </div>

              {/* ── Closing Balance Indicator ───────────────────────────────── */}
              <div
                className={`flex items-center gap-3 rounded-lg border p-4 ${
                  brsData.isReconciled
                    ? "border-green-200 bg-green-50"
                    : "border-red-200 bg-red-50"
                }`}
              >
                {brsData.isReconciled ? (
                  <>
                    <CheckCircle className="h-5 w-5 flex-shrink-0 text-green-600" />
                    <span className="text-sm font-medium text-green-700">
                      Reconciled — Closing balances agree
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
                    <span className="text-sm font-medium text-red-700">
                      Gap: {formatINR(new Decimal(brsData.difference).toNumber())} — {brsData.unmatchedCount} item{brsData.unmatchedCount !== 1 ? "s" : ""} remaining
                    </span>
                  </>
                )}
              </div>

              {/* ── Transaction Table with Tabs ─────────────────────────────── */}
              <SectionCard title={isSimple ? "Transactions" : "Bank Transactions"}>
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
                  <TabsList className="mb-4">
                    <TabsTrigger value="all">
                      All ({transactions.length})
                    </TabsTrigger>
                    <TabsTrigger value="matched">
                      Matched ({brsData.matchedCount})
                    </TabsTrigger>
                    <TabsTrigger value="unmatched">
                      Unmatched ({brsData.unmatchedCount})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value={activeTab}>
                    <div className="overflow-x-auto">
                      <table className="w-full" aria-label="Bank transactions">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Description</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Debit</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Credit</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Matched Voucher</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Confidence</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {filteredTransactions.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                                No transactions in this view
                              </td>
                            </tr>
                          ) : (
                            filteredTransactions.map((tx) => (
                              <tr key={tx.id} className="hover:bg-gray-50">
                                {/* Date */}
                                <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                                  {fmtDate(tx.txDate)}
                                </td>

                                {/* Description */}
                                <td className="px-4 py-3 text-sm text-gray-700 max-w-xs">
                                  <span className="line-clamp-2">{tx.description}</span>
                                </td>

                                {/* Debit */}
                                <td className="px-4 py-3 text-right text-sm text-gray-700 tabular-nums whitespace-nowrap">
                                  {fmtAmt(tx.debitAmount)}
                                </td>

                                {/* Credit */}
                                <td className="px-4 py-3 text-right text-sm text-green-700 tabular-nums whitespace-nowrap">
                                  {fmtAmt(tx.creditAmount)}
                                </td>

                                {/* Matched Voucher */}
                                <td className="px-4 py-3 text-sm">
                                  {tx.matchedVoucher ? (
                                    <div>
                                      <div className="font-medium text-gray-700">{tx.matchedVoucher.voucherNo}</div>
                                      <div className="text-xs text-gray-500">
                                        {fmtDate(tx.matchedVoucher.date)} · {fmtAmt(tx.matchedVoucher.totalAmount)}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-gray-400">No match found</span>
                                  )}
                                </td>

                                {/* Confidence badge */}
                                <td className="px-4 py-3">
                                  <StatusBadge
                                    status={confidenceLabel(tx.confidence, tx.matchStatus)}
                                    variant={confidenceVariant(tx.confidence, tx.matchStatus)}
                                  />
                                </td>

                                {/* Actions */}
                                <td className="px-4 py-3 text-right">
                                  <ActionCell
                                    tx={tx}
                                    selectedStatementId={selectedStatementId}
                                    onConfirm={() => matchActionMutation.mutate({ txId: tx.id, action: "confirm" })}
                                    onReject={() => matchActionMutation.mutate({ txId: tx.id, action: "reject" })}
                                    isPending={matchActionMutation.isPending}
                                    router={router}
                                  />
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </TabsContent>
                </Tabs>
              </SectionCard>
            </>
          )}
        </>
      )}
    </div>
  )
}

// ── ActionCell sub-component ──────────────────────────────────────────────────

type ActionCellProps = {
  tx: BankTransaction
  selectedStatementId: string
  onConfirm: () => void
  onReject: () => void
  isPending: boolean
  router: ReturnType<typeof useRouter>
}

function ActionCell({ tx, selectedStatementId, onConfirm, onReject, isPending, router }: ActionCellProps) {
  // AUTO_* rows: show Confirm + Reject buttons
  if (["AUTO_HIGH", "AUTO_MEDIUM", "AUTO_LOW"].includes(tx.matchStatus)) {
    return (
      <div className="flex items-center justify-end gap-2">
        <Button
          size="sm"
          className="bg-green-600 hover:bg-green-700 text-white h-7 px-2.5 text-xs"
          onClick={onConfirm}
          disabled={isPending}
          aria-label="Confirm match"
        >
          <Check className="h-3 w-3 mr-1" />
          Confirm
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-red-300 text-red-600 hover:bg-red-50 h-7 px-2.5 text-xs"
          onClick={onReject}
          disabled={isPending}
          aria-label="Reject match"
        >
          <X className="h-3 w-3 mr-1" />
          Reject
        </Button>
      </div>
    )
  }

  // UNMATCHED / REJECTED rows: Create Voucher button (D-08)
  if (tx.matchStatus === "UNMATCHED" || tx.matchStatus === "REJECTED") {
    const handleCreateVoucher = () => {
      // D-08: pass amount, date, narration, bankTxId, statementId as URL params
      const params = new URLSearchParams()
      // Amount: prefer debitAmount (payment from bank view), fall back to creditAmount
      const amount =
        tx.debitAmount && tx.debitAmount !== "0.00" ? tx.debitAmount : tx.creditAmount
      if (amount) params.set("amount", amount)
      params.set("date", tx.txDate.split("T")[0])
      params.set("narration", tx.description)  // CR-06: URLSearchParams.set() encodes automatically; no manual encodeURIComponent needed
      params.set("bankTxId", tx.id)
      params.set("statementId", selectedStatementId)
      router.push(`/vouchers/payment/new?${params.toString()}`)
    }

    return (
      <Button
        size="sm"
        variant="outline"
        className="h-7 px-2.5 text-xs"
        onClick={handleCreateVoucher}
        aria-label="Create voucher for this transaction"
      >
        Create Voucher
      </Button>
    )
  }

  // CONFIRMED / other final states: show status badge only
  return (
    <StatusBadge
      status={tx.matchStatus}
      variant={tx.matchStatus === "CONFIRMED" ? "posted" : "cancelled"}
    />
  )
}
