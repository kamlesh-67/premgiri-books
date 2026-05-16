import { Inngest } from 'inngest'

export const inngest = new Inngest({
  id: 'premgiri-books',
  eventKey: process.env.INNGEST_EVENT_KEY ?? 'local',
})

// Inngest v4: createFunction(config+trigger merged, handler)
export const healthCheckFn = inngest.createFunction(
  { id: 'premgiri/system.health-check', triggers: [{ event: 'premgiri/system.ping' }] },
  async ({ event, step }: { event: { data?: { triggeredBy?: string } }; step: { sleep: (id: string, ms: number) => Promise<void> } }) => {
    await step.sleep('wait-a-moment', 1000)
    return { status: 'ok', timestamp: new Date().toISOString(), triggeredBy: event.data?.triggeredBy ?? 'unknown' }
  }
)

export const payrollRunFn = inngest.createFunction(
  { id: 'premgiri/payroll.run', retries: 3, triggers: [{ event: 'premgiri/payroll.run' }] },
  async ({ event, step }: {
    event: { data: { payRunId: string; companyId: string; month: string; triggeredBy: string } }
    step: {
      run: <T>(id: string, fn: () => Promise<T>) => Promise<T>
    }
  }) => {
    const { payRunId, companyId, month, triggeredBy } = event.data

    try {
      // ── Step 1: Mark PROCESSING (unlock attendance on re-run) ─────────────
      await step.run('mark-processing', async () => {
        const { prisma } = await import('@/lib/prisma')
        // Unlock attendance so we can re-lock after fresh computation (D-09)
        await prisma.attendanceRecord.updateMany({
          where: { companyId, month },
          data: { lockedAt: null },
        })
        await prisma.payRun.update({
          where: { id: payRunId },
          data: { status: 'PROCESSING' },
        })
        return { status: 'PROCESSING' }
      })

      // ── Step 2: Load employees + attendance data ───────────────────────────
      const { employees, attendanceMap } = await step.run('load-data', async () => {
        const { prisma } = await import('@/lib/prisma')
        const emps = await prisma.employee.findMany({
          where: {
            companyId,
            isActive: true,
            salaryStructureId: { not: null },
          },
          include: { salaryStructure: true },
        })

        const attRecords = await prisma.attendanceRecord.findMany({
          where: { companyId, month },
        })
        const attMap: Record<string, { presentDays: string; halfDays: number; leaveDays: number }> = {}
        for (const r of attRecords) {
          attMap[r.employeeId] = {
            presentDays: r.presentDays.toString(),
            halfDays: r.halfDays,
            leaveDays: r.leaveDays,
          }
        }
        return { employees: emps, attendanceMap: attMap }
      })

      // ── Step 3: Compute pay slips ─────────────────────────────────────────
      const computedSlips = await step.run('compute', async () => {
        const { computePaySlip } = await import('@/lib/services/PayrollEngine')
        const results = []

        for (const emp of employees) {
          if (!emp.salaryStructure) continue

          // D-11: log warning for employees without salaryLedgerId
          if (!emp.salaryLedgerId) {
            console.warn(`[payroll.run] Employee ${emp.employeeCode} (${emp.name}) has no salaryLedgerId — excluded from journal`)
          }

          const attendance = attendanceMap[emp.id] ?? {
            presentDays: '0',
            halfDays: 0,
            leaveDays: 0,
          }

          const structure = {
            id: emp.salaryStructure.id,
            name: emp.salaryStructure.name,
            components: emp.salaryStructure.components as Array<{
              name: string; type: 'earning' | 'deduction'; formula?: string; amount?: string; order: number
            }>,
          }

          const computed = computePaySlip(
            {
              id: emp.id,
              name: emp.name,
              employeeCode: emp.employeeCode,
              pfApplicable: emp.pfApplicable,
              esiApplicable: emp.esiApplicable,
              salaryLedgerId: emp.salaryLedgerId,
            },
            structure,
            attendance,
            month
          )
          results.push({
            ...computed,
            // Serialize Decimals for Inngest step return (must be JSON-serializable)
            grossEarnings: computed.grossEarnings.toString(),
            pfEmployee: computed.pfEmployee.toString(),
            pfEmployer: computed.pfEmployer.toString(),
            esiEmployee: computed.esiEmployee.toString(),
            esiEmployer: computed.esiEmployer.toString(),
            professionalTax: computed.professionalTax.toString(),
            totalDeductions: computed.totalDeductions.toString(),
            netPay: computed.netPay.toString(),
          })
        }
        return results
      })

      // ── Step 4: Persist pay slips + upload PDFs to R2 ────────────────────
      const slipKeys = await step.run('persist-pdfs', async () => {
        const { prisma } = await import('@/lib/prisma')
        const { renderToBuffer } = await import('@react-pdf/renderer')
        const { uploadFile, buildR2Key } = await import('@/lib/r2')
        const React = await import('react')
        const { PaySlipPDF } = await import('@/lib/services/PDFTemplates/PaySlipPDF')

        const company = await prisma.company.findUniqueOrThrow({
          where: { id: companyId },
          select: { name: true, gstin: true, address: true, logoUrl: true },
        })

        const keys: Record<string, string> = {}

        for (const slip of computedSlips) {
          // Build PDF data
          const pdfData = {
            company: { name: company.name, gstin: company.gstin, address: company.address ?? null, logoUrl: company.logoUrl ?? null },
            employee: {
              name: slip.employeeName,
              employeeCode: slip.employeeCode,
              designation: null,
              department: null,
            },
            month,
            attendance: slip.computedData.attendance,
            earnings: slip.computedData.components
              .filter((c: { type: string }) => c.type === 'earning')
              .map((c: { name: string; computed: string }) => ({ name: c.name, amount: c.computed })),
            deductions: [
              { name: 'PF (Employee)', amount: slip.pfEmployee },
              { name: 'ESI (Employee)', amount: slip.esiEmployee },
              { name: 'Professional Tax', amount: slip.professionalTax },
            ].filter((d) => parseFloat(d.amount) > 0),
            grossEarnings: slip.grossEarnings,
            totalDeductions: slip.totalDeductions,
            netPay: slip.netPay,
            employerContributions: { pfEmployer: slip.pfEmployer, esiEmployer: slip.esiEmployer },
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const element = React.createElement(PaySlipPDF as any, { data: pdfData }) as React.ReactElement
          const buffer = await renderToBuffer(element)
          const r2Key = buildR2Key('payslips', companyId, slip.employeeId, `${month}.pdf`)
          await uploadFile(r2Key, buffer, 'application/pdf')
          keys[slip.employeeId] = r2Key

          // Upsert PaySlip (soft-safe re-run — never hard-delete financial records)
          await prisma.$transaction(async (tx) => {
            const slipData = {
              companyId,
              payRunId,
              employeeId: slip.employeeId,
              month,
              grossEarnings: slip.grossEarnings,
              totalDeductions: slip.totalDeductions,
              netPay: slip.netPay,
              pfEmployee: slip.pfEmployee,
              pfEmployer: slip.pfEmployer,
              esiEmployee: slip.esiEmployee,
              esiEmployer: slip.esiEmployer,
              professionalTax: slip.professionalTax,
              computedData: slip.computedData as object,
              pdfKey: r2Key,
            }
            const record = await tx.paySlip.upsert({
              where: { payRunId_employeeId: { payRunId, employeeId: slip.employeeId } },
              create: slipData,
              update: {
                grossEarnings: slip.grossEarnings,
                totalDeductions: slip.totalDeductions,
                netPay: slip.netPay,
                pfEmployee: slip.pfEmployee,
                pfEmployer: slip.pfEmployer,
                esiEmployee: slip.esiEmployee,
                esiEmployer: slip.esiEmployer,
                professionalTax: slip.professionalTax,
                computedData: slip.computedData as object,
                pdfKey: r2Key,
              },
            })
            await tx.auditLog.create({
              data: {
                companyId,
                userId: triggeredBy,
                entity: 'PaySlip',
                entityId: record.id,
                action: 'CREATE',
                newValue: { payRunId, employeeId: slip.employeeId, month } as object,
              },
            })
          })
        }
        return keys
      })

      // ── Step 5: Post salary journal via VoucherEngine ────────────────────
      await step.run('post-journal', async () => {
        const { prisma } = await import('@/lib/prisma')
        const { createVoucher } = await import('@/lib/services/VoucherEngine')
        const { Decimal } = await import('decimal.js')

        // Fetch system ledgers — throw clearly if not seeded
        const [salaryExpenseLedger, pfPayableLedger, esiPayableLedger, ptPayableLedger] = await Promise.all([
          prisma.ledger.findFirst({ where: { companyId, name: 'Salary Expense', isActive: true } }),
          prisma.ledger.findFirst({ where: { companyId, name: 'PF Payable', isActive: true } }),
          prisma.ledger.findFirst({ where: { companyId, name: 'ESI Payable', isActive: true } }),
          prisma.ledger.findFirst({ where: { companyId, name: 'PT Payable', isActive: true } }),
        ])

        if (!salaryExpenseLedger || !pfPayableLedger || !esiPayableLedger || !ptPayableLedger) {
          throw new Error(
            'Payroll system ledgers not found. Run `pnpm prisma db seed` to create ' +
            '"Salary Expense", "PF Payable", "ESI Payable", and "PT Payable" ledgers.'
          )
        }

        // Only include employees with salaryLedgerId in journal (D-11)
        const journalSlips = computedSlips.filter((s) => s.salaryLedgerId)

        // Aggregate totals using Decimal arithmetic (never JS +)
        let totalGross = new Decimal(0)
        let totalEmpPF = new Decimal(0)
        let totalEmrPF = new Decimal(0)
        let totalEmpESI = new Decimal(0)
        let totalEmrESI = new Decimal(0)
        let totalPT = new Decimal(0)

        for (const s of journalSlips) {
          totalGross = totalGross.plus(new Decimal(s.grossEarnings))
          totalEmpPF = totalEmpPF.plus(new Decimal(s.pfEmployee))
          totalEmrPF = totalEmrPF.plus(new Decimal(s.pfEmployer))
          totalEmpESI = totalEmpESI.plus(new Decimal(s.esiEmployee))
          totalEmrESI = totalEmrESI.plus(new Decimal(s.esiEmployer))
          totalPT = totalPT.plus(new Decimal(s.professionalTax))
        }

        // DR = totalGross + employer PF + employer ESI
        const drAmount = totalGross.plus(totalEmrPF).plus(totalEmrESI)

        // Determine journal date: last day of month
        const [y, m] = month.split('-').map(Number)
        const lastDay = new Date(y, m, 0).getDate()
        const journalDate = `${month}-${String(lastDay).padStart(2, '0')}`

        const entries = [
          // DR: Salary Expense
          {
            ledgerId: salaryExpenseLedger.id,
            drCr: 'DR' as const,
            amount: new Decimal(drAmount),
            narration: `Salary expense for ${month}`,
          },
          // CR: each employee net pay
          ...journalSlips.map((s) => ({
            ledgerId: s.salaryLedgerId as string,
            drCr: 'CR' as const,
            amount: new Decimal(s.netPay),
            narration: `Net pay — ${s.employeeName}`,
          })),
          // CR: PF Payable (employee + employer)
          {
            ledgerId: pfPayableLedger.id,
            drCr: 'CR' as const,
            amount: totalEmpPF.plus(totalEmrPF),
            narration: `PF payable for ${month}`,
          },
          // CR: ESI Payable (employee + employer)
          {
            ledgerId: esiPayableLedger.id,
            drCr: 'CR' as const,
            amount: totalEmpESI.plus(totalEmrESI),
            narration: `ESI payable for ${month}`,
          },
          // CR: PT Payable (only when any employee has PT deducted)
          ...(totalPT.gt(0) ? [{
            ledgerId: ptPayableLedger.id,
            drCr: 'CR' as const,
            amount: totalPT,
            narration: `Professional tax payable for ${month}`,
          }] : []),
        ]

        const session = { user: { companyId, id: triggeredBy } }
        await createVoucher(
          {
            voucherType: 'JOURNAL',
            date: journalDate,
            narration: `Salary journal for ${month}`,
            status: 'POSTED',
            entries,
          },
          session
        )

        return { journalPosted: true }
      })

      // ── Step 6: Complete — email + lock attendance ────────────────────────
      await step.run('complete', async () => {
        const { prisma } = await import('@/lib/prisma')
        const { sendEmail } = await import('@/lib/email')
        const { Decimal } = await import('decimal.js')

        // Aggregate totals for completion
        const totalGross = computedSlips.reduce(
          (s, r) => s.plus(new Decimal(r.grossEarnings)),
          new Decimal(0)
        )
        const totalNet = computedSlips.reduce(
          (s, r) => s.plus(new Decimal(r.netPay)),
          new Decimal(0)
        )

        // Update PayRun status COMPLETED
        await prisma.payRun.update({
          where: { id: payRunId },
          data: {
            status: 'COMPLETED',
            totalGross: totalGross.toDecimalPlaces(2),
            totalNet: totalNet.toDecimalPlaces(2),
            completedAt: new Date(),
          },
        })

        // Lock attendance for this month (prevents editing after pay run)
        await prisma.attendanceRecord.updateMany({
          where: { companyId, month },
          data: { lockedAt: new Date() },
        })

        // Fetch admin user email for notification
        const adminUser = await prisma.user.findFirst({
          where: { companyId, isActive: true },
          select: { email: true, name: true },
        })

        if (adminUser) {
          await sendEmail({
            to: adminUser.email,
            subject: `Payroll Completed — ${month}`,
            html: `
              <h2>Pay Run Completed</h2>
              <p>Month: <strong>${month}</strong></p>
              <p>Employees processed: <strong>${computedSlips.length}</strong></p>
              <p>Total Gross: <strong>₹${totalGross.toFixed(2)}</strong></p>
              <p>Total Net Pay: <strong>₹${totalNet.toFixed(2)}</strong></p>
              <p>Pay slips are available in PremGiri Books under Payroll → Pay Run.</p>
            `,
          })
        }

        return { completed: true, totalGross: totalGross.toString(), totalNet: totalNet.toString() }
      })

      return { status: 'COMPLETED', payRunId, month, slipCount: computedSlips.length, slipKeys }

    } catch (err: unknown) {
      // On any failure: mark PayRun FAILED with error message
      try {
        const { prisma } = await import('@/lib/prisma')
        await prisma.payRun.update({
          where: { id: payRunId },
          data: {
            status: 'FAILED',
            errorMessage: err instanceof Error ? err.message : String(err),
          },
        })
      } catch (updateErr) {
        console.error('[payroll.run] Failed to update PayRun status to FAILED:', updateErr)
      }
      throw err  // re-throw so Inngest records the failure and triggers retries
    }
  }
)

export const gstReminderFn = inngest.createFunction(
  { id: 'premgiri/gst.reminder', retries: 2, triggers: [{ cron: '0 9 * * *' }] },
  async ({ step }: { step: { run: <T>(id: string, fn: () => Promise<T>) => Promise<T> } }) => {
    // Step 1: Check if today is 5 days before a GST deadline
    const window = await step.run('check-deadline-window', async () => {
      const today = new Date()
      const day = today.getDate()
      // Day 6 = 5 days before GSTR-1 deadline (11th)
      if (day === 6) return { due: 'GSTR-1' as const, deadlineDay: 11, skip: false }
      // Day 15 = 5 days before GSTR-3B deadline (20th)
      if (day === 15) return { due: 'GSTR-3B' as const, deadlineDay: 20, skip: false }
      return { due: null as null, deadlineDay: null as null, skip: true }
    })

    if (window.skip) return { skip: true, reason: 'not-a-reminder-day' }

    const due = window.due as 'GSTR-1' | 'GSTR-3B'
    const deadlineDay = window.deadlineDay as number

    // Step 2: Compute the return period (previous month MM/YYYY)
    const returnPeriod = await step.run('compute-return-period', async () => {
      const today = new Date()
      const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      return `${String(prevMonth.getMonth() + 1).padStart(2, '0')}/${prevMonth.getFullYear()}`
    })

    // Step 3: Find all companies
    const companies = await step.run('find-companies', async () => {
      const { prisma } = await import('@/lib/prisma')
      return prisma.company.findMany({ select: { id: true, name: true } })
    })

    // Step 4: Process each company — dedup + send
    let sentCount = 0
    let skippedCount = 0

    for (const company of companies) {
      const result = await step.run(`process-${company.id}`, async () => {
        const { prisma } = await import('@/lib/prisma')
        const { render } = await import('@react-email/render')
        const { sendEmail } = await import('@/lib/email')
        const React = await import('react')
        const { GstReminderEmail } = await import('@/lib/services/EmailTemplates')

        // Dedup: skip if already sent today for this deadline + period
        const startOfDay = new Date()
        startOfDay.setHours(0, 0, 0, 0)
        const dup = await prisma.notification.findFirst({
          where: {
            companyId: company.id,
            type: 'GST_REMINDER',
            entityId: `${due}-${returnPeriod}`,
            sentAt: { gte: startOfDay },
          },
        })
        if (dup) return { skipped: true }

        // Find admin user
        const user = await prisma.user.findFirst({
          where: { companyId: company.id, isActive: true },
          select: { email: true, name: true },
        })
        if (!user) return { skipped: true }

        // Compute due date string
        const today = new Date()
        const dueDate = new Date(today.getFullYear(), today.getMonth(), deadlineDay)
        const dueDateStr = dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

        // Render email
        const html = await render(
          React.default.createElement(GstReminderEmail, {
            companyName: company.name,
            deadline: due,
            dueDate: dueDateStr,
            daysLeft: 5,
            returnPeriod,
          })
        )

        // Send email
        await sendEmail({
          to: user.email,
          subject: `${due} reminder — due in 5 days`,
          html,
        })

        // Record notification for dedup
        await prisma.notification.create({
          data: {
            companyId: company.id,
            type: 'GST_REMINDER',
            entityId: `${due}-${returnPeriod}`,
            recipientEmail: user.email,
            metadata: { dueDate: dueDateStr, daysLeft: 5 },
          },
        })

        return { skipped: false }
      })

      if (result.skipped) {
        skippedCount++
      } else {
        sentCount++
      }
    }

    return { sentCount, skippedCount, returnPeriod, due }
  }
)

export const overdueReminderFn = inngest.createFunction(
  { id: 'premgiri/overdue.reminder', retries: 2, triggers: [{ cron: '0 8 * * *' }] },
  async ({ step }: { step: { run: <T>(id: string, fn: () => Promise<T>) => Promise<T> } }) => {
    // Step 1: Compute target dates for 30/60/90 day buckets
    const targetDates = await step.run('compute-target-dates', async () => {
      const buckets = [30, 60, 90] as const
      return buckets.map((days) => {
        const start = new Date()
        start.setDate(start.getDate() - days)
        start.setHours(0, 0, 0, 0)
        const end = new Date(start)
        end.setHours(23, 59, 59, 999)
        return { days, start: start.toISOString(), end: end.toISOString() }
      })
    })

    // Step 2: Find overdue BillRef rows for each bucket
    const overdueBatches = await step.run('find-overdue-batches', async () => {
      const { prisma } = await import('@/lib/prisma')
      const results: Array<{
        days: number
        companyId: string
        billNo: string
        partyName: string
        outstandingAmount: string
      }> = []

      for (const { days, start, end } of targetDates) {
        const rows = await prisma.billRef.findMany({
          where: {
            settled: false,
            outstandingAmount: { gt: 0 },
            billDate: { gte: new Date(start), lte: new Date(end) },
          },
          include: {
            voucher: { select: { voucherNo: true, partyLedger: { select: { name: true } } } },
            ledger: { select: { name: true } },
          },
        })
        for (const row of rows) {
          results.push({
            days,
            companyId: row.companyId,
            billNo: row.billNo,
            partyName: row.voucher?.partyLedger?.name ?? row.ledger.name,
            outstandingAmount: row.outstandingAmount.toString(),
          })
        }
      }
      return results
    })

    // Step 3: Group by companyId + daysBucket
    const grouped = await step.run('group-by-company', async () => {
      const map: Record<string, typeof overdueBatches> = {}
      for (const row of overdueBatches) {
        const key = `${row.companyId}::${row.days}`
        if (!map[key]) map[key] = []
        map[key].push(row)
      }
      return map
    })

    // Step 4: Process each (company, daysBucket) group
    let sentCount = 0
    let skippedCount = 0

    for (const [key, rows] of Object.entries(grouped)) {
      const [companyId, daysStr] = key.split('::')
      const daysBucket = parseInt(daysStr, 10) as 30 | 60 | 90

      const result = await step.run(`process-${companyId}-${daysBucket}`, async () => {
        const { prisma } = await import('@/lib/prisma')
        const { render } = await import('@react-email/render')
        const { sendEmail } = await import('@/lib/email')
        const React = await import('react')
        const { OverdueReminderEmail } = await import('@/lib/services/EmailTemplates')
        const { formatINR } = await import('@/lib/utils/format')

        const startOfDay = new Date()
        startOfDay.setHours(0, 0, 0, 0)

        // Dedup check
        const dup = await prisma.notification.findFirst({
          where: {
            companyId,
            type: 'OVERDUE_PAYMENT',
            entityId: `bucket-${daysBucket}`,
            sentAt: { gte: startOfDay },
          },
        })
        if (dup) return { skipped: true }

        // Find admin user
        const user = await prisma.user.findFirst({
          where: { companyId, isActive: true },
          select: { email: true, name: true },
        })
        if (!user) return { skipped: true }

        const company = await prisma.company.findUnique({
          where: { id: companyId },
          select: { name: true },
        })
        if (!company) return { skipped: true }

        // Build invoices array
        const invoices = rows.map((row) => ({
          billNo: row.billNo,
          partyName: row.partyName,
          amount: formatINR(parseFloat(row.outstandingAmount)),
          daysOverdue: daysBucket,
        }))

        // Render and send
        const html = await render(
          React.default.createElement(OverdueReminderEmail, {
            companyName: company.name,
            invoices,
          })
        )

        await sendEmail({
          to: user.email,
          subject: `Overdue payment reminder — ${daysBucket} days`,
          html,
        })

        await prisma.notification.create({
          data: {
            companyId,
            type: 'OVERDUE_PAYMENT',
            entityId: `bucket-${daysBucket}`,
            recipientEmail: user.email,
            metadata: { daysBucket, invoiceCount: invoices.length },
          },
        })

        return { skipped: false }
      })

      if (result.skipped) {
        skippedCount++
      } else {
        sentCount++
      }
    }

    return { sentCount, skippedCount, bucketsProcessed: Object.keys(grouped).length }
  }
)

export const payrollReminderFn = inngest.createFunction(
  { id: 'premgiri/payroll.reminder', retries: 2, triggers: [{ cron: '0 9 25 * *' }] },
  async ({ step }: { step: { run: <T>(id: string, fn: () => Promise<T>) => Promise<T> } }) => {
    // Step 1: Compute month label
    const { monthLabel, monthCode } = await step.run('compute-month-label', async () => {
      const now = new Date()
      const label = now.toLocaleString('en-IN', { month: 'long', year: 'numeric' })
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      return { monthLabel: label, monthCode: `${year}-${month}` }
    })

    // Step 2: Find companies with active payroll-eligible employees
    const companies = await step.run('find-companies-with-employees', async () => {
      const { prisma } = await import('@/lib/prisma')
      return prisma.company.findMany({
        where: {
          employees: { some: { isActive: true, salaryStructureId: { not: null } } },
        },
        select: { id: true, name: true },
      })
    })

    // Step 3: Process each company — dedup + send
    let sentCount = 0
    let skippedCount = 0

    for (const company of companies) {
      const result = await step.run(`process-${company.id}`, async () => {
        const { prisma } = await import('@/lib/prisma')
        const { render } = await import('@react-email/render')
        const { sendEmail } = await import('@/lib/email')
        const React = await import('react')
        const { PayrollReminderEmail } = await import('@/lib/services/EmailTemplates')

        // Dedup: scope to entire month (cron fires once per month)
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)

        const dup = await prisma.notification.findFirst({
          where: {
            companyId: company.id,
            type: 'PAYROLL_REMINDER',
            entityId: monthCode,
            sentAt: { gte: startOfMonth },
          },
        })
        if (dup) return { skipped: true }

        // Find admin user
        const user = await prisma.user.findFirst({
          where: { companyId: company.id, isActive: true },
          select: { email: true, name: true },
        })
        if (!user) return { skipped: true }

        // Render and send
        const html = await render(
          React.default.createElement(PayrollReminderEmail, {
            companyName: company.name,
            monthLabel,
          })
        )

        await sendEmail({
          to: user.email,
          subject: `Payroll reminder — ${monthLabel}`,
          html,
        })

        await prisma.notification.create({
          data: {
            companyId: company.id,
            type: 'PAYROLL_REMINDER',
            entityId: monthCode,
            recipientEmail: user.email,
            metadata: { monthLabel, monthCode },
          },
        })

        return { skipped: false }
      })

      if (result.skipped) {
        skippedCount++
      } else {
        sentCount++
      }
    }

    return { sentCount, skippedCount, monthLabel, monthCode }
  }
)

