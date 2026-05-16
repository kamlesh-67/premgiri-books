/**
 * GET /api/v1/pay-runs/[id]  — run detail + pay slip list
 */
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.user.companyId
  const { id } = await params

  const run = await prisma.payRun.findFirst({
    where: { id, companyId },
    include: {
      paySlips: {
        include: {
          employee: { select: { id: true, name: true, employeeCode: true, designation: true } },
        },
        orderBy: { employee: { name: 'asc' } },
      },
    },
  })

  if (!run) return NextResponse.json({ error: 'Pay run not found' }, { status: 404 })

  return NextResponse.json({
    ...run,
    totalGross: run.totalGross?.toString() ?? null,
    totalNet: run.totalNet?.toString() ?? null,
    paySlips: run.paySlips.map((slip) => ({
      ...slip,
      grossEarnings: slip.grossEarnings.toString(),
      totalDeductions: slip.totalDeductions.toString(),
      netPay: slip.netPay.toString(),
      pfEmployee: slip.pfEmployee.toString(),
      pfEmployer: slip.pfEmployer.toString(),
      esiEmployee: slip.esiEmployee.toString(),
      esiEmployer: slip.esiEmployer.toString(),
      professionalTax: slip.professionalTax.toString(),
    })),
  })
}
