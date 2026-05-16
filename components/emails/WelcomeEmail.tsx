import { Html, Body, Container, Heading, Text } from '@react-email/components'

interface WelcomeEmailProps { name: string; companyName: string }

export function WelcomeEmail({ name, companyName }: WelcomeEmailProps) {
  return (
    <Html>
      <Body style={{ fontFamily: 'Inter, sans-serif', backgroundColor: '#F9FAFB' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', backgroundColor: '#fff', padding: '32px', borderRadius: '8px' }}>
          <Heading style={{ color: '#7C3AED', fontSize: '24px' }}>Welcome to PremGiri Books, {name}!</Heading>
          <Text style={{ color: '#374151', fontSize: '16px' }}>Your company &quot;{companyName}&quot; is now set up and ready to use.</Text>
          <Text style={{ color: '#6B7280', fontSize: '14px' }}>Start by creating your first sales invoice or adding your products.</Text>
        </Container>
      </Body>
    </Html>
  )
}
