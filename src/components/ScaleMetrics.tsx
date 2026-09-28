import { useCostProjection } from '../hooks/useCostProjection'
import { INVOCATION_LIMITS, PRICING_BASELINE, PRICING_REGISTRY, type PricingModel } from '../core/pricing/calculator'
import type { ProfilerResult } from '../core/profiler/linter'

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 })

export function ScaleMetrics({ profile }: { profile: ProfilerResult | null }) {
  const { model, setModel, monthlyInvocations, setMonthlyInvocations, projection } = useCostProjection(profile)
  const ratio = profile ? (profile.charCount ? profile.totalTokens / profile.charCount : 0).toFixed(3) : '—'
  return (
    <section className="card scale-card" aria-labelledby="scale-heading">
      <div className="scale-toolbar">
        <h2 id="scale-heading">Cost at scale</h2>
        <label className="model-control">Model<select value={model} onChange={(event) => setModel(event.target.value as PricingModel)}>
          {Object.entries(PRICING_REGISTRY).map(([id, pricing]) => <option value={id} key={id}>{pricing.label}</option>)}
        </select></label>
      </div>
      <dl className="scale-metrics">
        <div><dt>Total tokens</dt><dd>{profile?.totalTokens.toLocaleString() ?? '—'}</dd></div>
        <div><dt>Tokens / character</dt><dd>{ratio}</dd></div>
        <div><dt>Bloat score</dt><dd>{profile ? `${profile.bloatPercentage.toFixed(1)}%` : '—'}</dd></div>
        <div><dt>Monthly input cost</dt><dd className="cost-pair">{projection ? <><span>{money.format(projection.grossCost)}</span><span aria-hidden="true"> → </span><span>{money.format(projection.netCost)}</span></> : '—'}</dd><small>Gross → net</small></div>
        <div className="savings-metric"><dt>Projected monthly savings</dt><dd>{projection ? money.format(projection.monthlySavings) : '—'}</dd></div>
      </dl>
      <div className="invocation-control">
        <label htmlFor="monthly-invocations">Monthly invocations <output htmlFor="monthly-invocations">{monthlyInvocations.toLocaleString()}</output></label>
        <input id="monthly-invocations" type="range" min={INVOCATION_LIMITS.min} max={INVOCATION_LIMITS.max} step={1_000}
          value={monthlyInvocations} aria-valuetext={`${monthlyInvocations.toLocaleString()} invocations per month`}
          onChange={(event) => setMonthlyInvocations(Number(event.target.value))} />
        <div className="range-labels"><span>1,000</span><span>1,000,000</span></div>
      </div>
      <p className="profile-note">{PRICING_BASELINE} configured baseline · ${PRICING_REGISTRY[model].inputUsdPerMillion.toFixed(2)} / 1M input tokens · estimates based on cl100k proxy. Input only; excludes output, caching, discounts, and request overhead.</p>
    </section>
  )
}
