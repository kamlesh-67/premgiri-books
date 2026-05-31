/**
 * lib/email.ts — NO-OP STUB
 *
 * Email (Resend) removed in Phase 21 (CLOUD-04).
 * Desktop app has no email flow — all notifications are in-app only.
 * sendEmail() logs to console so callers compile and run without errors.
 */

interface EmailPayload {
  to: string
  subject: string
  html: string
  from?: string
  replyTo?: string
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  // No-op: Resend removed. Desktop app uses in-app notifications only.
  console.log('[email] sendEmail no-op:', payload.to, '|', payload.subject)
}
