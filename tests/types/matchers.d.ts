import 'vitest'
import type { Decimal } from '@prisma/client/runtime/library'

declare module 'vitest' {
  interface Matchers<R> {
    toBeCloseToDecimal(expected: string | number | Decimal, digits?: number): R
  }
}
