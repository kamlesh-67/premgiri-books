#!/usr/bin/env tsx
/**
 * One-off data-fix: sets company name, GSTIN, address (with phone/email
 * appended as extra lines, since Company has no dedicated phone/email columns
 * yet), and the default invoice bank account for the single company record
 * in this database.
 *
 * The bank ledger's branch has no dedicated column either, so it's folded
 * into the ledger name (e.g. "Punjab National Bank - GVM Sardarshahar"),
 * same pattern as the phone/email-into-address workaround above.
 *
 * Run: npx tsx scripts/configure-company-details.ts
 */
import { authDb } from '../lib/authDb'

const COMPANY_NAME = 'Baba Premgiri Paints'
const GSTIN = '08CSWPP3893C1Z0'
const ADDRESS = [
  'Motor Market, Ratanghar Road, Sardarshahar, Churu, Rajasthan 331403',
  'Mo. 9414742566, 9660260755',
  'Email: kamleshprajapat858@gmail.com',
].join('\n')

const BANK_LEDGER_NAME = 'Punjab National Bank - GVM Sardarshahar'
const BANK_NAME = 'Punjab National Bank'
const BANK_ACCOUNT = '1178109300000217'
const BANK_IFSC = 'PUNB0117810'
const BANK_ACCOUNTS_GROUP_NAME = 'Bank Accounts'

async function main(): Promise<void> {
  const companies = await authDb.company.findMany({ select: { id: true, name: true } })

  if (companies.length === 0) {
    throw new Error('No company record found — nothing to update.')
  }
  if (companies.length > 1) {
    throw new Error(
      `Expected exactly one company but found ${companies.length}. ` +
      'Update the script to target a specific companyId before running.'
    )
  }

  const companyId = companies[0].id

  const bankAccountsGroup = await authDb.accountGroup.findFirst({
    where: { companyId, name: BANK_ACCOUNTS_GROUP_NAME },
    select: { id: true },
  })
  if (!bankAccountsGroup) {
    throw new Error(
      `AccountGroup "${BANK_ACCOUNTS_GROUP_NAME}" not found for this company — ` +
      'expected it to exist from the default chart of accounts seed.'
    )
  }

  const bankLedger = await authDb.ledger.upsert({
    where: { companyId_name: { companyId, name: BANK_LEDGER_NAME } },
    create: {
      companyId,
      name: BANK_LEDGER_NAME,
      groupId: bankAccountsGroup.id,
      bankName: BANK_NAME,
      bankAccount: BANK_ACCOUNT,
      ifsc: BANK_IFSC,
    },
    update: {
      bankName: BANK_NAME,
      bankAccount: BANK_ACCOUNT,
      ifsc: BANK_IFSC,
    },
    select: { id: true, name: true, bankName: true, bankAccount: true, ifsc: true },
  })

  const updated = await authDb.company.update({
    where: { id: companyId },
    data: {
      name: COMPANY_NAME,
      gstin: GSTIN,
      address: ADDRESS,
      defaultBankLedgerId: bankLedger.id,
    },
    select: { id: true, name: true, gstin: true, stateCode: true, address: true, defaultBankLedgerId: true },
  })

  console.log('[configure-company-details] Bank ledger:')
  console.log(JSON.stringify(bankLedger, null, 2))
  console.log('[configure-company-details] Updated company:')
  console.log(JSON.stringify(updated, null, 2))
}

main()
  .catch((err: unknown) => {
    console.error('[configure-company-details] FATAL:', err)
    process.exit(1)
  })
  .finally(() => {
    void authDb.$disconnect()
  })
