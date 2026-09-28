import { useMemo, useState } from 'react'
import { calculateCosts, INVOCATION_LIMITS, type PricingModel } from '../core/pricing/calculator'
import type { ProfilerResult } from '../core/profiler/linter'

export function useCostProjection(profile: ProfilerResult | null) {
  const [model, setModel] = useState<PricingModel>('gpt-4o')
  const [monthlyInvocations, setMonthlyInvocations] = useState<number>(INVOCATION_LIMITS.default)
  const projection = useMemo(() => profile
    ? calculateCosts(profile.totalTokens, profile.projectedPrunedTokens, model, monthlyInvocations)
    : null, [profile, model, monthlyInvocations])
  return { model, setModel, monthlyInvocations, setMonthlyInvocations, projection }
}
