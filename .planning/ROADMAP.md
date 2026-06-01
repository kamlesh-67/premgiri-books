# PremGiri Books â€” Roadmap

## Milestones

- âœ… **v1.0 Full Accounting SaaS** â€” Phases 0â€“11 (shipped 2026-05-16)
- ðŸš§ **v1.1 Production Ready** â€” Phases 12â€“16 (in progress)
- ðŸ“‹ **v1.2 Electron Desktop App** â€” Phases 17â€“22 (planned)

---

## âœ… Milestone 1: Full Accounting SaaS â€” v1.0 [Shipped 2026-05-16]

> 12 phases Â· 53 requirements Â· ~90 plans Â· 365 commits Â· ~188K LOC  
> Full archive: [.planning/milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

<details>
<summary>Phase list (all complete)</summary>

- [x] Phase 0: Infrastructure & Design System â€” scaffold, Prisma schema, shared components, skill files, R2/Resend/Inngest/PostHog
- [x] Phase 1: Auth, UX Shell & Masters â€” login, multi-company session, Simple/Advanced mode, dashboards, ledger/stock/party CRUD
- [x] Phase 2: Voucher Engine â€” all 8 voucher types, bill-wise settlement, double-entry enforcement, GST auto-calc, audit trail
- [x] Phase 3: GST, Invoice PDF & TDS â€” GSTR-1, GSTR-3B, ITC Reconciliation, Sales Invoice PDF, basic TDS (194C, 194J)
- [x] Phase 4: Inventory & Orders â€” Stock Summary (FIFO), Stock Ledger, Stock Ageing, Purchase Orders, Sales Orders
- [x] Phase 5: Financial Reports â€” Trial Balance, Balance Sheet (Schedule III), P&L, Day Book, Outstanding (bill-wise ageing)
- [x] Phase 6: Payroll â€” salary structures, attendance, pay run (Inngest), pay slip PDF (R2), PF/ESI basic
- [x] Phase 7: Banking â€” bank statement import (5 Indian banks), cheque register, reconciliation statement
- [x] Phase 8: e-Compliance â€” e-Invoice (IRP), e-Way Bill, GSTR-3B portal submission
- [x] Phase 9: RBAC, Admin & Audit â€” user management, role permissions, company settings, audit trail viewer
- [x] Phase 10: DX & Deploy â€” global search (âŒ˜K), keyboard shortcuts (F5â€“F9), Vercel production deploy, Vitest, Playwright
- [x] Phase 11: AI Foundation â€” pgvector embeddings, hybrid RRF search, Smart Insights widget, PostHog dashboards, Inngest cron reminders

</details>

---

## ðŸš§ Milestone 2: Production Ready â€” v1.1 (In Progress)

**Milestone Goal:** Audit code quality against all v1.0 modules, build a complete test pyramid (unit â†’ integration â†’ E2E), configure Vercel for production, and ship PremGiri Books live with a verified go-live checklist.

**Scope:** No new product features. All phases are hardening, testing, and deployment work.

### Phases

- [ ] **Phase 12: Test Infrastructure** â€” Zero-config `pnpm test` foundation with custom matchers and mocks
- [ ] **Phase 13: Unit Tests â€” Service Layer** â€” All 6 service classes fully tested and green
- [ ] **Phase 14: Integration Tests** â€” All API route groups covered with auth, isolation, and shape assertions
- [ ] **Phase 15: E2E Tests** â€” All critical Playwright flows passing in CI against real pages
- [ ] **Phase 16: Vercel Production Deploy** â€” Live on Vercel BOM1 with all env vars, Inngest connected, smoke test passed

---

## ðŸ“‹ Milestone 3: Electron Desktop App â€” v1.2 (Planned)

**Milestone Goal:** Convert PremGiri Books from a cloud SaaS to a fully offline Windows desktop application â€” Electron + SQLite, local file storage, local auth, first-run company setup wizard, user management by Owner, and optional AI when internet is available.

**Scope:** 34 requirements across 8 categories (ELEC, DB, AUTH, SETUP, USER, FILE, CLOUD, AI). No new accounting features.

### Phases

- [ ] **Phase 17: Electron Shell + SQLite Migration** â€” App runs in Electron window; SQLite replaces PostgreSQL
- [ ] **Phase 18: Local Authentication** â€” bcrypt+JWT replaces NextAuth; every route protected
- [ ] **Phase 19: First-Run Company Setup Wizard** â€” Blank DB triggers `/setup`; company + admin created; setup locked after first run
- [x] **Phase 20: User Management** â€” Owner creates/deactivates users; Accountant role enforced at Users page
- [ ] **Phase 21: Local File Storage + Cloud Service Removal** â€” PDFs write to local folder; all cloud dependencies removed
- [x] **Phase 22: Optional AI + Windows Installer** — Online check gates every AI call; graceful offline fallback; `.exe` installer ships

---

## Phase Details

### Phase 12: Test Infrastructure
**Goal**: Developer can run `pnpm test` in a clean checkout and see zero configuration errors â€” all mocks registered, path aliases resolved, and custom matchers available
**Depends on**: Phase 11 (v1.0 complete)
**Requirements**: UNIT-01
**Success Criteria** (what must be TRUE):
  1. `pnpm test` exits with no import errors, no module-not-found errors, and no uncaught type errors in test setup
  2. `server-only`, `next/navigation`, and `next/headers` are mocked in `vitest.setup.ts` so service tests run outside Next.js runtime
  3. `toBeCloseToDecimal(expected, digits)` custom matcher is available in all test files and works correctly with Prisma `Decimal` values
  4. `vite-tsconfig-paths` resolves all `@/` path aliases so no manual path rewriting is needed in test imports
**Plans**: 1 plan

Plans:
- [ ] 12-01-PLAN.md â€” Install vite-tsconfig-paths + vitest-mock-extended, update vitest.config.ts, create vitest.setup.ts and tests/types/matchers.d.ts

### Phase 13: Unit Tests â€” Service Layer
**Goal**: All service-layer unit tests pass green â€” VoucherEngine, GSTCalculator, ReportEngine, PayrollEngine, MatchingEngine, InsightsService, and supporting engines are covered with edge cases and statutory rules
**Depends on**: Phase 12
**Requirements**: UNIT-02, UNIT-03, UNIT-04, UNIT-05, UNIT-06
**Success Criteria** (what must be TRUE):
  1. All 14 existing unit test files pass green with no skipped tests
  2. MatchingEngine test suite covers exact match, fuzzy match (Â±â‚¹1 / Â±3 days), no-match, duplicate prevention, and CSV parsing for SBI/HDFC/ICICI bank formats â€” all green
  3. PayrollEngine tests verify PF ceiling (â‚¹15,000 basic), ESI gross threshold (â‚¹21,000), ESI rate transitions, and Maharashtra Professional Tax slabs â€” all statutory rules green
  4. GSTCalculator tests verify CGST+UTGST (Puducherry, state code 34), reverse charge passthrough, and zero-rated supply â€” all three edge cases green
  5. VoucherEngine tests prove that unbalanced entries, zero-amount lines, and concurrent sequence-number calls are all rejected correctly
**Plans**: 4 plans\n\nPlans:\n- [ ] 22-01-PLAN.md — safeStorage IPC handlers + net:isOnline + loadAiKeysIntoEnv() in electron/main.ts\n- [ ] 22-02-PLAN.md — electron-builder.yml artifactName + uninstallDisplayName; package.json build:installer with tsc step\n- [ ] 22-03-PLAN.md — /api/v1/ai-config route + Settings → AI Configuration page + useOnlineStatus hook\n- [ ] 22-04-PLAN.md — SmartInsightsWidget online gate using useOnlineStatus\n
### Phase 14: Integration Tests
**Goal**: Every API route group has integration tests that verify authentication enforcement, multi-tenant isolation, request shape validation, and correct response structure â€” tested with NTARH against real request/response cycles
**Depends on**: Phase 13
**Requirements**: INTG-01, INTG-02, INTG-03, INTG-04, INTG-05, INTG-06, INTG-07, INTG-08
**Success Criteria** (what must be TRUE):
  1. Every API route group returns 401 on unauthenticated requests â€” confirmed by integration tests
  2. Voucher routes enforce double-entry: `POST /api/v1/vouchers` returns 400 on unbalanced DR/CR and 201 with audit log entry on valid input; cross-company fetch returns 404
  3. GST routes (`/gstr1`, `/gstr3b`, `/gstr3b/export`) return only POSTED vouchers â€” DRAFT and CANCELLED entries are absent from response
  4. Reports routes (`/balance-sheet`, `/trial-balance`, `/profit-loss`, `/daybook`, `/outstanding`) return correct response shape; Trial Balance response satisfies the DR=CR invariant
  5. Masters routes (ledgers, stock items, parties) reject bad Zod input with 400 and enforce `companyId` isolation so cross-company fetches return empty or 404
  6. Banking, payroll, and AI routes all have 401 guard coverage and happy-path response shape verified
**Plans**: 4 plans\n\nPlans:\n- [ ] 22-01-PLAN.md — safeStorage IPC handlers + net:isOnline + loadAiKeysIntoEnv() in electron/main.ts\n- [ ] 22-02-PLAN.md — electron-builder.yml artifactName + uninstallDisplayName; package.json build:installer with tsc step\n- [ ] 22-03-PLAN.md — /api/v1/ai-config route + Settings → AI Configuration page + useOnlineStatus hook\n- [ ] 22-04-PLAN.md — SmartInsightsWidget online gate using useOnlineStatus\n
### Phase 15: E2E Tests
**Goal**: All critical user workflows pass end-to-end in Playwright against a seeded test database â€” from login through the golden path, RBAC enforcement, and mode persistence
**Depends on**: Phase 14
**Requirements**: E2E-01, E2E-02, E2E-03, E2E-04, E2E-05, E2E-06, E2E-07, E2E-08
**Success Criteria** (what must be TRUE):
  1. `loggedInPage` Playwright fixture seeds a test user, logs in, and returns an authenticated page context â€” reused by all E2E specs without duplication
  2. Golden path spec passes: Sales Invoice created â†’ GSTR-1 shows the entry â†’ PDF downloads successfully â†’ Credit Note reduces the Outstanding balance
  3. RBAC enforcement spec passes: Viewer-role user cannot create a voucher (POST returns 403) and is redirected away from the Settings page
  4. Bank Reconciliation E2E passes: CSV import â†’ statement visible â†’ voucher matched â†’ closing balance updated on screen
  5. Dashboard health spec passes: page loads without JavaScript errors, both Business View and Accountant View KPI cards render, AI insights widget shows 3 bullets
  6. Simple Mode / Advanced Mode toggle persists after page refresh â€” verified by E2E spec
**UI hint**: yes
**Plans**: 4 plans\n\nPlans:\n- [ ] 22-01-PLAN.md — safeStorage IPC handlers + net:isOnline + loadAiKeysIntoEnv() in electron/main.ts\n- [ ] 22-02-PLAN.md — electron-builder.yml artifactName + uninstallDisplayName; package.json build:installer with tsc step\n- [ ] 22-03-PLAN.md — /api/v1/ai-config route + Settings → AI Configuration page + useOnlineStatus hook\n- [ ] 22-04-PLAN.md — SmartInsightsWidget online gate using useOnlineStatus\n
### Phase 16: Vercel Production Deploy
**Goal**: PremGiri Books is live on Vercel BOM1 â€” all environment variables set, Inngest connected, `prisma migrate deploy` runs in the build pipeline, and a production smoke test confirms end-to-end data flow
**Depends on**: Phase 15
**Requirements**: DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04, DEPLOY-05, DEPLOY-06
**Success Criteria** (what must be TRUE):
  1. `vercel.json` targets the `bom1` region, sets 60-second function timeout for API routes, and adds immutable Cache-Control headers for `/_next/static/`
  2. `prisma migrate deploy` runs without errors in the Vercel build pipeline â€” schema uses `DATABASE_URL` (pooled) and `DIRECT_URL` (direct Neon) correctly
  3. All 16 required environment variables are set in Vercel's production environment and the app starts without missing-config errors
  4. Inngest dashboard shows the app as "Connected" after first deploy â€” signing key correct, deployment protection bypass active for `/api/inngest`
  5. Production smoke test passes: new company registered â†’ Sales Invoice created â†’ GSTR-1 loads the entry â†’ PostHog receives `voucher_created` â†’ Inngest shows completed embedding job
  6. `docs/DEPLOY.md` exists and contains the complete environment variable reference, Neon setup steps, Inngest registration steps, and first-deploy verification checklist
**Plans**: 4 plans\n\nPlans:\n- [ ] 22-01-PLAN.md — safeStorage IPC handlers + net:isOnline + loadAiKeysIntoEnv() in electron/main.ts\n- [ ] 22-02-PLAN.md — electron-builder.yml artifactName + uninstallDisplayName; package.json build:installer with tsc step\n- [ ] 22-03-PLAN.md — /api/v1/ai-config route + Settings → AI Configuration page + useOnlineStatus hook\n- [ ] 22-04-PLAN.md — SmartInsightsWidget online gate using useOnlineStatus\n
---

### Phase 17: Electron Shell + SQLite Migration
**Goal**: The Next.js app runs inside an Electron window on Windows, backed by a local SQLite database at `%APPDATA%\PremGiriBooks\data.db` â€” no internet or cloud database required to start the application
**Depends on**: Phase 16 (v1.1 complete)
**Requirements**: ELEC-01, ELEC-02, ELEC-03, DB-01, DB-02, DB-03, DB-04
**Success Criteria** (what must be TRUE):
  1. `pnpm dev` launches the Next.js app inside an Electron window â€” the browser never opens; the app is entirely desktop-hosted
  2. `data.db` is created at `%APPDATA%\PremGiriBooks\data.db` on first launch â€” no user DB configuration step required
  3. `prisma migrate dev` runs against the SQLite provider without errors and all 16 tables are created in `data.db`
  4. Financial `Decimal` fields round-trip correctly through SQLite â€” a value written as `12345.67` is read back as `12345.67` with no floating-point drift
  5. Voucher sequence increment works under SQLite exclusive transaction â€” no `SELECT FOR UPDATE` syntax error occurs
**Plans**: 4 plans\n\nPlans:\n- [ ] 22-01-PLAN.md — safeStorage IPC handlers + net:isOnline + loadAiKeysIntoEnv() in electron/main.ts\n- [ ] 22-02-PLAN.md — electron-builder.yml artifactName + uninstallDisplayName; package.json build:installer with tsc step\n- [ ] 22-03-PLAN.md — /api/v1/ai-config route + Settings → AI Configuration page + useOnlineStatus hook\n- [ ] 22-04-PLAN.md — SmartInsightsWidget online gate using useOnlineStatus\n
### Phase 18: Local Authentication
**Goal**: Users can log in with email and password using a bcrypt+JWT flow that runs entirely on the local machine â€” NextAuth and all cloud session dependencies are completely removed
**Depends on**: Phase 17
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04
**Success Criteria** (what must be TRUE):
  1. A user can log in with correct email + password â€” an httpOnly cookie containing a signed JWT is issued and the user lands on the Dashboard
  2. Submitting incorrect credentials returns a clear error message â€” no JWT cookie is set
  3. Every protected API route called without a valid JWT returns 401 â€” confirmed by hitting any `/api/v1/` route with no cookie
  4. The codebase contains no import of `next-auth`, `getServerSession`, or `authOptions` â€” grep returns zero matches
  5. The JWT payload contains `userId`, `companyId`, and `role` â€” multi-tenant `companyId` isolation is preserved with the new auth layer
**Plans**: 3 plans

Plans:
- [ ] 18-01-PLAN.md â€” JWT infrastructure: lib/jwt.ts, lib/session.ts, login/logout routes, middleware.ts rewrite, authDb.ts SQLite fix
- [ ] 18-02-PLAN.md â€” Mass migration: replace auth() with getSessionFromRequest in all 85 API routes
- [ ] 18-03-PLAN.md â€” Client cleanup: login page fetch, remove SessionProvider, delete lib/auth.ts, remove next-auth from package.json

### Phase 19: First-Run Company Setup Wizard
**Goal**: A user who opens the app for the first time (empty database) is guided through a setup wizard that creates the company record and admin account â€” after which the setup route is permanently inaccessible
**Depends on**: Phase 18
**Requirements**: SETUP-01, SETUP-02, SETUP-03, SETUP-04, SETUP-05
**Success Criteria** (what must be TRUE):
  1. Opening the app with a blank database (zero companies) redirects to `/setup` before reaching the login screen
  2. The setup wizard form collects company name, GSTIN, PAN, address, state code, financial year start, and a password for the admin account â€” all fields validated before submission
  3. After completing setup, the database contains exactly one company row and one user row with email `admin@premgiribooks.com` and a bcrypt-hashed password
  4. After successful setup, the user is automatically logged in (JWT cookie set) and redirected to the Dashboard without a separate login step
  5. Navigating to `/setup` when a company already exists redirects to `/login` â€” the setup route cannot be accessed again
**UI hint**: yes
**Plans**: 2 plans

Plans:
- [ ] 19-01-PLAN.md ï¿½ Backend: middleware public path + POST /api/v1/setup + GET /api/v1/setup/status
- [ ] 19-02-PLAN.md ï¿½ Frontend: root page redirect + setup page guard + SetupWizard client component

### Phase 20: User Management
**Goal**: The Owner can create, deactivate, and reset passwords for users directly from the Users page â€” no email flow â€” and the Accountant role is blocked from accessing user management
**Depends on**: Phase 19
**Requirements**: USER-01, USER-02, USER-03, USER-04, USER-05
**Success Criteria** (what must be TRUE):
  1. Owner can create a new user by entering name, email, password, and role (Owner or Accountant) â€” the new user can immediately log in with those credentials
  2. A deactivated user cannot log in â€” the login endpoint checks `isActive` in the DB and returns an error if false
  3. Owner can reset another user's password from the Users page â€” the user can then log in with the new password
  4. Navigating to the Users page as an Accountant-role user returns a 403 response and shows an access-denied screen
  5. The Users page is only visible in the sidebar navigation for Owner-role users â€” Accountant users do not see the menu item
**UI hint**: yes
**Plans**: 4 plans\n\nPlans:\n- [ ] 22-01-PLAN.md — safeStorage IPC handlers + net:isOnline + loadAiKeysIntoEnv() in electron/main.ts\n- [ ] 22-02-PLAN.md — electron-builder.yml artifactName + uninstallDisplayName; package.json build:installer with tsc step\n- [ ] 22-03-PLAN.md — /api/v1/ai-config route + Settings → AI Configuration page + useOnlineStatus hook\n- [ ] 22-04-PLAN.md — SmartInsightsWidget online gate using useOnlineStatus\n
### Phase 21: Local File Storage + Cloud Service Removal
**Goal**: All PDF and file output writes to a user-selected local folder, and the application starts and runs completely without any cloud environment variables â€” Inngest, Redis, R2, Resend, and PostHog are fully removed
**Depends on**: Phase 20
**Requirements**: FILE-01, FILE-02, FILE-03, FILE-04, FILE-05, CLOUD-01, CLOUD-02, CLOUD-03, CLOUD-04, CLOUD-05, CLOUD-06
**Success Criteria** (what must be TRUE):
  1. Owner can select a local folder from Settings â†’ Company using a native folder picker â€” the path is saved to the `app_settings` table and survives app restart
  2. Generating a Sales Invoice PDF, PaySlip PDF, or Bank Reconciliation export writes the file to the selected folder â€” the app displays the full saved file path after generation
  3. If no folder has been selected, files write to `%APPDATA%\PremGiriBooks\files\` by default â€” no error or prompt is shown
  4. The application starts with no `INNGEST_*`, `REDIS_*`, `R2_*`, `RESEND_*`, or `POSTHOG_*` environment variables set â€” zero startup errors or missing-config warnings
  5. The codebase contains no import of `inngest`, `@upstash/redis`, `@aws-sdk/client-s3`, `resend`, or `posthog-node` â€” grep returns zero matches for each
**UI hint**: yes
**Plans**: 6 plans

Plans:
- [ ] 21-01-PLAN.md â€” AppSettings schema + migration + lib/localFiles.ts (R2 replacement)
- [ ] 21-02-PLAN.md â€” Inngest removal: PayrollRunner sync function + inngest stub + embeddings no-op
- [ ] 21-03-PLAN.md â€” Redis/Resend/PostHog no-op stubs + PostHogProvider removal
- [ ] 21-04-PLAN.md â€” app-settings API routes + Electron IPC mkdir/getUserDataPath
- [ ] 21-05-PLAN.md â€” Remove cloud packages from package.json + delete Inngest route
- [ ] 21-06-PLAN.md â€” Folder picker UI in Settings Company page

### Phase 22: Optional AI + Windows Installer
**Goal**: AI features (Smart Insights, semantic search) work when the machine is online and degrade gracefully when offline â€” and the app can be packaged as a Windows `.exe` installer that end users can install without developer tooling
**Depends on**: Phase 21
**Requirements**: AI-01, AI-02, AI-03, AI-04, AI-05, ELEC-04
**Success Criteria** (what must be TRUE):
  1. With internet available, the Smart Insights widget loads 3 plain-English insights and semantic search returns relevant results â€” same behavior as v1.0
  2. With internet disconnected, the Smart Insights widget shows a clear degraded message (e.g., "AI insights unavailable offline") and semantic search falls back to text-only results â€” no unhandled errors
  3. Owner can enter and save Voyage AI and Anthropic API keys from Settings â†’ AI Configuration â€” keys are stored in Electron's `safeStorage` encrypted store, not in a `.env` file
  4. Running `pnpm build:electron` produces a `.exe` installer via electron-builder NSIS that installs the app, creates a Start Menu shortcut, and supports uninstall through Windows Add/Remove Programs
  5. Installing the `.exe` on a clean Windows machine with no Node.js or developer tools launches the app successfully and completes the first-run setup wizard
**UI hint**: yes
**Plans**: 4 plans

Plans:
- [x] 22-01-PLAN.md — safeStorage IPC handlers + net:isOnline + loadAiKeysIntoEnv() in electron/main.ts
- [x] 22-02-PLAN.md — electron-builder.yml artifactName + uninstallDisplayName; package.json build:installer with tsc step
- [x] 22-03-PLAN.md — /api/v1/ai-config route + Settings → AI Configuration page + useOnlineStatus hook
- [x] 22-04-PLAN.md — SmartInsightsWidget online gate using useOnlineStatus
---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 0. Infrastructure & Design System | v1.0 | 7/7 | Complete | 2026-05-01 |
| 1. Auth, UX Shell & Masters | v1.0 | 10/10 | Complete | 2026-05-07 |
| 2. Voucher Engine | v1.0 | 12/12 | Complete | 2026-05-07 |
| 3. GST, Invoice PDF & TDS | v1.0 | 8/8 | Complete | 2026-05-08 |
| 4. Inventory & Orders | v1.0 | 10/10 | Complete | 2026-05-09 |
| 5. Financial Reports | v1.0 | 6/6 | Complete | 2026-05-10 |
| 6. Payroll | v1.0 | 6/6 | Complete | 2026-05-14 |
| 7. Banking | v1.0 | 6/6 | Complete | 2026-05-14 |
| 8. e-Compliance | v1.0 | 5/5 | Complete | 2026-05-14 |
| 9. RBAC, Admin & Audit | v1.0 | 6/6 | Complete | 2026-05-15 |
| 10. DX & Deploy | v1.0 | 5/5 | Complete | 2026-05-15 |
| 11. AI Foundation | v1.0 | 7/7 | Complete | 2026-05-16 |
| 12. Test Infrastructure | v1.1 | 0/1 | Planned | - |
| 13. Unit Tests â€” Service Layer | v1.1 | 0/TBD | Not started | - |
| 14. Integration Tests | v1.1 | 0/TBD | Not started | - |
| 15. E2E Tests | v1.1 | 0/TBD | Not started | - |
| 16. Vercel Production Deploy | v1.1 | 0/TBD | Not started | - |
| 17. Electron Shell + SQLite Migration | v1.2 | 0/TBD | Not started | - |
| 18. Local Authentication | v1.2 | 0/TBD | Not started | - |
| 19. First-Run Company Setup Wizard | v1.2 | 0/TBD | Not started | - |
| 20. User Management | v1.2 | 3/3 | Complete | 2026-05-31 |
| 21. Local File Storage + Cloud Service Removal | v1.2 | 0/TBD | Not started | - |
| 22. Optional AI + Windows Installer | v1.2 | 0/TBD | Not started | - |

---

*Last updated: 2026-05-31 â€” v1.2 phases 17â€“22 added*

