/**
 * Minimal seed — schema-only placeholder.
 * Account groups require a companyId which is created by the first-run wizard (Phase 19).
 * This seed is a no-op; real seeding runs post first-run wizard.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const ACCOUNT_GROUPS = [
  { name: 'Capital Account',       nature: 'LIABILITY', affectsGP: false },
  { name: 'Current Assets',        nature: 'ASSET',     affectsGP: false },
  { name: 'Current Liabilities',   nature: 'LIABILITY', affectsGP: false },
  { name: 'Sales Accounts',        nature: 'INCOME',    affectsGP: true  },
  { name: 'Purchase Accounts',     nature: 'EXPENSE',   affectsGP: true  },
  { name: 'Direct Expenses',       nature: 'EXPENSE',   affectsGP: true  },
  { name: 'Indirect Expenses',     nature: 'EXPENSE',   affectsGP: false },
  { name: 'Indirect Income',       nature: 'INCOME',    affectsGP: false },
  { name: 'Fixed Assets',          nature: 'ASSET',     affectsGP: false },
  { name: 'Bank Accounts',         nature: 'ASSET',     affectsGP: false },
  { name: 'Cash-in-Hand',          nature: 'ASSET',     affectsGP: false },
  { name: 'Sundry Debtors',        nature: 'ASSET',     affectsGP: false },
  { name: 'Sundry Creditors',      nature: 'LIABILITY', affectsGP: false },
  { name: 'Duties & Taxes',        nature: 'LIABILITY', affectsGP: false },
]

async function main() {
  console.log('Seed: schema-only run. Company-level seed runs post first-run wizard (Phase 19).')
}

main().catch(console.error).finally(() => prisma.$disconnect())
