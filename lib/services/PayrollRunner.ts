/**
 * lib/services/PayrollRunner.ts
 *
 * Synchronous payroll pipeline — extracted from lib/inngest.ts payrollRunFn.
 * Inngest removed in Phase 21 (CLOUD-01). This file replaces the cloud-based
 * background job with a plain async function called directly from the API route.
 *
 * Payslip PDFs are written to the local filesystem via writeLocalFile (no R2).
 * Email notification removed — replaced with console.log.
 */

import { prisma, type TransactionClient } from '@/lib/prisma'
import { writeLocalFile, buildPayslipFilename } from '@/lib/localFiles'
import { Decimal } from 'decimal.js'

export async function runPayroll(
  payRunId: string,
  companyId: string,
  month: string,
  triggeredBy: string
): Promise<{ status: string; payRunId: string; month: string; slipCount: number }> {
  try {
    // ── Step 1: Mark PROCESSING (unlock attendance on re-run) ─────────────
    // Unlock attendance so we can re-lock after fresh computation (D-09)
    await prisma.attendanceRecord.updateMany({
      where: { companyId, month },
      data: { lockedAt: null },
    })
    await prisma.payRun.update({
      where: { id: payRunId },
      data: { status: 'PROCESSING' },
    })

    // ── Step 2: Load employees + attendance data ───────────────────────────
    const employees = await prisma.employee.findMany({
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
    const attendanceMap: Record<string, { presentDays: string; halfDays: number; leaveDays: number }> = {}
    for (const r of attRecords) {
      attendanceMap[r.employeeId] = {
        presentDays: r.presentDays.toString(),
        halfDays: r.halfDays,
        leaveDays: r.leaveDays,
      }
    }

    // ── Step 3: Compute pay slips ─────────────────────────────────────────
    const { computePaySlip } = await import('@/lib/services/PayrollEngine')
    const computedSlips = []

    for (const emp of employees) {
      if (!emp.salaryStructure) continue

      // D-11: log warning for employees without salaryLedgerId
      if (!emp.salaryLedgerId) {
        // Employee excluded from journal — no salary ledger linked
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
      computedSlips.push({
        ...computed,
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

    // ── Step 4: Persist pay slips + write PDFs to local filesystem ────────
    const { renderToBuffer } = await import('@react-pdf/renderer')
    const { PaySlipPDF } = await import('@/lib/services/PDFTemplates/PaySlipPDF')

    // Same React 19 canary → React 18 reconciler $$typeof bridge as the PDF route.
    const TRANSITIONAL = Symbol.for('react.transitional.element')
    const STABLE = Symbol.for('react.element')
    function patchElement(el: unknown): unknown {
      if (el === null || el === undefined || typeof el !== 'object') return el
      if (Array.isArray(el)) return el.map(patchElement)
      const obj = el as Record<string, unknown>
      if (obj['$$typeof'] !== TRANSITIONAL) return el
      const patched: Record<string, unknown> = { ...obj, '$$typeof': STABLE }
      if (patched.props && typeof patched.props === 'object') {
        const props = patched.props as Record<string, unknown>
        patched.props = { ...props, children: patchElement(props.children) }
      }
      return patched
    }

    const company = await prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { name: true, gstin: true, address: true, logoUrl: true },
    })

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
        ].filter((d) => new Decimal(String(d.amount || '0')).toNumber() > 0),
        grossEarnings: slip.grossEarnings,
        totalDeductions: slip.totalDeductions,
        netPay: slip.netPay,
        employerContributions: { pfEmployer: slip.pfEmployer, esiEmployer: slip.esiEmployer },
      }

      const rawElement = PaySlipPDF({ data: pdfData })
      const element = patchElement(rawElement) as import('react').ReactElement
      const buffer = await renderToBuffer(element)

      // Write to local filesystem (no R2 — CLOUD-01)
      const filename = buildPayslipFilename(companyId, slip.employeeId, month)
      const filePath = await writeLocalFile(filename, Buffer.from(buffer))

      // Upsert PaySlip (soft-safe re-run — never hard-delete financial records)
      await prisma.$transaction(async (tx: TransactionClient) => {
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
          pdfKey: filePath,
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
            pdfKey: filePath,
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

    // ── Step 5: Post salary journal via VoucherEngine ────────────────────
    const { createVoucher } = await import('@/lib/services/VoucherEngine')

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

    // Verify double-entry balance before creating voucher (CLAUDE.md rule #3)
    const totalCR = journalSlips
      .reduce((s, sl) => s.plus(new Decimal(sl.netPay)), new Decimal(0))
      .plus(totalEmpPF).plus(totalEmrPF)
      .plus(totalEmpESI).plus(totalEmrESI)
      .plus(totalPT)
    if (!drAmount.equals(totalCR)) {
      throw new Error(
        `Payroll journal is unbalanced: DR=${drAmount.toFixed(2)} CR=${totalCR.toFixed(2)} for month ${month}`
      )
    }

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

    const session = { companyId, userId: triggeredBy }
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

    // ── Step 6: Complete — lock attendance + update PayRun status ─────────
    const totalGrossAgg = computedSlips.reduce(
      (s, r) => s.plus(new Decimal(r.grossEarnings)),
      new Decimal(0)
    )
    const totalNetAgg = computedSlips.reduce(
      (s, r) => s.plus(new Decimal(r.netPay)),
      new Decimal(0)
    )

    // Update PayRun status COMPLETED
    await prisma.payRun.update({
      where: { id: payRunId },
      data: {
        status: 'COMPLETED',
        totalGross: totalGrossAgg.toDecimalPlaces(2),
        totalNet: totalNetAgg.toDecimalPlaces(2),
        completedAt: new Date(),
      },
    })

    // Lock attendance for this month (prevents editing after pay run)
    await prisma.attendanceRecord.updateMany({
      where: { companyId, month },
      data: { lockedAt: new Date() },
    })

    return { status: 'COMPLETED', payRunId, month, slipCount: computedSlips.length }

  } catch (err: unknown) {
    // On any failure: mark PayRun FAILED with error message
    try {
      await prisma.payRun.update({
        where: { id: payRunId },
        data: {
          status: 'FAILED',
          errorMessage: err instanceof Error ? err.message : String(err),
        },
      })
    } catch (updateErr) {
      console.error('[PayrollRunner] Failed to update PayRun status to FAILED:', updateErr)
    }
    throw err
  }
}
