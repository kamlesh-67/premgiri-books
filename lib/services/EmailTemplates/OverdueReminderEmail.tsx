import React from 'react'
import { Html, Head, Body, Container, Heading, Text, Section, Row, Column, Hr } from '@react-email/components'

interface Invoice {
  billNo: string
  partyName: string
  amount: string // Indian lakh-formatted — already passed in formatted
  daysOverdue: 30 | 60 | 90
}

interface OverdueReminderEmailProps {
  companyName: string
  invoices: Invoice[]
}

export function OverdueReminderEmail({ companyName, invoices }: OverdueReminderEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: '#F9FAFB', fontFamily: 'Inter, sans-serif' }}>
        <Container style={{ background: 'white', padding: '32px', borderRadius: 8, maxWidth: 600 }}>
          <Heading style={{ color: '#7C3AED' }}>Overdue Payments — {companyName}</Heading>
          <Text>The following invoices have outstanding balances:</Text>
          <Section>
            {invoices.map((inv) => (
              <Row key={inv.billNo} style={{ padding: '8px 0', borderBottom: '1px solid #E5E7EB' }}>
                <Column>
                  {inv.billNo} — {inv.partyName}
                </Column>
                <Column align="right">
                  {`${inv.amount} · ${inv.daysOverdue} days overdue`}
                </Column>
              </Row>
            ))}
          </Section>
          <Hr />
          <Text style={{ color: '#6B7280', fontSize: 12 }}>
            Reminder sent by PremGiri Books. Visit your dashboard to record receipts.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
