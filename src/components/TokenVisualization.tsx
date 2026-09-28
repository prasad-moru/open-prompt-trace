import type { PromptProfileState } from '../hooks/usePromptProfile'
import { getHeatmapPieces } from './heatmap'

export function TokenVisualization({ state }: { state: PromptProfileState }) {
  const { status, profile, tokenization, error } = state
  return (
    <div className="token-panel">
      <div className="token-summary" role="status">
        <strong>{profile ? profile.totalTokens.toLocaleString() : '—'}</strong>
        <span>{status === 'initializing' ? 'Initializing WASM…' : status === 'profiling' ? 'Profiling…' : status === 'error' ? 'Profile unavailable' : 'total tokens'}</span>
      </div>
      {error ? <p className="error" role="alert">{error}</p> : (
        <div className="token-view" aria-label="Prompt token boundaries">
          {tokenization && (tokenization.tokens.length ? Array.from(tokenization.tokens, (id, index) => {
            const piece = tokenization.decodedPieces[index]
            const { startIndex, endIndex } = tokenization.offsets[index]
            return <span key={index} className={`token token-${index % 3}${piece ? '' : ' token-empty'}`}
              data-start-index={startIndex} data-end-index={endIndex}
              title={`Token ${index + 1} · ID ${id} · UTF-16 [${startIndex}, ${endIndex})${piece ? '' : ' · Character continues in the next token'}`}>
              {piece ? getHeatmapPieces(profile!.rawText, startIndex, endIndex, profile!.diagnostics).map((part) => (
                <span key={part.startIndex} className={part.severity ? `heat-${part.severity}` : undefined}
                  data-start-index={part.startIndex} data-end-index={part.endIndex} title={part.message || undefined}>{part.text}</span>
              )) : ''}
            </span>
          }) : <p className="empty">Your tokens will appear here. Start with a few words.</p>)}
        </div>
      )}
      <div className="heatmap-legend"><span className="heat-warning">Warning</span><span className="heat-info">Whitespace</span><span className="heat-neutral">Dynamic variable</span></div>
      <div className="card-footer"><span className="legend"><i className="token-0" /><i className="token-1" /><i className="token-2" /> Token boundaries</span><span>cl100k_base · Hover for details</span></div>
    </div>
  )
}
