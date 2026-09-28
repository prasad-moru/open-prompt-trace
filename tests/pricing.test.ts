import { describe, expect, it } from 'vitest'
import { calculateCosts, INVOCATION_LIMITS, PRICING_BASELINE, PRICING_REGISTRY, type PricingModel } from '../src/core/pricing/calculator'

describe('September 2026 input pricing baseline', () => {
  it('contains the four requested static rates', () => {
    expect(PRICING_BASELINE).toBe('September 2026')
    expect(Object.fromEntries(Object.entries(PRICING_REGISTRY).map(([id, value]) => [id, value.inputUsdPerMillion])))
      .toEqual({ 'gpt-4o': 2.5, 'claude-3-5-sonnet': 3, 'gpt-4o-mini': 0.15, 'claude-3-5-haiku': 0.8 })
  })
  it.each(Object.keys(PRICING_REGISTRY) as PricingModel[])('computes unrounded gross, net and monthly savings for %s', (model) => {
    const cost = calculateCosts(1000, 800, model)
    const rate = PRICING_REGISTRY[model].inputUsdPerMillion
    expect(cost.monthlyInvocations).toBe(50_000)
    expect(cost.grossCostPerInvocation).toBeCloseTo(rate / 1000, 12)
    expect(cost.netCostPerInvocation).toBeCloseTo(0.0008 * rate, 12)
    expect(cost.grossCost).toBeCloseTo(50 * rate, 12)
    expect(cost.netCost).toBeCloseTo(40 * rate, 12)
    expect(cost.monthlySavings).toBeCloseTo(10 * rate, 12)
    expect(cost.grossCost - cost.netCost).toBeCloseTo(cost.monthlySavings, 12)
  })
  it('scales linearly at slider endpoints and handles empty prompts', () => {
    const low = calculateCosts(1000, 800, 'gpt-4o', INVOCATION_LIMITS.min)
    const high = calculateCosts(1000, 800, 'gpt-4o', INVOCATION_LIMITS.max)
    expect(low.monthlySavings).toBeCloseTo(0.5)
    expect(high.monthlySavings).toBeCloseTo(500)
    expect(calculateCosts(0, 0, 'gpt-4o').grossCost).toBe(0)
    expect(calculateCosts(10, 10, 'gpt-4o').monthlySavings).toBe(0)
  })
  it('rejects invalid counts, models and invocation ranges', () => {
    for (const value of [-1, NaN, Infinity, 1.5]) expect(() => calculateCosts(value, 0, 'gpt-4o')).toThrow()
    expect(() => calculateCosts(10, 11, 'gpt-4o')).toThrow()
    for (const value of [0, 999, 1_000_001, NaN, 1500.5]) expect(() => calculateCosts(10, 5, 'gpt-4o', value)).toThrow()
    expect(() => calculateCosts(10, 5, 'unknown' as PricingModel)).toThrow()
  })
})
