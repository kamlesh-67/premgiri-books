/**
 * OrderService.ts
 *
 * Application logic for Purchase Orders and Sales Orders.
 * Business rules enforced:
 *  - companyId always from session.user.companyId (multi-tenant, T-04-06-02)
 *  - orderNo generated server-side — never accepted from client (T-04-06-04)
 *  - approveOrder requires Admin or Owner role fetched from DB (T-04-06-03, D-03)
 *  - Every status change writes auditLog inside the same $transaction (T-04-06-05)
 *  - Cross-tenant guard: order.findFirst with companyId before any update (T-04-06-06)
 *  - Soft delete only: status → CANCELLED, never hard-delete (CLAUDE.md rule 6)
 */

import { prisma } from '@/lib/prisma'
import { Decimal } from 'decimal.js'
import { Prisma } from '@prisma/client'
import type { CreateOrderInput, ConvertOrderInput } from '@/lib/schemas/orders'
import { getNextVoucherNo, validateBalance } from '@/lib/services/VoucherEngine'
import { getFY } from '@/lib/utils/fy'

// ─── Error classes (mirror VoucherEngine pattern) ─────────────────────────────

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ForbiddenError'
  }
}

// ─── Session shape required by OrderService ───────────────────────────────────

export interface OrderSession {
  user: {
    companyId: string
    id: string
    roleId: string | null
    name?: string
    email?: string
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Generate the next order number inside an open $transaction.
 * Format: PO-YYYY-YY-NNNN (Purchase) or SO-YYYY-YY-NNNN (Sales)
 * Uses upsert + increment for atomic sequence generation.
 */
async function getNextOrderNo(
  orderType: 'PURCHASE_ORDER' | 'SALES_ORDER',
  companyId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
): Promise<string> {
  // Indian FY: April 1 – March 31
  const now = new Date()
  const fyYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  const financialYear = `${fyYear}-${String(fyYear + 1).slice(-2)}` // e.g. "2024-25"

  // Atomic upsert-and-increment (safe within $transaction)
  const seq = await tx.orderSequence.upsert({
    where: {
      companyId_orderType_financialYear: { companyId, orderType, financialYear },
    },
    update: { lastSequence: { increment: 1 } },
    create: { companyId, orderType, financialYear, lastSequence: 1 },
  })

  const prefix = orderType === 'PURCHASE_ORDER' ? 'PO' : 'SO'
  const paddedSeq = String(seq.lastSequence).padStart(4, '0')
  return `${prefix}-${financialYear}-${paddedSeq}` // e.g. PO-2024-25-0001
}

// ─── OrderService ─────────────────────────────────────────────────────────────

export const OrderService = {
  /**
   * Create a new Purchase Order or Sales Order.
   * Generates sequential order number, creates Order + OrderItems, writes audit log.
   * All operations inside a single $transaction.
   */
  async createOrder(input: CreateOrderInput, session: OrderSession) {
    const companyId = session.user.companyId

    return prisma.$transaction(async (tx) => {
      const orderNo = await getNextOrderNo(input.orderType, companyId, tx)

      const totalAmount = input.items.reduce(
        (sum, item) => sum.plus(new Decimal(item.amount)),
        new Decimal(0),
      )

      const order = await tx.order.create({
        data: {
          companyId,
          orderType: input.orderType,
          orderNo,
          date: new Date(input.date),
          partyLedgerId: input.partyLedgerId ?? null,
          status: 'DRAFT',
          totalAmount: totalAmount.toFixed(2),
          narration: input.narration ?? null,
          createdBy: session.user.id,
          orderItems: {
            create: input.items.map((item) => ({
              companyId,
              itemId: item.itemId,
              godownId: item.godownId ?? null,
              qty: new Decimal(item.qty).toFixed(3),
              rate: new Decimal(item.rate).toFixed(4),
              amount: new Decimal(item.amount).toFixed(2),
            })),
          },
        },
        include: { orderItems: true },
      })

      // Audit log — inside same $transaction (T-04-06-05)
      await tx.auditLog.create({
        data: {
          companyId,
          userId: session.user.id,
          entity: 'Order',
          entityId: order.id,
          action: 'CREATE',
          oldValue: Prisma.JsonNull,
          newValue: {
            orderNo,
            orderType: input.orderType,
            status: 'DRAFT',
            totalAmount: totalAmount.toFixed(2),
          },
        },
      })

      return order
    })
  },

  /**
   * Approve a DRAFT order.
   * Role check: only Admin or Owner (fetched from DB via session.user.roleId — D-03).
   * Cross-tenant guard: order.findFirst with companyId (T-04-06-06).
   */
  async approveOrder(orderId: string, session: OrderSession) {
    const companyId = session.user.companyId

    // D-03: role fetched from DB — session.user.roleId is not trusted for authorization decisions
    const role = session.user.roleId
      ? await prisma.role.findFirst({
          where: { id: session.user.roleId, companyId },
          select: { name: true },
        })
      : null

    if (!role || !['Admin', 'Owner'].includes(role.name)) {
      throw new ForbiddenError('Only Admin or Owner can approve orders')
    }

    return prisma.$transaction(async (tx) => {
      // Cross-tenant guard (T-04-06-06)
      const order = await tx.order.findFirst({
        where: { id: orderId, companyId },
      })
      if (!order) throw new ValidationError('Order not found')
      if (order.status !== 'DRAFT') {
        throw new ValidationError('Only DRAFT orders can be approved')
      }

      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status: 'APPROVED' },
      })

      await tx.auditLog.create({
        data: {
          companyId,
          userId: session.user.id,
          entity: 'Order',
          entityId: orderId,
          action: 'UPDATE',
          oldValue: { status: 'DRAFT' },
          newValue: { status: 'APPROVED' },
        },
      })

      return updated
    })
  },

  /**
   * Cancel an order (soft delete — status → CANCELLED).
   * Cannot cancel a CLOSED or already CANCELLED order.
   */
  async cancelOrder(orderId: string, session: OrderSession) {
    const companyId = session.user.companyId

    return prisma.$transaction(async (tx) => {
      // Cross-tenant guard (T-04-06-06)
      const order = await tx.order.findFirst({
        where: { id: orderId, companyId },
      })
      if (!order) throw new ValidationError('Order not found')
      if (order.status === 'CLOSED' || order.status === 'CANCELLED') {
        throw new ValidationError('Cannot cancel a closed or already cancelled order')
      }

      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED' },
      })

      await tx.auditLog.create({
        data: {
          companyId,
          userId: session.user.id,
          entity: 'Order',
          entityId: orderId,
          action: 'CANCEL',
          oldValue: { status: order.status },
          newValue: { status: 'CANCELLED' },
        },
      })

      return updated
    })
  },

  /**
   * Close an order (manual close — marks as fully fulfilled/done).
   * Cannot close a CANCELLED or already CLOSED order.
   */
  async closeOrder(orderId: string, session: OrderSession) {
    const companyId = session.user.companyId

    return prisma.$transaction(async (tx) => {
      // Cross-tenant guard (T-04-06-06)
      const order = await tx.order.findFirst({
        where: { id: orderId, companyId },
      })
      if (!order) throw new ValidationError('Order not found')
      if (order.status === 'CANCELLED' || order.status === 'CLOSED') {
        throw new ValidationError('Order is already closed or cancelled')
      }

      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status: 'CLOSED' },
      })

      await tx.auditLog.create({
        data: {
          companyId,
          userId: session.user.id,
          entity: 'Order',
          entityId: orderId,
          action: 'UPDATE',
          oldValue: { status: order.status },
          newValue: { status: 'CLOSED' },
        },
      })

      return updated
    })
  },

  /**
   * Convert an order (partial or full) to a voucher.
   * PO → Purchase Invoice (PURCHASE), SO → Sales Invoice (SALES).
   *
   * All operations run inside a single $transaction:
   *  - Quantity validation against pending qty (prevents over-delivery)
   *  - Voucher + entries + items created via voucher model directly (tx-scoped)
   *  - OrderItem.receivedQty (PO) or dispatchedQty (SO) incremented
   *  - Order.status set to CLOSED (fully fulfilled) or PARTIALLY_FULFILLED
   *  - Audit log written as LAST step in the same $transaction
   *
   * D-05: atomicity — entire operation succeeds or rolls back together.
   * D-06: auto-close when every OrderItem is fully fulfilled.
   * T-04-07-02: companyId always from session; order fetched with companyId guard.
   * T-04-07-03: requestedQty > pendingQty throws ValidationError BEFORE any DB write.
   */
  async convertOrder(orderId: string, input: ConvertOrderInput, session: OrderSession) {
    const companyId = session.user.companyId

    return prisma.$transaction(async (tx) => {
      // 1. Fetch order with items (cross-tenant guard — T-04-07-02)
      const order = await tx.order.findFirst({
        where: { id: orderId, companyId },
        include: {
          orderItems: {
            include: {
              item: {
                select: {
                  id: true,
                  name: true,
                  hsnCode: true,
                  gstRate: true,
                  gstApplicable: true,
                },
              },
            },
          },
        },
      })
      if (!order) throw new ValidationError('Order not found')

      // 2. Status guard (T-04-07-05)
      if (order.orderType === 'PURCHASE_ORDER') {
        if (!['APPROVED', 'PARTIALLY_FULFILLED'].includes(order.status)) {
          throw new ValidationError(
            'Purchase order must be APPROVED or PARTIALLY_FULFILLED to receive goods',
          )
        }
      } else {
        // SALES_ORDER
        if (!['DRAFT', 'APPROVED', 'PARTIALLY_FULFILLED'].includes(order.status)) {
          throw new ValidationError('Sales order must be open to dispatch goods')
        }
      }

      // 3. Validate requested qtys against pending (T-04-07-03)
      const itemsToConvert: Array<{
        orderItem: (typeof order.orderItems)[0]
        requestedQty: Decimal
      }> = []

      for (const reqItem of input.items) {
        const orderItem = order.orderItems.find((oi) => oi.id === reqItem.orderItemId)
        if (!orderItem) {
          throw new ValidationError(
            `Order item ${reqItem.orderItemId} not found on this order`,
          )
        }
        const requestedQty = new Decimal(reqItem.qty)
        const alreadyDone =
          order.orderType === 'PURCHASE_ORDER'
            ? new Decimal(orderItem.receivedQty.toString())
            : new Decimal(orderItem.dispatchedQty.toString())
        const pendingQty = new Decimal(orderItem.qty.toString()).minus(alreadyDone)

        if (requestedQty.gt(pendingQty)) {
          throw new ValidationError(
            `You can't ${order.orderType === 'PURCHASE_ORDER' ? 'receive' : 'dispatch'} more than the pending quantity (${pendingQty.toFixed(3)} units) for item ${orderItem.item?.name ?? orderItem.itemId}`,
          )
        }
        itemsToConvert.push({ orderItem, requestedQty })
      }

      // 4. Build voucher accounting entries
      const voucherType = order.orderType === 'PURCHASE_ORDER' ? ('PURCHASE' as const) : ('SALES' as const)
      const totalAmount = itemsToConvert.reduce(
        (sum, { orderItem, requestedQty }) =>
          sum.plus(requestedQty.times(new Decimal(orderItem.rate.toString()))),
        new Decimal(0),
      )

      // Party ledger must exist on the order
      const partyLedgerId = order.partyLedgerId
      if (!partyLedgerId) {
        throw new ValidationError('Order has no party ledger — cannot create invoice')
      }

      // tradeLedgerId: Purchase/stock account (PO) or Sales revenue account (SO)
      const tradeLedgerId = input.tradeLedgerId

      // Double-entry legs
      // Purchase: DR tradeLedger (purchases/stock a/c), CR party (creditor)
      // Sales:    DR party (debtor),                    CR tradeLedger (sales a/c)
      const entries =
        voucherType === 'PURCHASE'
          ? [
              { ledgerId: tradeLedgerId, drCr: 'DR' as const, amount: totalAmount },
              { ledgerId: partyLedgerId, drCr: 'CR' as const, amount: totalAmount },
            ]
          : [
              { ledgerId: partyLedgerId, drCr: 'DR' as const, amount: totalAmount },
              { ledgerId: tradeLedgerId, drCr: 'CR' as const, amount: totalAmount },
            ]

      validateBalance(entries)

      // 5. Generate voucher number inside this $transaction (atomic sequence — T-02-02)
      const voucherDate = new Date()
      const fy = getFY(voucherDate)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const voucherNo = await getNextVoucherNo(tx as any, companyId, voucherType, fy)

      // 6. Persist voucher (status = POSTED — stock/GST effects applied immediately)
      const voucher = await tx.voucher.create({
        data: {
          companyId,
          voucherType,
          voucherNo,
          date: voucherDate,
          narration: `Converted from ${order.orderNo}`,
          partyLedgerId,
          totalAmount,
          status: 'POSTED',
          createdBy: session.user.id,
          voucherEntries: {
            create: entries.map((e) => ({
              ledgerId: e.ledgerId,
              drCr: e.drCr,
              amount: e.amount,
            })),
          },
          voucherItems: {
            create: itemsToConvert.map(({ orderItem, requestedQty }) => ({
              itemId: orderItem.itemId,
              godownId: orderItem.godownId ?? null,
              qty: requestedQty,
              rate: new Decimal(orderItem.rate.toString()),
              amount: requestedQty.times(new Decimal(orderItem.rate.toString())),
              hsnCode: orderItem.item?.hsnCode ?? null,
              itcEligible: true,
            })),
          },
        },
      })

      // 6b. Create BillRef for outstanding tracking (POSTED SALES/PURCHASE with party)
      await tx.billRef.create({
        data: {
          companyId,
          voucherId: voucher.id,
          ledgerId: partyLedgerId,
          billNo: voucherNo,
          billDate: voucherDate,
          totalAmount,
          outstandingAmount: totalAmount,
          drCr: voucherType === 'SALES' ? 'DR' : 'CR',
          settled: false,
        },
      })

      // 6c. Voucher audit log (inside same $transaction — T-02-03)
      await tx.auditLog.create({
        data: {
          companyId,
          userId: session.user.id,
          entity: 'Voucher',
          entityId: voucher.id,
          action: 'CREATE',
          oldValue: Prisma.JsonNull,
          newValue: {
            voucherType,
            voucherNo,
            date: voucherDate.toISOString(),
            linkedOrderId: orderId,
          },
        },
      })

      // 6d. StockBatch creation (PURCHASE inflow — matches VoucherEngine step 4d)
      if (voucherType === 'PURCHASE') {
        for (const { orderItem, requestedQty } of itemsToConvert) {
          await tx.stockBatch.create({
            data: {
              companyId,
              itemId: orderItem.itemId,
              godownId: orderItem.godownId ?? null,
              voucherItemId: null, // voucherItems created via nested create; id not available here
              purchaseDate: voucherDate,
              qty: requestedQty,
              remainingQty: requestedQty,
              costRate: new Decimal(orderItem.rate.toString()),
              batchNo: null,
              isActive: true,
            },
          })
        }
      }

      // 6e. StockBatch FIFO consumption (SALES outflow — matches VoucherEngine step 4e)
      if (voucherType === 'SALES') {
        for (const { orderItem, requestedQty } of itemsToConvert) {
          let toConsume = new Decimal(requestedQty.toString())
          const batches = await tx.stockBatch.findMany({
            where: {
              companyId,
              itemId: orderItem.itemId,
              godownId: orderItem.godownId ?? null,
              isActive: true,
              remainingQty: { gt: 0 },
            },
            orderBy: { purchaseDate: 'asc' },
          })
          const available = batches.reduce(
            (s, b) => s.plus(new Decimal(b.remainingQty.toString())),
            new Decimal(0),
          )
          if (available.lt(toConsume)) {
            throw new ValidationError(
              `Insufficient stock for item ${orderItem.item?.name ?? orderItem.itemId}: need ${toConsume.toFixed(3)}, have ${available.toFixed(3)}`,
            )
          }
          for (const batch of batches) {
            if (toConsume.lte(0)) break
            const consume = Decimal.min(new Decimal(batch.remainingQty.toString()), toConsume)
            await tx.stockBatch.update({
              where: { id: batch.id },
              data: { remainingQty: new Decimal(batch.remainingQty.toString()).minus(consume) },
            })
            await tx.stockConsumption.create({
              data: {
                companyId,
                stockBatchId: batch.id,
                voucherId: voucher.id,
                qty: consume,
              },
            })
            toConsume = toConsume.minus(consume)
          }
        }
      }

      // 7. Update OrderItem.receivedQty (PO) or dispatchedQty (SO)
      for (const { orderItem, requestedQty } of itemsToConvert) {
        if (order.orderType === 'PURCHASE_ORDER') {
          await tx.orderItem.update({
            where: { id: orderItem.id },
            data: {
              receivedQty: new Decimal(orderItem.receivedQty.toString()).plus(requestedQty),
            },
          })
        } else {
          await tx.orderItem.update({
            where: { id: orderItem.id },
            data: {
              dispatchedQty: new Decimal(orderItem.dispatchedQty.toString()).plus(requestedQty),
            },
          })
        }
      }

      // 8. Re-fetch updated order items to determine auto-close (D-06)
      const updatedItems = await tx.orderItem.findMany({
        where: { orderId },
      })
      const isFullyFulfilled = updatedItems.every((oi) => {
        const done =
          order.orderType === 'PURCHASE_ORDER'
            ? new Decimal(oi.receivedQty.toString())
            : new Decimal(oi.dispatchedQty.toString())
        return done.gte(new Decimal(oi.qty.toString()))
      })
      const newOrderStatus = isFullyFulfilled ? ('CLOSED' as const) : ('PARTIALLY_FULFILLED' as const)

      await tx.order.update({
        where: { id: orderId },
        data: { status: newOrderStatus },
      })

      // 9. Order audit log (T-04-07-06 — inside same $transaction)
      await tx.auditLog.create({
        data: {
          companyId,
          userId: session.user.id,
          entity: 'Order',
          entityId: orderId,
          action: 'UPDATE',
          oldValue: { status: order.status },
          newValue: { status: newOrderStatus, linkedVoucherId: voucher.id },
        },
      })

      return {
        voucherId: voucher.id,
        voucherNo: voucher.voucherNo,
        orderStatus: newOrderStatus,
      }
    })
  },
}
