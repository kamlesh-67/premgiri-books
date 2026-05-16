import { Html, Body, Container, Heading, Text, Button } from '@react-email/components'

interface PaymentReminderEmailProps {
  companyName: string
  invoiceNo: string
  amount: string
  dueDate: string
  paymentUrl: string
}

export function PaymentReminderEmail({ companyName, invoiceNo, amount, dueDate, paymentUrl }: PaymentReminderEmailProps) {
  return (
    <Html>
      <Body style={{ fontFamily: 'Inter, sans-serif', backgroundColor: '#F9FAFB' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', backgroundColor: '#fff', padding: '32px', borderRadius: '8px' }}>
          <Heading style={{ color: '#DC2626', fontSize: '20px' }}>Payment Reminder — Invoice {invoiceNo}</Heading>
          <Text style={{ color: '#374151' }}>This is a reminder that your payment of <strong>{amount}</strong> to {companyName} is due on <strong>{dueDate}</strong>.</Text>
          <Text style={{ color: '#6B7280', fontSize: '14px' }}>Please make payment at your earliest convenience to avoid any late fees.</Text>
          <Button href={paymentUrl} style={{ backgroundColor: '#7C3AED', color: '#fff', padding: '12px 24px', borderRadius: '6px', textDecoration: 'none', display: 'inline-block' }}>
            View Invoice
          </Button>
        </Container>
      </Body>
    </Html>
  )
}
