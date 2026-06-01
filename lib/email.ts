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

export async function sendEmail(_payload: EmailPayload): Promise<void> {
  // No-op: Resend removed. Desktop app uses in-app notifications only.
}