export const embeddingsRefreshFn = inngest.createFunction(
  { id: 'premgiri/embeddings.refresh', retries: 5, triggers: [{ event: 'premgiri/embeddings.refresh' }] },
  async ({
    event,
    step,
  }: {
    event: {
      data:
        | { entityType?: 'ledger' | 'voucher'; entityId?: string; companyId?: string }
        | undefined
    }
    step: {
      run: <T>(id: string, fn: () => Promise<T>) => Promise<T>
    }
  }) => {
    const startMs = Date.now()
    const { buildLedgerEmbedText, buildVoucherEmbedText, embedBatch, persistEmbedding } =
      await import('@/lib/services/EmbeddingService')

    const eventData = event.data ?? {}
    const { entityType, entityId, companyId } = eventData as {
      entityType?: 'ledger' | 'voucher'
      entityId?: string
      companyId?: string
    }

    // ── Mode A: Incremental — embed exactly one record ───────────────────────
    if (entityType && entityId) {
      const table = entityType === 'ledger' ? 'ledgers' : 'vouchers'

      // Step 1: Load entity
      const entity = await step.run('load-entity', async () => {
        const { prisma } = await import('@/lib/prisma')
        if (entityType === 'ledger') {
          return prisma.ledger.findUniqueOrThrow({
            where: { id: entityId },
            select: { id: true, name: true, gstin: true, group: { select: { name: true } } },
          })
        } else {
          return prisma.voucher.findUniqueOrThrow({
            where: { id: entityId },
            select: {
              id: true,
              voucherNo: true,
              narration: true,
              partyLedger: { select: { name: true } },
            },
          })
        }
      })

      // Step 2: Build embed text
      const text = await step.run('build-text', async () => {
        if (entityType === 'ledger') {
          const l = entity as { id: string; name: string; gstin: string | null; group: { name: string } }
          return buildLedgerEmbedText(l)
        } else {
          const v = entity as {
            id: string
            voucherNo: string
            narration: string | null
            partyLedger: { name: string } | null
          }
          return buildVoucherEmbedText(v)
        }
      })

      // Step 3: Embed via Voyage AI
      const vector = await step.run('embed', async () => {
        const results = await embedBatch([text])
        return results[0]
      })

      // Step 4: Persist to DB
      await step.run('persist', async () => {
        await persistEmbedding(table, entityId, vector)
        return { persisted: true }
      })

      return { mode: 'incremental', entityType, entityId, status: 'embedded' }
    }

    // ── Mode B: Bulk — process all NULL embeddings in batches of 50 ─────────
    const BATCH_SIZE = 50

    // Step 1: Count pending records
    const pending = await step.run('count-pending', async () => {
      const { prisma } = await import('@/lib/prisma')
      // $queryRaw returns array of rows; COUNT cast to text for safe JSON serialization
      let ledgerCount = 0
      let voucherCount = 0

      if (companyId) {
        const ledgerRows = await prisma.$queryRaw<[{ count: string }]>`
          SELECT COUNT(*)::text AS count FROM ledgers
          WHERE embedding IS NULL AND "companyId" = ${companyId}
        `
        const voucherRows = await prisma.$queryRaw<[{ count: string }]>`
          SELECT COUNT(*)::text AS count FROM vouchers
          WHERE embedding IS NULL AND "companyId" = ${companyId}
        `
        ledgerCount = parseInt(ledgerRows[0].count, 10)
        voucherCount = parseInt(voucherRows[0].count, 10)
      } else {
        const ledgerRows = await prisma.$queryRaw<[{ count: string }]>`
          SELECT COUNT(*)::text AS count FROM ledgers WHERE embedding IS NULL
        `
        const voucherRows = await prisma.$queryRaw<[{ count: string }]>`
          SELECT COUNT(*)::text AS count FROM vouchers WHERE embedding IS NULL
        `
        ledgerCount = parseInt(ledgerRows[0].count, 10)
        voucherCount = parseInt(voucherRows[0].count, 10)
      }

      return { ledgerCount, voucherCount }
    })

    console.log(
      `[embeddings.refresh] Bulk mode — ${pending.ledgerCount} ledgers, ${pending.voucherCount} vouchers pending`
    )

    const ledgerBatchCount = Math.ceil(pending.ledgerCount / BATCH_SIZE)
    const voucherBatchCount = Math.ceil(pending.voucherCount / BATCH_SIZE)
    let ledgersEmbedded = 0
    let vouchersEmbedded = 0

    // Step 2: Process ledgers in batches of 50 (sequential — D-12 rate limit)
    for (let i = 0; i < ledgerBatchCount; i++) {
      const batchEmbedded = await step.run(`ledger-batch-${i}`, async () => {
        const { prisma } = await import('@/lib/prisma')

        const whereClause: Record<string, unknown> = { embedding: null }
        if (companyId) whereClause.companyId = companyId

        const ledgers = await prisma.ledger.findMany({
          where: whereClause,
          select: { id: true, name: true, gstin: true, group: { select: { name: true } } },
          skip: i * BATCH_SIZE,
          take: BATCH_SIZE,
          orderBy: { createdAt: 'asc' },
        })

        if (ledgers.length === 0) return { batch: i, embedded: 0, table: 'ledgers' }

        const texts = ledgers.map((l) =>
          buildLedgerEmbedText({
            name: l.name,
            gstin: l.gstin,
            group: l.group,
          })
        )

        // One Voyage API call per batch (D-12 sequential, no Promise.all)
        const vectors = await embedBatch(texts)

        for (let j = 0; j < ledgers.length; j++) {
          await persistEmbedding('ledgers', ledgers[j].id, vectors[j])
        }

        console.log(
          `[embeddings.refresh] Ledger batch ${i + 1}/${ledgerBatchCount} — ${ledgers.length} embedded`
        )
        return { batch: i, embedded: ledgers.length, table: 'ledgers' }
      })
      ledgersEmbedded += batchEmbedded.embedded
    }

    // Step 3: Process vouchers in batches of 50 (sequential — D-12 rate limit)
    for (let i = 0; i < voucherBatchCount; i++) {
      const batchEmbedded = await step.run(`voucher-batch-${i}`, async () => {
        const { prisma } = await import('@/lib/prisma')

        const whereClause: Record<string, unknown> = { embedding: null }
        if (companyId) whereClause.companyId = companyId

        const vouchers = await prisma.voucher.findMany({
          where: whereClause,
          select: {
            id: true,
            voucherNo: true,
            narration: true,
            partyLedger: { select: { name: true } },
          },
          skip: i * BATCH_SIZE,
          take: BATCH_SIZE,
          orderBy: { createdAt: 'asc' },
        })

        if (vouchers.length === 0) return { batch: i, embedded: 0, table: 'vouchers' }

        const texts = vouchers.map((v) =>
          buildVoucherEmbedText({
            voucherNo: v.voucherNo,
            narration: v.narration,
            partyLedger: v.partyLedger,
          })
        )

        // One Voyage API call per batch (D-12 sequential, no Promise.all)
        const vectors = await embedBatch(texts)

        for (let j = 0; j < vouchers.length; j++) {
          await persistEmbedding('vouchers', vouchers[j].id, vectors[j])
        }

        console.log(
          `[embeddings.refresh] Voucher batch ${i + 1}/${voucherBatchCount} — ${vouchers.length} embedded`
        )
        return { batch: i, embedded: vouchers.length, table: 'vouchers' }
      })
      vouchersEmbedded += batchEmbedded.embedded
    }

    // Step 4: Verify — re-check NULL count for observability
    let remainingAfter: { ledgerCount: number; voucherCount: number } = { ledgerCount: 0, voucherCount: 0 }
    try {
      remainingAfter = await step.run('verify', async () => {
        const { prisma } = await import('@/lib/prisma')
        let remainingLedgers = 0
        let remainingVouchers = 0

        if (companyId) {
          const lRows = await prisma.$queryRaw<[{ count: string }]>`
            SELECT COUNT(*)::text AS count FROM ledgers
            WHERE embedding IS NULL AND "companyId" = ${companyId}
          `
          const vRows = await prisma.$queryRaw<[{ count: string }]>`
            SELECT COUNT(*)::text AS count FROM vouchers
            WHERE embedding IS NULL AND "companyId" = ${companyId}
          `
          remainingLedgers = parseInt(lRows[0].count, 10)
          remainingVouchers = parseInt(vRows[0].count, 10)
        } else {
          const lRows = await prisma.$queryRaw<[{ count: string }]>`
            SELECT COUNT(*)::text AS count FROM ledgers WHERE embedding IS NULL
          `
          const vRows = await prisma.$queryRaw<[{ count: string }]>`
            SELECT COUNT(*)::text AS count FROM vouchers WHERE embedding IS NULL
          `
          remainingLedgers = parseInt(lRows[0].count, 10)
          remainingVouchers = parseInt(vRows[0].count, 10)
        }

        if (remainingLedgers > 0 || remainingVouchers > 0) {
          console.warn(
            `[embeddings.refresh] Verify: ${remainingLedgers} ledgers + ${remainingVouchers} vouchers still NULL ` +
              '(rows created during job run — schedule another refresh)'
          )
        }
        return { ledgerCount: remainingLedgers, voucherCount: remainingVouchers }
      })
    } catch (err: unknown) {
      console.error('[embeddings.refresh] verify step failed:', err)
    }

    const durationMs = Date.now() - startMs
    return {
      mode: 'bulk',
      ledgersEmbedded,
      vouchersEmbedded,
      remainingNullLedgers: remainingAfter.ledgerCount,
      remainingNullVouchers: remainingAfter.voucherCount,
      durationMs,
    }
  }
)

export const emailSendFn = inngest.createFunction(
  { id: 'premgiri/email.send', retries: 3, triggers: [{ event: 'premgiri/email.send' }] },
  async ({ event }: { event: { data: { to: string; subject: string; html: string } } }) => {
    const { to, subject, html } = event.data
    const { sendEmail } = await import('@/lib/email')
    await sendEmail({ to, subject, html })
    return { status: 'sent', to }
  }
)

export const allFunctions = [
  healthCheckFn,
  payrollRunFn,
  gstReminderFn,
  overdueReminderFn,
  payrollReminderFn,
  embeddingsRefreshFn,
  emailSendFn,
]
