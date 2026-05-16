import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from '@react-email/render'
import { OverdueReminderEmail } from './OverdueReminderEmail'
import { GstReminderEmail } from './GstReminderEmail'
import { PayrollReminderEmail } from './PayrollReminderEmail'

describe('OverdueReminderEmail', () => {
  it('renders HTML containing party name, amount, and days overdue', async () => {
    const element = React.createElement(OverdueReminderEmail, {
      companyName: 'Test Co',
      invoices: [
        { billNo: 'SI-0001', partyName: 'Sharma', amount: '₹1,50,000', daysOverdue: 30 },
      ],
    })
    const html = await render(element)
    expect(html).toContain('Sharma')
    expect(html).toContain('₹1,50,000')
    expect(html).toContain('30 days')
  })
})

describe('GstReminderEmail', () => {
  it('renders HTML containing company name, deadline, and days left', async () => {
    const element = React.createElement(GstReminderEmail, {
      companyName: 'Acme',
      deadline: 'GSTR-1' as const,
      dueDate: '11 May 2026',
      daysLeft: 5,
      returnPeriod: '04/2026',
    })
    const html = await render(element)
    expect(html).toContain('Acme')
    expect(html).toContain('GSTR-1')
    expect(html).toContain('5 days')
  })
})

describe('PayrollReminderEmail', () => {
  it('renders HTML containing company name and month label', async () => {
    const element = React.createElement(PayrollReminderEmail, {
      companyName: 'Acme',
      monthLabel: 'May 2026',
    })
    const html = await render(element)
    expect(html).toContain('Acme')
    expect(html).toContain('May 2026')
  })
})

describe('All email templates structural check', () => {
  it('all templates contain html, body tags and brand color #7C3AED', async () => {
    const overdueHtml = await render(
      React.createElement(OverdueReminderEmail, {
        companyName: 'Test',
        invoices: [{ billNo: 'SI-0001', partyName: 'Test Party', amount: '₹1,000', daysOverdue: 30 }],
      })
    )
    const gstHtml = await render(
      React.createElement(GstReminderEmail, {
        companyName: 'Test',
        deadline: 'GSTR-3B' as const,
        dueDate: '20 May 2026',
        daysLeft: 5,
        returnPeriod: '04/2026',
      })
    )
    const payrollHtml = await render(
      React.createElement(PayrollReminderEmail, {
        companyName: 'Test',
        monthLabel: 'May 2026',
      })
    )

    for (const html of [overdueHtml, gstHtml, payrollHtml]) {
      expect(html.toLowerCase()).toContain('<html')
      expect(html.toLowerCase()).toContain('<body')
      expect(html).toContain('#7C3AED')
    }
  })
})
