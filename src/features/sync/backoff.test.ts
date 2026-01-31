import { describe, expect, it } from 'vitest'
import { computeBackoffMs } from './backoff'

describe('computeBackoffMs', () => {
  it('respects retry-after', () => {
    expect(
      computeBackoffMs({ attempt: 3, baseMs: 1000, maxMs: 30000, retryAfterSeconds: 10 }),
    ).toBe(10000)
  })

  it('returns a bounded value', () => {
    const v = computeBackoffMs({ attempt: 100, baseMs: 1000, maxMs: 30000 })
    expect(v).toBeGreaterThan(0)
    expect(v).toBeLessThanOrEqual(30000)
  })
})

