import type { AuditAction } from '@/types'

export interface AuditEntry {
  companyId: string
  userId: string
  entity: string
  entityId: string
  action: AuditAction
  oldValue?: Record<string, unknown>
  newValue?: Record<string, unknown>
  ipAddress?: string
}

/**
 * Build an audit log entry object.
 * Pass to prisma.auditLog.create() inside a $transaction.
 */
export function buildAuditEntry(params: AuditEntry) {
  return {
    companyId: params.companyId,
    userId: params.userId,
    entity: params.entity,
    entityId: params.entityId,
    action: params.action,
    oldValue: params.oldValue ?? null,
    newValue: params.newValue ?? null,
    ipAddress: params.ipAddress ?? null,
  }
}
