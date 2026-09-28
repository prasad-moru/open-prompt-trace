import type { ProfilerResult } from '../core/profiler/linter'

interface ProfileDiagnosticsProps {
  profile: ProfilerResult
  onSelectRange: (start: number, end: number) => void
}

export function ProfileDiagnostics({ profile, onSelectRange }: ProfileDiagnosticsProps) {
  return (
    <section className="card diagnostics-card" aria-labelledby="diagnostics-heading">
      <div className="card-header"><h2 id="diagnostics-heading">Prompt profile</h2><span className="encoding">{profile.diagnostics.length} findings</span></div>
      <dl className="profile-metrics">
        <div><dt>After suggested edits</dt><dd>{profile.projectedPrunedTokens.toLocaleString()} <small>tokens</small></dd></div>
        <div><dt>Potential savings</dt><dd>{profile.savingsTokens.toLocaleString()} <small>tokens</small></dd></div>
        <div><dt>Estimated bloat</dt><dd>{profile.bloatPercentage.toFixed(1)}<small>%</small></dd></div>
      </dl>
      <p className="profile-note">Preview only. Overlapping edits count once. Review suggestions: whitespace can be meaningful in code and Markdown.</p>
      {profile.diagnostics.length ? <ul className="diagnostic-list">
        {profile.diagnostics.map((diagnostic) => (
          <li key={diagnostic.id} className={`diagnostic diagnostic-${diagnostic.severity}`}>
            <div className="diagnostic-heading"><span className="severity">{diagnostic.severity}</span><strong>{diagnostic.category.replaceAll('_', ' ').toLowerCase()}</strong>
              <button type="button" onClick={() => onSelectRange(diagnostic.startIndex, diagnostic.endIndex)} aria-label={`Select ${diagnostic.category.toLowerCase()} at ${diagnostic.startIndex}`}>Select text</button>
            </div>
            <p>{diagnostic.message}</p>
            <code className="diagnostic-source">{profile.rawText.slice(diagnostic.startIndex, diagnostic.endIndex)}</code>
            <small>UTF-16 [{diagnostic.startIndex}, {diagnostic.endIndex}){diagnostic.potentialSavingsTokens !== undefined ? ` · Up to ${diagnostic.potentialSavingsTokens} tokens locally; total savings are recomputed in context` : ''}</small>
          </li>
        ))}
      </ul> : <p className="profile-note">No heuristic findings. This is not a guarantee that the prompt is optimal.</p>}
      {profile.prunedText !== profile.rawText && <details className="pruned-preview"><summary>Review suggested pruned text</summary><pre>{profile.prunedText}</pre></details>}
    </section>
  )
}
