import { Html, Body, Container, Heading, Text } from '@react-email/components'

interface GstFilingAlertEmailProps {
  companyName: string
  returnType: string
  dueDate: string
  period: string
}

export function GstFilingAlertEmail({ companyName, returnType, dueDate, period }: GstFilingAlertEmailProps) {
  return (
    <Html>
      <Body style={{ fontFamily: 'Inter, sans-serif', backgroundColor: '#F9FAFB' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', backgroundColor: '#fff', padding: '32px', borderRadius: '8px' }}>
          <Heading style={{ color: '#D97706', fontSize: '20px' }}>GST Filing Alert — {returnType}</Heading>
          <Text style={{ color: '#374151' }}>Dear {companyName} team,</Text>
          <Text style={{ color: '#374151' }}>Your <strong>{returnType}</strong> for period <strong>{period}</strong> is due on <strong>{dueDate}</strong>.</Text>
          <Text style={{ color: '#6B7280', fontSize: '14px' }}>Log in to PremGiri Books to file your return and avoid penalties.</Text>
        </Container>
      </Body>
    </Html>
  )
}
