import { useMemo, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { createPrunedDiff } from '../core/profiler/edits'
import type { ProfilerResult } from '../core/profiler/linter'

export function PrunedDiff({ profile }: { profile: ProfilerResult }) {
  const [copiedText, setCopiedText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const segments = useMemo(() => createPrunedDiff(profile), [profile])
  const copied = copiedText === profile.prunedText
  const copy = async () => {
    setError(null)
    try {
      await navigator.clipboard.writeText(profile.prunedText)
      setCopiedText(profile.prunedText)
    } catch {
      setError('Clipboard access is unavailable. Select and copy the optimized text below.')
    }
  }
  return (
    <div className="diff-panel">
      <div className="diff-toolbar">
        <span>{profile.totalTokens} → {profile.projectedPrunedTokens} tokens</span>
        <button type="button" onClick={() => void copy()}>{copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}{copied ? 'Copied' : 'Copy Optimized Prompt'}</button>
      </div>
      <p className="diff-legend"><span>− Removed</span><span>+ Added</span></p>
      <pre className="diff-view" aria-label="Pruned prompt diff">{segments.map((segment, index) => segment.kind === 'removed'
        ? <del key={index}>{segment.text}</del>
        : segment.kind === 'added' ? <ins key={index}>{segment.text}</ins> : <span key={index}>{segment.text}</span>)}</pre>
      {profile.rawText === profile.prunedText && <p className="profile-note">No token-saving replacements to apply.</p>}
      <p className="profile-note">Review this preview before use. Formatting changes can affect Markdown, code, and prompt structure.</p>
      <p className="copy-status" role="status">{error ?? (copied ? 'Optimized prompt copied to clipboard.' : '')}</p>
      <details className="pruned-preview" open={error ? true : undefined}>
        <summary>Optimized text</summary>
        <textarea className="optimized-text" aria-label="Optimized prompt" readOnly value={profile.prunedText} />
      </details>
    </div>
  )
}
