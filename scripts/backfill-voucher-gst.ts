#!/usr/bin/env tsx
/**
 * Backfill script: recompute cgstAmount/sgstAmount/igstAmount on existing vouchers
 * from their voucherItems, for vouchers created before VoucherEngine.createVoucher
 * and updateVoucher were fixed to persist these fields.
 *
 * Run: npx tsx scripts/backfill-voucher-gst.ts
 */
import { prisma } from '@/lib/prisma'
import { authDb } from '@/lib/authDb'
import { Decimal } from 'decimal.js'

async function main(): Promise<void> {
  // authDb is unguarded (no tenant scope enforcement) — required here since this
  // maintenance script runs across all companies, outside any request/session context.
  const vouchers = await authDb.voucher.findMany({
    include: { voucherItems: true },
  })

  let updatedCount = 0

  for (const voucher of vouchers) {
    const cgstAmount = voucher.voucherItems.reduce(
      (sum, item) => sum.plus(item.cgstAmt ?? new Decimal(0)), new Decimal(0)
    )
    const sgstAmount = voucher.voucherItems.reduce(
      (sum, item) => sum.plus(item.sgstAmt ?? new Decimal(0)), new Decimal(0)
    )
    const igstAmount = voucher.voucherItems.reduce(
      (sum, item) => sum.plus(item.igstAmt ?? new Decimal(0)), new Decimal(0)
    )

    const unchanged =
      new Decimal(voucher.cgstAmount.toString()).equals(cgstAmount) &&
      new Decimal(voucher.sgstAmount.toString()).equals(sgstAmount) &&
      new Decimal(voucher.igstAmount.toString()).equals(igstAmount)

    if (unchanged) continue

    await prisma.voucher.update({
      where: { id: voucher.id, companyId: voucher.companyId },
      data: { cgstAmount, sgstAmount, igstAmount },
    })
    updatedCount++
    console.log(`[backfill-voucher-gst] Updated ${voucher.voucherNo}: CGST=${cgstAmount} SGST=${sgstAmount} IGST=${igstAmount}`)
  }

  console.log(`[backfill-voucher-gst] Done. ${updatedCount}/${vouchers.length} vouchers updated.`)
}

main()
  .catch((err: unknown) => {
    console.error('[backfill-voucher-gst] FATAL:', err)
    process.exit(1)
  })
  .finally(() => {
    void prisma.$disconnect()
  })
