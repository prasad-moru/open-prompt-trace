/** User-specified September 2026 baseline; never fetched from a remote API. */
export const PRICING_BASELINE = 'September 2026'
export const PRICING_REGISTRY = {
  'gpt-4o': { label: 'GPT-4o', inputUsdPerMillion: 2.5 },
  'claude-3-5-sonnet': { label: 'Claude 3.5 Sonnet', inputUsdPerMillion: 3 },
  'gpt-4o-mini': { label: 'GPT-4o mini', inputUsdPerMillion: 0.15 },
  'claude-3-5-haiku': { label: 'Claude 3.5 Haiku', inputUsdPerMillion: 0.8 },
} as const

export type PricingModel = keyof typeof PRICING_REGISTRY
export const INVOCATION_LIMITS = { min: 1_000, max: 1_000_000, default: 50_000 } as const

export interface CostProjection {
  model: PricingModel
  monthlyInvocations: number
  inputUsdPerMillion: number
  grossCostPerInvocation: number
  netCostPerInvocation: number
  /** Monthly costs in USD. */
  grossCost: number
  netCost: number
  monthlySavings: number
}

export function calculateCosts(
  totalTokens: number,
  prunedTokens: number,
  model: PricingModel,
  monthlyInvocations: number = INVOCATION_LIMITS.default,
): CostProjection {
  if (!Object.hasOwn(PRICING_REGISTRY, model)) throw new RangeError('Unknown pricing model.')
  if (![totalTokens, prunedTokens, monthlyInvocations].every(Number.isSafeInteger)
    || totalTokens < 0 || prunedTokens < 0 || prunedTokens > totalTokens) {
    throw new RangeError('Token counts must be non-negative integers, with pruned tokens no greater than total tokens.')
  }
  if (monthlyInvocations < INVOCATION_LIMITS.min || monthlyInvocations > INVOCATION_LIMITS.max) {
    throw new RangeError('Monthly invocations must be between 1,000 and 1,000,000.')
  }
  const inputUsdPerMillion = PRICING_REGISTRY[model].inputUsdPerMillion
  const grossCostPerInvocation = totalTokens * inputUsdPerMillion / 1_000_000
  const netCostPerInvocation = prunedTokens * inputUsdPerMillion / 1_000_000
  return {
    model, monthlyInvocations, inputUsdPerMillion, grossCostPerInvocation, netCostPerInvocation,
    grossCost: grossCostPerInvocation * monthlyInvocations,
    netCost: netCostPerInvocation * monthlyInvocations,
    monthlySavings: (totalTokens - prunedTokens) * inputUsdPerMillion / 1_000_000 * monthlyInvocations,
  }
}
