# PremGiri Books

## Current Milestone: v1.2 Electron Desktop App

**Goal:** Convert PremGiri Books from a cloud SaaS to a fully offline Windows desktop application — Electron + SQLite, local file storage, local auth, first-run company setup wizard, user management by Owner, and optional AI when internet is available.

**Target features:**
- Electron shell (nextron) wrapping Next.js app — installable Windows .exe via NSIS
- SQLite database via Prisma replacing Neon PostgreSQL — zero user setup required
- Local bcrypt + JWT auth replacing NextAuth — no cloud session store
- First-run company setup wizard — blank DB triggers setup screen; admin account auto-created
- User management — Owner creates users with email, password, role (Owner / Accountant)
- User-selectable local folder for all file output (PDFs, PaySlips, exports)
- Remove cloud services — Inngest → Electron main-process scheduler; Redis → JWT expiry; R2 → local FS; email → disabled; PostHog → removed
- Optional AI (Voyage AI + Claude) — online-check before every AI call; graceful degraded UI when offline
- E2E UI tests (Playwright) — login flow, dashboard, voucher CRUD, GST pages, banking, payroll, reports
- Vercel production configuration — vercel.json, environment variables, caching headers, edge config
- Deployment guide and production go-live checklist

---

## What This Is

PremGiri Books is a GST-compliant accounting and business management SaaS for Indian SMBs — a TallyPrime clone built as a web application. v1.0 is a fully shipped product: businesses can record all daily transactions (8 voucher types), file GSTR-1/GSTR-3B, track inventory (FIFO), run payroll, reconcile bank statements, manage e-compliance (e-Invoice, e-Way Bill), and produce statutory financial reports — with an AI layer providing semantic search and plain-English business insights.

## Current State

**Version:** v1.0 — shipped 2026-05-16  
**Stack:** Next.js 15 App Router · TypeScript strict · PostgreSQL (Neon) · Prisma ORM · NextAuth.js v5 · TanStack Query v5 · Zustand · Tailwind CSS · shadcn/ui · Inngest · PostHog · Voyage AI · Anthropic Claude  
**Deploy:** Vercel + Neon PostgreSQL + Upstash Redis

### Shipped in v1.0

- **12 phases** fully executed — ~90 plans, 365 commits, ~188K LOC
- **Dual-mode UX** — Simple Mode (plain-English, 3-step wizards) and Advanced Mode (full ledger picker, accounting entries panel) with per-user preference saved to JWT
- **Complete voucher engine** — Sales Invoice, Purchase Invoice, Receipt, Payment, Journal, Contra, Credit Note, Debit Note — `SUM(DR)===SUM(CR)` enforced before every save; `SELECT FOR UPDATE` for race-safe voucher sequences; audit trail in every `$transaction`
- **GST compliance** — GSTR-1 JSON export (IRP-schema valid), GSTR-3B auto-population + portal submission, ITC Reconciliation (4-color match states), e-Invoice IRN + QR, e-Way Bill
- **Inventory** — Stock Summary (FIFO costing), Stock Ledger, Stock Ageing, Purchase Orders, Sales Orders with partial receive/dispatch and auto-close
- **Financial reports** — Schedule III Balance Sheet, P&L with prior-year comparison, Trial Balance with DR=CR indicator, Outstanding bill-wise ageing, Day Book — all ExcelJS exportable
- **Payroll** — Salary structures (earnings + deductions), attendance grid, Inngest background pay run, PaySlip PDF (R2), PF/ESI/PT statutory rules
- **Banking** — 5-bank CSV import, MatchingEngine (exact + fuzzy), Bank Reconciliation Statement PDF + Excel, Cheque Register
- **RBAC** — Admin/Accountant/Viewer roles, PermissionService, Redis session blocklist (deactivated users locked out in <60s), Audit Trail viewer
- **AI Foundation** — Voyage AI embeddings (voyage-3-lite, 1024-dim) on vouchers + ledgers via Inngest bulk + incremental job; hybrid RRF search (text iLike + vector cosine, k=60); Claude Haiku Smart Insights widget (3 insights, 15-min Redis cache); Inngest cron reminders (GST deadlines, overdue payments at 30/60/90 days, payroll on 25th); PostHog validation + dashboard docs

## Core Value

An Indian SMB accountant can complete a full day's work — entering vouchers, reconciling accounts, filing GST, tracking inventory, and running payroll — entirely within PremGiri Books without opening Tally or a spreadsheet. A non-accountant business owner can understand their financial position in plain English from the Business View dashboard.

## Requirements

### Validated (shipped in v1.0)

