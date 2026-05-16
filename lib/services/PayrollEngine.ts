/**
 * PayrollEngine.ts
 *
 * Pure computation service for Indian payroll calculations.
 * No Prisma, no HTTP — safe to unit-test in isolation.
 *
 * Statutory rules implemented:
 *  - PF: 12% of Basic, capped at Basic ₹15,000 → max PF ₹1,800 each (D-08)
 *  - ESI: emp 0.75% / employer 3.25% of gross; skip if gross > ₹21,000 (D-08)
 *  - Professional Tax: Maharashtra slab; Feb = ₹300 for >₹10,000 bracket (Claude's Discretion)
 *  - Proration: effectiveDays = presentDays + halfDays×0.5 + leaveDays; basis 26 days (D-07)
 *  - Formula: "N% of ComponentName" resolved in component.order sequence (D-02)
 */

import { Decimal } from 'decimal.js'

// ── Error class ──────────────────────────────────────────────────────────────

export class PayrollValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PayrollValidationError'
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface SalaryComponent {
  name: string
  type: 'earning' | 'deduction'
  formula?: string
  amount?: string     // fixed amount; stored as string to avoid JSON float precision loss
  order: number
}

export interface AttendanceInput {
  presentDays: string | number | Decimal
  halfDays: number
  leaveDays: number
}

export interface EmployeeInput {
  id: string
  name: string
  employeeCode: string
  pfApplicable: boolean
  esiApplicable: boolean
  salaryLedgerId: string | null
}

export interface StructureInput {
  id: string
  name: string
  components: SalaryComponent[]
}

export interface PaySlipComputed {
  employeeId: string
  employeeName: string
  employeeCode: string
  salaryLedgerId: string | null
  month: string
  grossEarnings: Decimal
  pfEmployee: Decimal
  pfEmployer: Decimal
  esiEmployee: Decimal
  esiEmployer: Decimal
  professionalTax: Decimal
  totalDeductions: Decimal
  netPay: Decimal
  computedData: {
    components: Array<{ name: string; type: 'earning' | 'deduction'; computed: string }>
    attendance: { presentDays: string; halfDays: number; leaveDays: number; effectiveDays: string }
    statutory: { pfEmployee: string; pfEmployer: string; esiEmployee: string; esiEmployer: string; professionalTax: string }
  }
}

// ── Formula resolver ─────────────────────────────────────────────────────────

/**
 * Resolve a formula string against already-computed component values.
 * Supported pattern: "N% of ComponentName"
 */
export function resolveFormula(formula: string, resolved: Record<string, Decimal>): Decimal {
  const match = formula.trim().match(/^(\d+(?:\.\d+)?)%\s+of\s+(.+)$/)
  if (!match) {
    throw new PayrollValidationError(
      `Invalid formula syntax: "${formula}". Expected format: "N% of ComponentName"`
    )
  }
  const pct = new Decimal(match[1])
  const componentName = match[2].trim()
  if (!(componentName in resolved)) {
    throw new PayrollValidationError(
      `Formula references unknown component "${componentName}" in formula: "${formula}". ` +
      `Available: ${Object.keys(resolved).join(', ')}`
    )
  }
  return resolved[componentName].mul(pct).dividedBy(new Decimal(100))
}

// ── Component computation ────────────────────────────────────────────────────

/**
 * Resolve all components in order, expanding formulas against earlier results.
 * Returns a map of component name → computed Decimal value.
 */
export function computeComponents(
  components: SalaryComponent[],
  attendance: AttendanceInput
): Record<string, Decimal> {
  const sorted = [...components].sort((a, b) => a.order - b.order)
  const resolved: Record<string, Decimal> = {}

  for (const c of sorted) {
    let raw: Decimal
    if (c.formula) {
      raw = resolveFormula(c.formula, resolved)
    } else if (c.amount !== undefined && c.amount !== null) {
      raw = new Decimal(c.amount)
    } else {
      throw new PayrollValidationError(
        `Component "${c.name}" has neither formula nor amount`
      )
    }
    // Prorate flat-amount earnings only. Formula-derived earnings already resolve
    // against prorated values (e.g. HRA = 40% of prorated Basic), so prorating
    // them again would double-count the attendance factor.
    if (c.type === 'earning' && !c.formula) {
      raw = prorateSalary(raw, attendance.presentDays, attendance.halfDays, attendance.leaveDays)
    }
    resolved[c.name] = raw
  }

  return resolved
}

// ── Proration ────────────────────────────────────────────────────────────────

/**
 * Calculate earned salary component based on effective working days.
 * effectiveDays = presentDays + halfDays×0.5 + leaveDays (D-07)
 * dailyRate = monthlySalary / 26
 */
export function prorateSalary(
  monthlySalary: Decimal | string | number,
  presentDays: Decimal | string | number,
  halfDays: number,
  leaveDays: number
): Decimal {
  const salary = new Decimal(monthlySalary.toString())
  const present = new Decimal(presentDays.toString())
  const half = new Decimal(halfDays).mul(new Decimal('0.5'))
  const leave = new Decimal(leaveDays)
  const effectiveDays = present.plus(half).plus(leave)
  const dailyRate = salary.dividedBy(new Decimal(26))
  return dailyRate.mul(effectiveDays).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
}

// ── PF calculation ───────────────────────────────────────────────────────────

