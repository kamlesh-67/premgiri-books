import { Html, Body, Container, Heading, Text, Button } from '@react-email/components'

interface PayslipEmailProps {
  employeeName: string
  month: string
  netPay: string
  downloadUrl: string
}

export function PayslipEmail({ employeeName, month, netPay, downloadUrl }: PayslipEmailProps) {
  return (
    <Html>
      <Body style={{ fontFamily: 'Inter, sans-serif', backgroundColor: '#F9FAFB' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', backgroundColor: '#fff', padding: '32px', borderRadius: '8px' }}>
          <Heading style={{ color: '#111827', fontSize: '20px' }}>Pay Slip — {month}</Heading>
          <Text style={{ color: '#374151' }}>Dear {employeeName}, your pay slip for {month} is ready.</Text>
          <Text style={{ color: '#374151' }}>Net Pay: <strong>{netPay}</strong></Text>
          <Button href={downloadUrl} style={{ backgroundColor: '#7C3AED', color: '#fff', padding: '12px 24px', borderRadius: '6px', textDecoration: 'none', display: 'inline-block' }}>
            Download Pay Slip
          </Button>
        </Container>
      </Body>
    </Html>
  )
}
