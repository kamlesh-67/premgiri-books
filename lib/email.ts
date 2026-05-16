import nodemailer from 'nodemailer'

type EmailPayload = {
  to: string
  subject: string
  html: string
  from?: string
  replyTo?: string
}

const DEFAULT_FROM = 'PremGiri Books <noreply@premgiribooks.com>'

function createNodemailerTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'localhost',
    port: parseInt(process.env.SMTP_PORT ?? '1025', 10),
    secure: false,
    ignoreTLS: true,
  })
}

/**
 * Send a transactional email.
 * Switches between Nodemailer+Mailhog (dev) and Resend (prod) via EMAIL_PROVIDER env var.
 * Pass html as a rendered string — use @react-email/render to convert React Email templates.
 *
 * Example:
 *   import { render } from '@react-email/render'
 *   import { WelcomeEmail } from '@/components/emails/WelcomeEmail'
 *   const html = await render(<WelcomeEmail name="Ramesh" companyName="Demo Co" />)
 *   await sendEmail({ to: '...', subject: 'Welcome', html })
 */
export async function sendEmail({ to, subject, html, from, replyTo }: EmailPayload): Promise<void> {
  const provider = process.env.EMAIL_PROVIDER ?? 'nodemailer'

  if (provider === 'resend') {
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY!)
    await resend.emails.send({ from: from ?? DEFAULT_FROM, to, subject, html, replyTo })
  } else {
    const transporter = createNodemailerTransport()
    await transporter.sendMail({ from: from ?? DEFAULT_FROM, to, subject, html, replyTo })
  }
}
