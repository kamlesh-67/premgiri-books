# PremGiri Books — Requirements

## Milestone v1.2: Electron Desktop App

**Goal:** Convert PremGiri Books from a cloud SaaS to a fully offline Windows desktop application with optional AI when internet is available.

---

## Active Requirements

### ELEC — Electron Shell & Packaging

- [ ] **ELEC-01**: User can launch PremGiri Books as a native Windows desktop app (installed via .exe installer)
- [ ] **ELEC-02**: App runs fully offline — no internet required for core accounting functions
- [ ] **ELEC-03**: App data (SQLite DB) is stored at `%APPDATA%\PremGiriBooks\data.db` — no user DB setup required
- [ ] **ELEC-04**: Windows installer (NSIS via electron-builder) installs app, creates Start Menu shortcut, supports uninstall

### DB — SQLite Migration

- [ ] **DB-01**: Prisma provider changed from `postgresql` to `sqlite` — all existing models work with SQLite
- [ ] **DB-02**: `SELECT FOR UPDATE` (voucher sequence) replaced with SQLite-safe exclusive transaction
- [ ] **DB-03**: Financial `Decimal` fields handled correctly in SQLite — stored as TEXT, validated to 2dp in app layer via Prisma Decimal adapter
- [ ] **DB-04**: All 16 DB tables migrate successfully to SQLite schema with `prisma migrate dev`

### AUTH — Local Authentication

- [ ] **AUTH-01**: User can log in with email + password — bcrypt verification, JWT issued in httpOnly cookie
- [ ] **AUTH-02**: Every protected API route validates JWT via `verifyJWT(request)` helper — returns 401 if invalid or expired
- [ ] **AUTH-03**: NextAuth dependency is removed — no `getServerSession`, no `authOptions`, no cloud session store
- [ ] **AUTH-04**: JWT contains `userId`, `companyId`, `role` — multi-tenant isolation preserved

### SETUP — First-Run Company Wizard

- [ ] **SETUP-01**: On first launch (zero companies in DB), app redirects to `/setup` wizard instead of login
- [ ] **SETUP-02**: Setup wizard collects: company name, GSTIN, PAN, address, state code, financial year start
- [ ] **SETUP-03**: Admin account created during setup with email `admin@premgiribooks.com` and a password the user sets on screen
- [ ] **SETUP-04**: After successful setup, user is automatically logged in and redirected to Dashboard
- [ ] **SETUP-05**: Setup route is inaccessible once a company exists — redirects to login

### USER — User Management

- [ ] **USER-01**: Owner can create new users by entering name, email, password, and role — no email invite required
- [ ] **USER-02**: Two roles: **Owner** (full access including user management) and **Accountant** (all accounting features, no user/settings management)
- [x] **USER-03**: Owner can deactivate a user — deactivated users are blocked at login via `isActive` DB check
- [x] **USER-04**: Owner can reset another user's password directly from the Users page (no email flow)
- [ ] **USER-05**: Users page accessible to Owner role only — Accountant sees 403

### FILE — Local File Storage

- [ ] **FILE-01**: Owner can select a local folder path for all file output (PDFs, PaySlips, Excel exports) via Settings → Company
- [ ] **FILE-02**: Selected folder path persisted in local `app_settings` table
- [ ] **FILE-03**: All PDF generation (Sales Invoice, PaySlip, Bank Reconciliation) writes to selected local folder
- [ ] **FILE-04**: App shows the saved file path after each PDF so user can open it directly
- [ ] **FILE-05**: Default folder is `%APPDATA%\PremGiriBooks\files\` if none selected

### CLOUD — Remove Cloud Services

- [ ] **CLOUD-01**: Inngest removed — payroll job runs in Electron main process; GST/overdue cron reminders via `setInterval`
- [ ] **CLOUD-02**: Redis removed — session validity via JWT expiry; deactivated users blocked at login via DB `isActive`
- [ ] **CLOUD-03**: R2 removed — all file writes go to local filesystem (FILE requirements)
- [ ] **CLOUD-04**: Email (Resend) removed — no email flow; all notifications are in-app only
- [ ] **CLOUD-05**: PostHog removed — no analytics or telemetry
- [ ] **CLOUD-06**: App starts without errors when cloud env vars are absent

### AI — Optional AI (Internet-Conditional)

- [ ] **AI-01**: Before every Voyage AI or Anthropic API call, app performs an online check
- [ ] **AI-02**: When offline: Smart Insights widget shows degraded message; semantic search falls back to text-only
- [ ] **AI-03**: When online: Smart Insights and hybrid RRF semantic search work as in v1.0
- [ ] **AI-04**: AI API keys stored in Electron's encrypted store (`safeStorage`) — not in bundled env file
- [ ] **AI-05**: Settings → AI Configuration section allows Owner to enter and save API keys

---

## Future Requirements (deferred)

- Auto-update (electron-updater) — manual reinstall for now
- Cloud backup of local SQLite DB
- Email notifications
- Multi-currency
- Vitest/Playwright test suite — deferred until Electron migration stabilises

---

## Out of Scope (v1.2)

| Item | Reason |
|------|--------|
| Vercel deploy | Desktop-only this milestone |
| Test suite | Deferred — stabilise migration first |
| OAuth providers | Local auth only |
| Redis session blocklist | JWT expiry + DB isActive sufficient |
| pgvector in DB | SQLite has no vector type; AI calls are remote-only |

---

## Traceability

| Requirement | Phase |
|-------------|-------|
| ELEC-01..04, DB-01..04 | Phase 17 |
| AUTH-01..04 | Phase 18 |
| SETUP-01..05 | Phase 19 |
| USER-01..05 | Phase 20 |
| FILE-01..05, CLOUD-01..06 | Phase 21 |
| AI-01..05 | Phase 22 |

---

*Last updated: 2026-05-31 — v1.2 requirements defined*
