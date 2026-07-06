#!/usr/bin/env tsx
/**
 * Read-only verification: confirms SUM(DR) === SUM(CR) === totalAmount for every
 * voucher, and that BillRef totals match voucher.totalAmount. Run after any
 * rounding backfill/fix to confirm no unbalanced vouchers remain.
 */
import { authDb } from '@/lib/authDb'
import { Decimal } from 'decimal.js'

async function main(): Promise<void> {
  const vouchers = await authDb.voucher.findMany({
    include: { voucherEntries: true, billRefs: true },
  })

  let badCount = 0

  for (const voucher of vouchers) {
    const dr = voucher.voucherEntries
      .filter((e) => e.drCr === 'DR')
      .reduce((s, e) => s.plus(e.amount.toString()), new Decimal(0))
    const cr = voucher.voucherEntries
      .filter((e) => e.drCr === 'CR')
      .reduce((s, e) => s.plus(e.amount.toString()), new Decimal(0))
    const totalAmount = new Decimal(voucher.totalAmount.toString())

    if (!dr.equals(cr)) {
      badCount++
      console.log(`[UNBALANCED] ${voucher.voucherNo}: DR=${dr} CR=${cr}`)
    }
    if (!dr.equals(totalAmount)) {
      badCount++
      console.log(`[MISMATCH] ${voucher.voucherNo}: DR=${dr} totalAmount=${totalAmount}`)
    }
    for (const br of voucher.billRefs) {
      const brTotal = new Decimal(br.totalAmount.toString())
      if (!brTotal.equals(totalAmount)) {
        badCount++
        console.log(`[BILLREF MISMATCH] ${voucher.voucherNo}: billRef.totalAmount=${brTotal} voucher.totalAmount=${totalAmount}`)
      }
    }
  }

  console.log(`\n${badCount === 0 ? 'OK — all vouchers balanced.' : `${badCount} issue(s) found.`}`)
}

main()
  .catch((err: unknown) => {
    console.error('FATAL:', err)
    process.exit(1)
  })
  .finally(() => {
    void authDb.$disconnect()
  })
