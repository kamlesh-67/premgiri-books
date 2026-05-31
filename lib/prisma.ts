import { PrismaClient } from '@prisma/client'

// --- TenantScopeError -------------------------------------------------------
export class TenantScopeError extends Error {
  constructor(model: string, operation: string) {
    super(
      `[TenantScopeError] ${model}.${operation} called without companyId — multi-tenant violation detected. ` +
      `Every query on tenant-scoped models must include where: { companyId: session.user.companyId }.`
    )
    this.name = 'TenantScopeError'
  }
}

// --- Tenant-scoped models (every model that has a companyId field) ----------
const TENANT_SCOPED_MODELS = [
  'User', 'Role', 'AccountGroup', 'Ledger', 'StockGroup', 'StockItem',
  'UnitOfMeasure', 'Godown', 'VoucherSequence', 'Voucher', 'VoucherEntry',
  'GstTransaction', 'GstReturn', 'AuditLog', 'BillRef',
  'Employee', 'Order', 'OrderItem',
  // Phase 7 banking models — companyId required on all queries
  'BankStatement', 'BankTransaction',
]

// --- Operations that must have companyId ------------------------------------
const GUARDED_OPS = new Set([
  'findMany', 'findFirst', 'findFirstOrThrow',
  'update', 'updateMany', 'delete', 'deleteMany',
])

/**
 * Exported so it can be unit-tested directly without a DB connection.
 * Called by the Prisma $extends query hook on every operation.
 */
export function guardTenantScope(
  model: string,
  operation: string,
  args: Record<string, unknown>
): void {
  if (!TENANT_SCOPED_MODELS.includes(model)) return
  if (!GUARDED_OPS.has(operation)) return
  const where = args?.['where'] as Record<string, unknown> | undefined
  if (!where?.['companyId']) {
    throw new TenantScopeError(model, operation)
  }
}

// --- Create extended Prisma client ------------------------------------------
function createPrismaClient() {
  // Phase 17: Plain PrismaClient for SQLite — no pg/neon adapter needed
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  }).$extends({
    query: {
      $allOperations({ model, operation, args, query }) {
        guardTenantScope(model ?? '', operation, args as Record<string, unknown>)
        return query(args)
      },
    },
  })
}

// --- Singleton (prevents too-many-connections during Next.js HMR) -----------
type PrismaClientExtended = ReturnType<typeof createPrismaClient>
const globalForPrisma = globalThis as unknown as { __prisma: PrismaClientExtended }

export const prisma: PrismaClientExtended =
  globalForPrisma.__prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__prisma = prisma
}
