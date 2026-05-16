import { Html, Body, Container, Heading, Text, Button } from '@react-email/components'

interface InvoiceEmailProps {
  companyName: string
  invoiceNo: string
  amount: string
  dueDate: string
  downloadUrl: string
}

export function InvoiceEmail({ companyName, invoiceNo, amount, dueDate, downloadUrl }: InvoiceEmailProps) {
  return (
    <Html>
      <Body style={{ fontFamily: 'Inter, sans-serif', backgroundColor: '#F9FAFB' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', backgroundColor: '#fff', padding: '32px', borderRadius: '8px' }}>
          <Heading style={{ color: '#111827', fontSize: '20px' }}>Invoice {invoiceNo} from {companyName}</Heading>
          <Text style={{ color: '#374151' }}>Amount due: <strong>{amount}</strong> by {dueDate}</Text>
          <Button href={downloadUrl} style={{ backgroundColor: '#7C3AED', color: '#fff', padding: '12px 24px', borderRadius: '6px', textDecoration: 'none', display: 'inline-block' }}>
            Download Invoice
          </Button>
        </Container>
      </Body>
    </Html>
  )
}
