import { describe, it, expect } from 'vitest'
import { Decimal } from 'decimal.js'
import {
  resolveFormula,
  prorateSalary,
  calcPF,
  calcESI,
  calcProfessionalTax,
  computePaySlip,
  PayrollValidationError,
  type EmployeeInput,
  type StructureInput,
  type AttendanceInput,
} from '@/lib/services/PayrollEngine'

// Fixture: standard structure for 3-employee journal balance test
const standardStructure: StructureInput = {
  id: 'struct-1',
  name: 'Standard',
  components: [
    { name: 'Basic', type: 'earning', amount: '20000', order: 1 },
    { name: 'HRA', type: 'earning', formula: '40% of Basic', order: 2 },
    { name: 'Special Allowance', type: 'earning', amount: '5000', order: 3 },
  ],
}

const fullAttendance: AttendanceInput = { presentDays: '26', halfDays: 0, leaveDays: 0 }
const partialAttendance: AttendanceInput = { presentDays: '20', halfDays: 0, leaveDays: 0 }
const halfDayAttendance: AttendanceInput = { presentDays: '13', halfDays: 1, leaveDays: 0 }

const emp1: EmployeeInput = { id: 'e1', name: 'Ravi', employeeCode: 'E001', pfApplicable: true, esiApplicable: false, salaryLedgerId: 'l1' }
const emp2: EmployeeInput = { id: 'e2', name: 'Priya', employeeCode: 'E002', pfApplicable: true, esiApplicable: true, salaryLedgerId: 'l2' }
const emp3: EmployeeInput = { id: 'e3', name: 'Ajay', employeeCode: 'E003', pfApplicable: false, esiApplicable: false, salaryLedgerId: null }

