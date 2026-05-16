import { describe, it, expect } from 'vitest'
import { Decimal } from 'decimal.js'

describe('TDS rate calculation — decimal.js arithmetic', () => {
  it('194C rate 2%: gross 50000 → TDS 1000, net 49000', () => {
    const gross = new Decimal('50000')
    const rate = new Decimal('2')
    const tds = gross.times(rate).dividedBy(100)
    const net = gross.minus(tds)
    expect(tds.toFixed(2)).toBe('1000.00')
    expect(net.toFixed(2)).toBe('49000.00')
  })

  it('194J rate 10%: gross 50000 → TDS 5000, net 45000', () => {
    const gross = new Decimal('50000')
    const rate = new Decimal('10')
    const tds = gross.times(rate).dividedBy(100)
    const net = gross.minus(tds)
    expect(tds.toFixed(2)).toBe('5000.00')
    expect(net.toFixed(2)).toBe('45000.00')
  })

  it('194C rate 1% (individual/HUF): gross 100000 → TDS 1000, net 99000', () => {
    const gross = new Decimal('100000')
    const rate = new Decimal('1')
    const tds = gross.times(rate).dividedBy(100)
    const net = gross.minus(tds)
    expect(tds.toFixed(2)).toBe('1000.00')
    expect(net.toFixed(2)).toBe('99000.00')
  })

  it('three-leg TDS balance: DR party === CR bank + CR TDS Payable', () => {
    const gross = new Decimal('50000')
    const rate = new Decimal('10')
    const tds = gross.times(rate).dividedBy(100)  // 5000
    const net = gross.minus(tds)                   // 45000
    // Dr Party 50000 = Cr Bank 45000 + Cr TDS Payable 5000
    expect(gross.equals(net.plus(tds))).toBe(true)
  })
})
