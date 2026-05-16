vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({}))
vi.mock('next/headers', () => ({}))

import '@testing-library/jest-dom'

expect.extend({
  toBeCloseToDecimal(received: unknown, expected: string | number, digits = 2) {
    const { Decimal } = require('decimal.js')
    const r = new Decimal(received).toFixed(digits)
    const e = new Decimal(expected).toFixed(digits)
    const pass = r === e
    return {
      pass,
      message: () => `expected ${r} to${pass ? ' not' : ''} close-match ${e} (${digits} digits)`,
    }
  },
})
