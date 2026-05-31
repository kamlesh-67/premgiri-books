/**
 * POST /api/v1/pay-runs/[id]/process
 *
 * Dev-only synchronous payroll processor — bypasses Inngest for local testing.
 * Runs the same logic as payrollRunFn inline. Blocked in production.
 */
import { getSessionFromRequest } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import Decimal from 'decimal.js'
import { computePaySlip } from '@/lib/services/PayrollEngine'
import { createVoucher } from '@/lib/services/VoucherEngine'

type Params = { params: Promise<{ id: string }> }

export async function POST((request: NextRequest), { params }: Params) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.companyId
  const { id: payRunId } = await params

  const payRun = await prisma.payRun.findFirst({ where: { id: payRunId, companyId } })
  if (!payRun) return NextResponse.json({ error: 'Pay run not found' }, { status: 404 })

  const { month } = payRun

  // Mark PROCESSING
  await prisma.payRun.update({ where: { id: payRunId }, data: { status: 'PROCESSING' } })
  await prisma.attendanceRecord.updateMany({ where: { companyId, month }, data: { lockedAt: null } })

  try {
    // Load employees
    const employees = await prisma.employee.findMany({
      where: { companyId, isActive: true, salaryStructureId: { not: null } },
      include: { salaryStructure: true },
    })

    const attRecords = await prisma.attendanceRecord.findMany({ where: { companyId, month } })
    const attMap: Record<string, { presentDays: string; halfDays: number; leaveDays: number }> = {}
    for (const r of attRecords) {
      attMap[r.employeeId] = { presentDays: r.presentDays.toString(), halfDays: r.halfDays, leaveDays: r.leaveDays }
    }

    // Compute pay slips
    const computedSlips = []
    for (const emp of employees) {
      if (!emp.salaryStructure) continue
      const attendance = attMap[emp.id] ?? { presentDays: '26', halfDays: 0, leaveDays: 0 }
      const structure = {
        id: emp.salaryStructure.id,
        name: emp.salaryStructure.name,
        components: emp.salaryStructure.components as Array<{ name: string; type: 'earning' | 'deduction'; formula?: string; amount?: string; order: number }>,
      }
      const computed = computePaySlip(
        { id: emp.id, name: emp.name, employeeCode: emp.employeeCode, pfApplicable: emp.pfApplicable, esiApplicable: emp.esiApplicable, salaryLedgerId: emp.salaryLedgerId },
        structure, attendance, month
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
        // JSON round-trip converts all Decimal values inside computedData to strings
        computedData: JSON.parse(JSON.stringify(computed.computedData)),
      })
    }

    // Persist PaySlip rows (PDF skipped in dev-sync mode)
    for (const slip of computedSlips) {
      // PDF generation skipped in dev-sync mode — react-pdf conflicts with Next.js API route renderer.
      // In production, Inngest step 4 handles PDF generation correctly via dynamic imports in isolated context.
      const r2Key: string | null = null

      const slipData = {
        companyId, payRunId, employeeId: slip.employeeId, month,
        grossEarnings: slip.grossEarnings, totalDeductions: slip.totalDeductions, netPay: slip.netPay,
        pfEmployee: slip.pfEmployee, pfEmployer: slip.pfEmployer,
        esiEmployee: slip.esiEmployee, esiEmployer: slip.esiEmployer,
        professionalTax: slip.professionalTax,
        computedData: slip.computedData as object,
        pdfKey: r2Key,
      }
      await prisma.$transaction(async (tx) => {
        const record = await tx.paySlip.upsert({
          where: { payRunId_employeeId: { payRunId, employeeId: slip.employeeId } },
          create: slipData,
          update: { grossEarnings: slip.grossEarnings, totalDeductions: slip.totalDeductions, netPay: slip.netPay, pfEmployee: slip.pfEmployee, pfEmployer: slip.pfEmployer, esiEmployee: slip.esiEmployee, esiEmployer: slip.esiEmployer, professionalTax: slip.professionalTax, computedData: slip.computedData as object, pdfKey: r2Key },
        })
        await tx.auditLog.create({
          data: { companyId, userId: session.userId, entity: 'PaySlip', entityId: record.id, action: 'CREATE', newValue: { payRunId, month } as object },
        })
      })
    }

    // Post salary journal
    const journalSlips = computedSlips.filter((s) => s.salaryLedgerId)
    if (journalSlips.length > 0) {
      const [salaryExpenseLedger, pfPayableLedger, esiPayableLedger, ptPayableLedger] = await Promise.all([
        prisma.ledger.findFirst({ where: { companyId, name: 'Salary Expense', isActive: true } }),
        prisma.ledger.findFirst({ where: { companyId, name: 'PF Payable', isActive: true } }),
        prisma.ledger.findFirst({ where: { companyId, name: 'ESI Payable', isActive: true } }),
        prisma.ledger.findFirst({ where: { companyId, name: 'PT Payable', isActive: true } }),
      ])

      if (salaryExpenseLedger && pfPayableLedger && esiPayableLedger && ptPayableLedger) {
        let totalGross = new Decimal(0), totalEmpPF = new Decimal(0), totalEmrPF = new Decimal(0)
        let totalEmpESI = new Decimal(0), totalEmrESI = new Decimal(0), totalPT = new Decimal(0)
        for (const s of journalSlips) {
          totalGross = totalGross.plus(s.grossEarnings)
          totalEmpPF = totalEmpPF.plus(s.pfEmployee)
          totalEmrPF = totalEmrPF.plus(s.pfEmployer)
          totalEmpESI = totalEmpESI.plus(s.esiEmployee)
          totalEmrESI = totalEmrESI.plus(s.esiEmployer)
          totalPT = totalPT.plus(s.professionalTax)
        }

        const drAmount = totalGross.plus(totalEmrPF).plus(totalEmrESI)
        const [y, m] = month.split('-').map(Number)
        const lastDay = new Date(y, m, 0).getDate()
        const journalDate = `${month}-${String(lastDay).padStart(2, '0')}`

        const entries = [
          { ledgerId: salaryExpenseLedger.id, drCr: 'DR' as const, amount: drAmount, narration: `Salary expense for ${month}` },
          ...journalSlips.map((s) => ({ ledgerId: s.salaryLedgerId as string, drCr: 'CR' as const, amount: new Decimal(s.netPay), narration: `Net pay — ${s.employeeName}` })),
          { ledgerId: pfPayableLedger.id, drCr: 'CR' as const, amount: totalEmpPF.plus(totalEmrPF), narration: `PF payable for ${month}` },
          { ledgerId: esiPayableLedger.id, drCr: 'CR' as const, amount: totalEmpESI.plus(totalEmrESI), narration: `ESI payable for ${month}` },
          ...(totalPT.gt(0) ? [{ ledgerId: ptPayableLedger.id, drCr: 'CR' as const, amount: totalPT, narration: `Professional tax payable for ${month}` }] : []),
        ]

        await createVoucher(
          { voucherType: 'JOURNAL', date: journalDate, narration: `Salary journal for ${month}`, status: 'POSTED', entries },
          session
        )
      }
    }

    // Complete
    const totalGross = computedSlips.reduce((s, r) => s.plus(r.grossEarnings), new Decimal(0))
    const totalNet = computedSlips.reduce((s, r) => s.plus(r.netPay), new Decimal(0))

    await prisma.payRun.update({
      where: { id: payRunId },
      data: { status: 'COMPLETED', totalGross: totalGross.toDecimalPlaces(2), totalNet: totalNet.toDecimalPlaces(2), completedAt: new Date() },
    })
    await prisma.attendanceRecord.updateMany({ where: { companyId, month }, data: { lockedAt: new Date() } })

    return NextResponse.json({ status: 'COMPLETED', slipCount: computedSlips.length })

  } catch (err) {
    await prisma.payRun.update({
      where: { id: payRunId },
      data: { status: 'FAILED', errorMessage: err instanceof Error ? err.message : String(err) },
    })
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