- ✓ Design system — purple (#7C3AED) primary, shadcn/ui components, enterprise SaaS layout with fixed sidebar + topbar, KpiCard/PageHeader/SectionCard/StatusBadge/DataTable primitives
- ✓ Full navigation structure — 40+ pages across Transactions, GST, Masters, Inventory, Payroll, Banking, Reports, Settings, AI
- ✓ Indian number/date formatting — ₹1,23,456.00 (lakh system), Indian FY (Apr 1–Mar 31)
- ✓ Zod validation schemas for all entity types on every API boundary
- ✓ Multi-tenant isolation — Prisma companyId extension + explicit WHERE in all raw SQL; companyId always from `session.user`, never from request
- ✓ Double-entry discipline — `SUM(DR)===SUM(CR)` enforced; `SELECT FOR UPDATE` for sequences; audit trail in every transaction
- ✓ GST jurisdiction rules — GSTCalculator auto-determines intra-state (CGST+SGST) vs inter-state (IGST); never trusts user input
- ✓ FIFO inventory costing — StockBatch + StockConsumption with FIFO outflow and cancellation restoration
- ✓ Statutory financial reports — Schedule III Balance Sheet, DR=CR Trial Balance, Outstanding bill-wise ageing
- ✓ AI semantic search — Voyage AI embeddings + hybrid RRF; approximate queries return relevant results
- ✓ Plain-English insights — Claude Haiku generates 3 factually-grounded insights per company per 30 days
- ✓ Automated reminders — GST deadline, overdue payment, payroll crons with Notification dedup

### Out of Scope (v1 decisions confirmed)

- Mobile app / React Native — web-only; TallyPrime users are desktop-first
- Multi-currency — Indian businesses; INR only
- Float/number for financial fields — `Decimal @db.Decimal(15,2)` always; Float is explicitly banned
- Hard deletes on any financial record — soft-delete only (status: CANCELLED / isActive: false)
- Unbalanced vouchers — must throw ValidationError before save
- Mixing CGST+SGST with IGST in same transaction — GST type is intra-state or inter-state, never both

## Context

**Multi-tenant SaaS**: Each company is fully isolated. Every Prisma query carries `companyId: session.user.companyId`. The Prisma extension enforces this for ORM queries; all `$queryRaw` calls include explicit `WHERE "companyId" = ${companyId}`. This is a non-negotiable invariant — missing it is a data breach.

**Double-entry accounting**: Every voucher must have `SUM(DR) === SUM(CR)`. The VoucherEngine service enforces this before any DB write.

**GST jurisdiction rules**: Intra-state supplies use CGST+SGST (equal halves); inter-state use IGST (full rate). The GSTCalculator service enforces this based on supplier/recipient state codes.

**Indian Financial Year**: April 1 – March 31. Voucher sequence numbers reset per FY per company.

**Audit trail**: Every create/update/cancel writes to `audit_logs` inside the same Prisma `$transaction`. No mutation succeeds without an audit entry.

**AI constraints**: voyageai and @anthropic-ai/sdk must never be imported in `'use client'` files. All AI calls are server-only (API routes or Inngest functions). voyageai uses default import (`import VoyageAIClient from 'voyageai'`). Anthropic model ID requires date suffix: `claude-haiku-4-5-20251001`.

## Constraints (unchanged)

- **Stack**: Next.js 15 App Router, TypeScript strict, Prisma ORM, NextAuth.js v5, TanStack Query v5, Zustand — no substitutions
- **Package manager**: pnpm only — no npm/yarn
- **Node**: v20 LTS
- **UI library**: Tailwind CSS + shadcn/ui only — no MUI, Chakra, Ant Design, etc.
- **Financial fields**: `Decimal @db.Decimal(15,2)` in Prisma — never Float, never JS number for money
- **Auth**: `auth()` (NextAuth v5) on every API route — 401 if null
- **Validation**: Zod schema parse before every DB touch
- **Deploy target**: Vercel (app) + Neon PostgreSQL + Upstash Redis

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Next.js 15 App Router | Server Components reduce bundle size for data-heavy accounting pages; streaming for large reports | ✓ Validated — RSC + route handlers pattern works well at scale |
| Neon PostgreSQL | Prisma Migrate works natively; Decimal type support critical for financial data; pgvector for AI | ✓ Validated — pgvector ivfflat indexes performing < 100ms |
| NextAuth.js v5 | Built-in session management; credential provider; v5 API matches Next.js 15 patterns | ✓ Validated — JWT with companyId/roleId clean |
| TanStack Query v5 | Optimistic updates for voucher forms; cache invalidation on save | ✓ Validated — queryKey structure stable across all pages |
| pnpm over npm | Disk-efficient for shadcn/ui + Radix UI heavy dependency tree | ✓ Validated |
| Prisma companyId extension | Auto-injects companyId on ORM queries; prevents cross-tenant leaks | ✓ Validated — raw SQL must still include explicit WHERE |
| Voyage AI voyage-3-lite | 1024-dim embeddings, cost-efficient, good quality for accounting domain | ✓ Validated — RRF hybrid search producing relevant results |
| RRF k=60 for hybrid search | Standard fusion parameter; blends text + vector without over-weighting either | ✓ Validated |
| Claude Haiku for insights | Fast, cheap, sufficient for 3-bullet business summaries with < 256 tokens | ✓ Validated |

## Evolution

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---

*Last updated: 2026-05-31 — v1.2 Electron Desktop App milestone started*
