---
phase: 17
slug: electron-shell-sqlite-migration
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-31
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing) + manual Electron smoke test |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `pnpm prisma validate` |
| **Full suite command** | `pnpm prisma migrate dev --name init-sqlite && pnpm prisma db execute --stdin` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm prisma validate`
- **After every plan wave:** Run `pnpm prisma generate && pnpm prisma migrate dev --name init-sqlite`
- **Before `/gsd:verify-work`:** Full suite must be green — Electron window opens, SQLite DB has all tables
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 17-01-01 | 01 | 1 | ELEC-01, ELEC-02, ELEC-03 | — | N/A | manual | `pnpm dev` opens Electron window | ❌ W0 | ⬜ pending |
| 17-01-02 | 01 | 1 | ELEC-01, ELEC-03 | — | N/A | manual | electron/main.ts sets DATABASE_URL before Prisma | ❌ W0 | ⬜ pending |
| 17-02-01 | 02 | 1 | DB-01, DB-03 | — | No @db.* annotations remain | automated | `pnpm prisma validate` exits 0 | ❌ W0 | ⬜ pending |
| 17-02-02 | 02 | 1 | DB-01, DB-03 | — | No PrismaNeon/PrismaPg imports | automated | `grep -r "PrismaNeon\|PrismaPg" lib/ --include="*.ts"` exits 1 | ❌ W0 | ⬜ pending |
| 17-03-01 | 03 | 2 | DB-02 | — | No FOR UPDATE in VoucherEngine | automated | `grep -r "FOR UPDATE" lib/services/ --include="*.ts"` exits 1 | ❌ W0 | ⬜ pending |
| 17-03-02 | 03 | 2 | DB-04, ELEC-02 | — | All tables in SQLite DB | automated | `node -e "const D=require('better-sqlite3')('./dev.db');const t=D.prepare('SELECT name FROM sqlite_master WHERE type=\\'table\\'').all();process.exit(t.length>=14?0:1)"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `better-sqlite3` installed as dev dependency (needed for table-count assertion in 17-03-02)
- [ ] `nextron` installed as dependency (needed for all plan 17-01 tasks)

*All other verifications use `pnpm prisma validate`, grep, and manual Electron window check — no additional test framework setup required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Electron window opens on `pnpm dev` | ELEC-01 | Cannot automate window launch in CI | Run `pnpm dev` → confirm Electron window appears (not browser) |
| `%APPDATA%\PremGiriBooks\data.db` created | ELEC-03 | Requires Windows APPDATA path | Launch app → open Explorer → navigate to `%APPDATA%\PremGiriBooks\` → confirm `data.db` exists |
| `pnpm dev` stays online for 30s without crash | ELEC-02 | Process stability check | Run `pnpm dev` → wait 30 seconds → confirm no unhandled exception in Electron console |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (better-sqlite3, nextron)
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