describe('PayrollEngine', () => {

  describe('resolveFormula', () => {
    it('resolves "40% of Basic"', () => {
      const result = resolveFormula('40% of Basic', { Basic: new Decimal(20000) })
      expect(result.equals(new Decimal(8000))).toBe(true)
    })
    it('resolves "12% of Basic" for PF', () => {
      const result = resolveFormula('12% of Basic', { Basic: new Decimal(10000) })
      expect(result.equals(new Decimal(1200))).toBe(true)
    })
    it('throws PayrollValidationError for unknown component', () => {
      expect(() => resolveFormula('40% of NonExistent', { Basic: new Decimal(10000) }))
        .toThrow(PayrollValidationError)
    })
    it('throws PayrollValidationError for invalid formula syntax', () => {
      expect(() => resolveFormula('flat 5000', {})).toThrow(PayrollValidationError)
    })
    it('resolves decimal percentage', () => {
      const result = resolveFormula('0.75% of Gross', { Gross: new Decimal(20000) })
      expect(result.equals(new Decimal(150))).toBe(true)
    })
  })

  describe('prorateSalary', () => {
    it('26 of 26 = full salary', () => {
      expect(prorateSalary(new Decimal(26000), 26, 0, 0).equals(new Decimal(26000))).toBe(true)
    })
    it('20 of 26 = partial salary', () => {
      const result = prorateSalary(new Decimal(26000), 20, 0, 0)
      // 26000 / 26 * 20 = 20000
      expect(result.equals(new Decimal(20000))).toBe(true)
    })
    it('13 present + 1 half-day = 13.5 effective days', () => {
      const result = prorateSalary(new Decimal(26000), 13, 1, 0)
      // 26000 / 26 * 13.5 = 13500
      expect(result.equals(new Decimal(13500))).toBe(true)
    })
    it('leave days are paid (counted as effective)', () => {
      // 22 present + 2 leave = 24 effective
      const result = prorateSalary(new Decimal(26000), 22, 0, 2)
      // 26000 / 26 * 24 = 24000
      expect(result.equals(new Decimal(24000))).toBe(true)
    })
  })

  describe('calcPF', () => {
    it('12% of basic under ₹15,000 cap', () => {
      const { pfEmployee, pfEmployer } = calcPF(new Decimal(10000), true)
      expect(pfEmployee.equals(new Decimal(1200))).toBe(true)
      expect(pfEmployer.equals(new Decimal(1200))).toBe(true)
    })
    it('capped at ₹1,800 when basic = 15000', () => {
      const { pfEmployee } = calcPF(new Decimal(15000), true)
      expect(pfEmployee.equals(new Decimal(1800))).toBe(true)
    })
    it('capped at ₹1,800 when basic exceeds 15000', () => {
      const { pfEmployee } = calcPF(new Decimal(20000), true)
      expect(pfEmployee.equals(new Decimal(1800))).toBe(true)
    })
    it('returns zero when pfApplicable=false', () => {
      const { pfEmployee, pfEmployer } = calcPF(new Decimal(10000), false)
      expect(pfEmployee.equals(new Decimal(0))).toBe(true)
      expect(pfEmployer.equals(new Decimal(0))).toBe(true)
    })
  })

  describe('calcESI', () => {
    it('0.75% emp + 3.25% employer when gross ≤ 21000', () => {
      const { esiEmployee, esiEmployer } = calcESI(new Decimal(18000), true)
      expect(esiEmployee.equals(new Decimal(135))).toBe(true)
      expect(esiEmployer.equals(new Decimal(585))).toBe(true)
    })
    it('applies at exactly ₹21,000 threshold', () => {
      const { esiEmployee } = calcESI(new Decimal(21000), true)
      expect(esiEmployee.gt(new Decimal(0))).toBe(true)
    })
    it('returns zero when gross > 21000', () => {
      const { esiEmployee, esiEmployer } = calcESI(new Decimal(21001), true)
      expect(esiEmployee.equals(new Decimal(0))).toBe(true)
      expect(esiEmployer.equals(new Decimal(0))).toBe(true)
    })
    it('returns zero when esiApplicable=false', () => {
      const { esiEmployee } = calcESI(new Decimal(18000), false)
      expect(esiEmployee.equals(new Decimal(0))).toBe(true)
    })
  })

  describe('calcProfessionalTax', () => {
    it('₹0 when gross ≤ 7500', () => {
      expect(calcProfessionalTax(new Decimal(7500), '2025-04').equals(new Decimal(0))).toBe(true)
    })
    it('₹175 when gross 7501–10000', () => {
      expect(calcProfessionalTax(new Decimal(8000), '2025-04').equals(new Decimal(175))).toBe(true)
    })
    it('₹200 when gross >10000 in non-February month', () => {
      expect(calcProfessionalTax(new Decimal(12000), '2025-04').equals(new Decimal(200))).toBe(true)
    })
    it('₹300 when gross >10000 in February', () => {
      expect(calcProfessionalTax(new Decimal(12000), '2025-02').equals(new Decimal(300))).toBe(true)
    })
  })

  describe('computeComponents — formula proration', () => {
    it('HRA (formula) is NOT double-prorated at partial attendance', () => {
      // Basic 20000, HRA = 40% of Basic, 20/26 days present
      // Expected: Basic prorated to 15384.62; HRA = 40% of 15384.62 = 6153.85 (not 4733)
      const slip = computePaySlip(emp1, standardStructure, partialAttendance, '2025-04')
      const componentMap = Object.fromEntries(
        slip.computedData.components.map((c) => [c.name, c.computed])
      )
      const proratedBasic = new Decimal('20000').mul(20).dividedBy(26).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      const expectedHRA = proratedBasic.mul('0.4').toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      expect(new Decimal(componentMap['HRA']).equals(expectedHRA)).toBe(true)
    })
  })

  describe('computePaySlip — journal balance invariant', () => {
    it('netPay + deductions = grossEarnings per employee (emp1 full attendance)', () => {
      const slip = computePaySlip(emp1, standardStructure, fullAttendance, '2025-04')
      const reconstructed = slip.netPay.plus(slip.totalDeductions)
      expect(reconstructed.equals(slip.grossEarnings)).toBe(true)
    })

    it('3-employee batch: sum of CR (net + PF total + ESI total) equals DR (grossEarnings total)', () => {
      const slips = [
        computePaySlip(emp1, standardStructure, fullAttendance, '2025-04'),
        computePaySlip(emp2, standardStructure, partialAttendance, '2025-04'),
        computePaySlip(emp3, standardStructure, halfDayAttendance, '2025-04'),
      ]
      // Only employees with salaryLedgerId included in journal (D-11)
      // emp3.salaryLedgerId = null → excluded from journal
      const journalSlips = slips.filter((s) => s.salaryLedgerId !== null)

      const totalGross = journalSlips.reduce((s, r) => s.plus(r.grossEarnings), new Decimal(0))
      const totalEmpPF = journalSlips.reduce((s, r) => s.plus(r.pfEmployee), new Decimal(0))
      const totalEmrPF = journalSlips.reduce((s, r) => s.plus(r.pfEmployer), new Decimal(0))
      const totalEmpESI = journalSlips.reduce((s, r) => s.plus(r.esiEmployee), new Decimal(0))
      const totalEmrESI = journalSlips.reduce((s, r) => s.plus(r.esiEmployer), new Decimal(0))
      const totalNetPay = journalSlips.reduce((s, r) => s.plus(r.netPay), new Decimal(0))
      const totalPT = journalSlips.reduce((s, r) => s.plus(r.professionalTax), new Decimal(0))

      // DR = totalGross + employer PF + employer ESI
      const dr = totalGross.plus(totalEmrPF).plus(totalEmrESI)
      // CR = sum(netPay) + (empPF + emrPF) + (empESI + emrESI) + PT
      const cr = totalNetPay
        .plus(totalEmpPF).plus(totalEmrPF)
        .plus(totalEmpESI).plus(totalEmrESI)
        .plus(totalPT)

      // Allow for rounding tolerance of ₹1 across 3 employees
      const diff = dr.minus(cr).abs()
      expect(diff.lte(new Decimal('1'))).toBe(true)
    })
  })

})
