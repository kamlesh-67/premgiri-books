#!/usr/bin/env tsx
/**
 * Backfill script: recompute roundOff on existing vouchers from their
 * voucherItems + totalAmount, for vouchers created before VoucherEngine.createVoucher
 * and updateVoucher were fixed to persist this field.
 *
 * roundOff = totalAmount − (sum of item amounts + CGST + SGST + IGST)
 *
 * Run: npx tsx scripts/backfill-voucher-roundoff.ts
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
    if (voucher.voucherItems.length === 0) continue // entry-only vouchers have no round-off

    const itemsTotal = voucher.voucherItems.reduce(
      (sum, item) => sum.plus(item.amount), new Decimal(0)
    )
    const cgstAmount = new Decimal(voucher.cgstAmount.toString())
    const sgstAmount = new Decimal(voucher.sgstAmount.toString())
    const igstAmount = new Decimal(voucher.igstAmount.toString())
    const totalAmount = new Decimal(voucher.totalAmount.toString())

    const roundOff = totalAmount.minus(itemsTotal).minus(cgstAmount).minus(sgstAmount).minus(igstAmount)

    if (new Decimal(voucher.roundOff.toString()).equals(roundOff)) continue

    await prisma.voucher.update({
      where: { id: voucher.id, companyId: voucher.companyId },
      data: { roundOff },
    })
    updatedCount++
    console.log(`[backfill-voucher-roundoff] Updated ${voucher.voucherNo}: RoundOff=${roundOff}`)
  }

  console.log(`[backfill-voucher-roundoff] Done. ${updatedCount}/${vouchers.length} vouchers updated.`)
}

main()
  .catch((err: unknown) => {
    console.error('[backfill-voucher-roundoff] FATAL:', err)
    process.exit(1)
  })
  .finally(() => {
    void prisma.$disconnect()
  })
