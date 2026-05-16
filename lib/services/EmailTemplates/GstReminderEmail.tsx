import React from 'react'
import { Html, Head, Body, Container, Heading, Text, Hr } from '@react-email/components'

interface GstReminderEmailProps {
  companyName: string
  deadline: 'GSTR-1' | 'GSTR-3B'
  dueDate: string // "11 May 2026"
  daysLeft: number // 5
  returnPeriod: string // "04/2026"
}

export function GstReminderEmail({
  companyName,
  deadline,
  dueDate,
  daysLeft,
  returnPeriod,
}: GstReminderEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: '#F9FAFB', fontFamily: 'Inter, sans-serif' }}>
        <Container style={{ background: 'white', padding: '32px', borderRadius: 8, maxWidth: 600 }}>
          <Heading style={{ color: '#7C3AED' }}>
            {`${deadline} due in ${daysLeft} days`}
          </Heading>
          <Text>{companyName},</Text>
          <Text>
            Your {deadline} return for period <strong>{returnPeriod}</strong> is due on{' '}
            <strong>{dueDate}</strong>.
          </Text>
          <Text>
            Late filing attracts 18% per annum interest under CGST Act Section 50. File from your
            dashboard.
          </Text>
          <Hr />
          <Text style={{ color: '#6B7280', fontSize: 12 }}>Reminder sent by PremGiri Books.</Text>
        </Container>
      </Body>
    </Html>
  )
}
