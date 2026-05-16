import React from 'react'
import { Html, Head, Body, Container, Heading, Text, Hr } from '@react-email/components'

interface PayrollReminderEmailProps {
  companyName: string
  monthLabel: string // "May 2026"
}

export function PayrollReminderEmail({ companyName, monthLabel }: PayrollReminderEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: '#F9FAFB', fontFamily: 'Inter, sans-serif' }}>
        <Container style={{ background: 'white', padding: '32px', borderRadius: 8, maxWidth: 600 }}>
          <Heading style={{ color: '#7C3AED' }}>Payroll for {monthLabel} is due</Heading>
          <Text>{companyName},</Text>
          <Text>
            It&apos;s the 25th of the month — start your pay run in PremGiri Books to keep payroll
            on schedule.
          </Text>
          <Hr />
          <Text style={{ color: '#6B7280', fontSize: 12 }}>Reminder sent by PremGiri Books.</Text>
        </Container>
      </Body>
    </Html>
  )
}