/**
 * Calculate PF contributions (D-08).
 * PF = 12% of min(basic, 15000). Max PF = ₹1,800 each side.
 */
export function calcPF(
  earnedBasic: Decimal,
  pfApplicable: boolean
): { pfEmployee: Decimal; pfEmployer: Decimal } {
  if (!pfApplicable) {
    return { pfEmployee: new Decimal(0), pfEmployer: new Decimal(0) }
  }
  const cap = new Decimal(15000)
  const basicForPF = Decimal.min(earnedBasic, cap)
  const pf = basicForPF.mul(new Decimal('0.12')).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
  return { pfEmployee: pf, pfEmployer: pf }
}

// ── ESI calculation ──────────────────────────────────────────────────────────

/**
 * Calculate ESI contributions (D-08).
 * Employee: 0.75% of gross; Employer: 3.25% of gross.
 * Only if gross ≤ ₹21,000/month and esiApplicable.
 */
export function calcESI(
  grossSalary: Decimal,
  esiApplicable: boolean
): { esiEmployee: Decimal; esiEmployer: Decimal } {
  const threshold = new Decimal(21000)
  if (!esiApplicable || grossSalary.gt(threshold)) {
    return { esiEmployee: new Decimal(0), esiEmployer: new Decimal(0) }
  }
  const esiEmp = grossSalary.mul(new Decimal('0.0075')).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
  const esiEmr = grossSalary.mul(new Decimal('0.0325')).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
  return { esiEmployee: esiEmp, esiEmployer: esiEmr }
}

// ── Professional Tax (Maharashtra slab) ──────────────────────────────────────

/**
 * Maharashtra Professional Tax slab (Claude's Discretion).
 * month format: "YYYY-MM". February (month ends in '-02') has ₹300 for top bracket.
 */
export function calcProfessionalTax(monthlyGross: Decimal, month: string): Decimal {
  const isFebruary = month.endsWith('-02')
  const gross = monthlyGross.toNumber()   // safe: slab comparison only, not arithmetic
  if (gross <= 7500) return new Decimal(0)
  if (gross <= 10000) return new Decimal(175)
  return new Decimal(isFebruary ? 300 : 200)
}

// ── Full pay slip computation ─────────────────────────────────────────────────

/**
 * Compute a complete pay slip for one employee for one month.
 * Returns PaySlipComputed — caller (Inngest) persists this to DB.
 *
 * Employees with null salaryLedgerId are NOT excluded here.
 * Inngest job logs a warning and excludes them from the journal CR entries (D-11).
 */
export function computePaySlip(
  employee: EmployeeInput,
  structure: StructureInput,
  attendance: AttendanceInput,
  month: string
): PaySlipComputed {
  // Resolve all salary components in order (earnings prorated, deductions raw then applied)
  const resolved = computeComponents(structure.components, attendance)

  // Gross = sum of all earning components
  const grossEarnings = structure.components
    .filter((c) => c.type === 'earning')
    .reduce((sum, c) => sum.plus(resolved[c.name] ?? new Decimal(0)), new Decimal(0))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)

  // Earned Basic (for PF cap): first component named "Basic" (case-insensitive)
  const earnedBasicEntry = Object.entries(resolved).find(
    ([name]) => name.toLowerCase() === 'basic'
  )
  const earnedBasic = earnedBasicEntry ? earnedBasicEntry[1] : new Decimal(0)

  // Statutory deductions
  const { pfEmployee, pfEmployer } = calcPF(earnedBasic, employee.pfApplicable)
  const { esiEmployee, esiEmployer } = calcESI(grossEarnings, employee.esiApplicable)
  const professionalTax = calcProfessionalTax(grossEarnings, month)

  // Total deductions = employee statutory contributions only
  // Rule: use statutory computed values; structure deduction components for PT/other only
  const totalDeductions = pfEmployee.plus(esiEmployee).plus(professionalTax)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)

  const netPay = grossEarnings.minus(totalDeductions).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)

  // Effective days for computedData
  const effectiveDays = new Decimal(attendance.presentDays.toString())
    .plus(new Decimal(attendance.halfDays).mul('0.5'))
    .plus(new Decimal(attendance.leaveDays))

  const componentBreakdown = structure.components.map((c) => ({
    name: c.name,
    type: c.type,
    computed: (resolved[c.name] ?? new Decimal(0)).toFixed(2),
  }))

  return {
    employeeId: employee.id,
    employeeName: employee.name,
    employeeCode: employee.employeeCode,
    salaryLedgerId: employee.salaryLedgerId,
    month,
    grossEarnings,
    pfEmployee,
    pfEmployer,
    esiEmployee,
    esiEmployer,
    professionalTax,
    totalDeductions,
    netPay,
    computedData: {
      components: componentBreakdown,
      attendance: {
        presentDays: attendance.presentDays.toString(),
        halfDays: attendance.halfDays,
        leaveDays: attendance.leaveDays,
        effectiveDays: effectiveDays.toFixed(1),
      },
      statutory: {
        pfEmployee: pfEmployee.toFixed(2),
        pfEmployer: pfEmployer.toFixed(2),
        esiEmployee: esiEmployee.toFixed(2),
        esiEmployer: esiEmployer.toFixed(2),
        professionalTax: professionalTax.toFixed(2),
      },
    },
  }
}
