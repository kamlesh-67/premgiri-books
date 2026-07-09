#!/usr/bin/env tsx
/**
 * Final corrective script: fixes vouchers left unbalanced by the two earlier
 * rounding backfill attempts. Recomputes roundOff from voucherItems, then adjusts
 * BOTH the party ledger entry AND the largest opposite-side entry (the Sales/
 * Purchase account line) by roundOff — mirroring VoucherEngine.applyRoundOffToPartyEntry.
 *
 * Run: npx tsx scripts/fix-voucher-rounding-both-sides.ts
 */
import { authDb } from '@/lib/authDb'
import { Decimal } from 'decimal.js'

async function main(): Promise<void> {
  const vouchers = await authDb.voucher.findMany({
    where: { partyLedgerId: { not: null } },
    include: { voucherItems: true, voucherEntries: true, billRefs: true },
  })

  let fixedCount = 0

  for (const voucher of vouchers) {
    if (voucher.voucherItems.length === 0) continue

    const cgstAmount = voucher.voucherItems.reduce((s, i) => s.plus(i.cgstAmt ?? new Decimal(0)), new Decimal(0))
    const sgstAmount = voucher.voucherItems.reduce((s, i) => s.plus(i.sgstAmt ?? new Decimal(0)), new Decimal(0))
    const igstAmount = voucher.voucherItems.reduce((s, i) => s.plus(i.igstAmt ?? new Decimal(0)), new Decimal(0))
    const itemsTotal = voucher.voucherItems.reduce((s, i) => s.plus(i.amount), new Decimal(0))

    const rawTotal = itemsTotal.plus(cgstAmount).plus(sgstAmount).plus(igstAmount)
    const roundedTotal = rawTotal.toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    const roundOff = roundedTotal.minus(rawTotal)

    const partyEntry = voucher.voucherEntries.find((e) => e.ledgerId === voucher.partyLedgerId)
    if (!partyEntry) {
      console.warn(`[SKIP] ${voucher.voucherNo} — no party ledger entry found`)
      continue
    }

    // Largest entry on the opposite side from the party — the Sales/Purchase account line.
    const oppositeCandidates = voucher.voucherEntries.filter(
      (e) => e.id !== partyEntry.id && e.drCr !== partyEntry.drCr
    )
    const oppositeEntry = oppositeCandidates.reduce((max, e) =>
      new Decimal(e.amount.toString()).gt(new Decimal(max.amount.toString())) ? e : max
    , oppositeCandidates[0])

    if (!oppositeEntry) {
      console.warn(`[SKIP] ${voucher.voucherNo} — no opposite-side entry found`)
      continue
    }

    // Desired final amounts: party and opposite-side-largest each carry the raw
    // amount they'd have had, plus roundOff. Recompute both from their OWN entry's
    // "other same-side entries" so this script is idempotent regardless of prior bugs.
    const partySideOthers = voucher.voucherEntries
      .filter((e) => e.drCr === partyEntry.drCr && e.id !== partyEntry.id)
      .reduce((s, e) => s.plus(e.amount.toString()), new Decimal(0))
    const correctPartyAmount = roundedTotal.minus(partySideOthers)

    const oppositeSideOthers = voucher.voucherEntries
      .filter((e) => e.drCr === oppositeEntry.drCr && e.id !== oppositeEntry.id)
      .reduce((s, e) => s.plus(e.amount.toString()), new Decimal(0))
    const correctOppositeAmount = roundedTotal.minus(oppositeSideOthers)

    const currentPartyAmount = new Decimal(partyEntry.amount.toString())
    const currentOppositeAmount = new Decimal(oppositeEntry.amount.toString())

    const partyChanged = !currentPartyAmount.equals(correctPartyAmount)
    const oppositeChanged = !currentOppositeAmount.equals(correctOppositeAmount)

    if (!partyChanged && !oppositeChanged) continue

    await authDb.$transaction(async (tx) => {
      if (partyChanged) {
        await tx.voucherEntry.update({ where: { id: partyEntry.id }, data: { amount: correctPartyAmount } })
      }
      if (oppositeChanged) {
        await tx.voucherEntry.update({ where: { id: oppositeEntry.id }, data: { amount: correctOppositeAmount } })
      }
      await tx.voucher.update({
        where: { id: voucher.id },
        data: { totalAmount: roundedTotal, cgstAmount, sgstAmount, igstAmount, roundOff },
      })
      for (const br of voucher.billRefs) {
        // Preserve partial-payment progress: shift outstandingAmount by the same
        // delta as totalAmount, rather than resetting it to the new total outright
        // (which would silently undo any prior settlement on this bill).
        const oldTotal = new Decimal(br.totalAmount.toString())
        const oldOutstanding = new Decimal(br.outstandingAmount.toString())
        const delta = roundedTotal.minus(oldTotal)
        const newOutstanding = oldOutstanding.plus(delta)
        await tx.billRef.update({
          where: { id: br.id },
          data: { totalAmount: roundedTotal, outstandingAmount: newOutstanding },
        })
      }
    })

    fixedCount++
    console.log(
      `[fix-voucher-rounding-both-sides] Fixed ${voucher.voucherNo}: party ${currentPartyAmount}→${correctPartyAmount}, opposite ${currentOppositeAmount}→${correctOppositeAmount}, total→${roundedTotal}`
    )
  }

  console.log(`[fix-voucher-rounding-both-sides] Done. ${fixedCount}/${vouchers.length} vouchers fixed.`)
}

main()
  .catch((err: unknown) => {
    console.error('[fix-voucher-rounding-both-sides] FATAL:', err)
    process.exit(1)
  })
  .finally(() => {
    void authDb.$disconnect()
  })
