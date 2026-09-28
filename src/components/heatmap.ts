import type { Diagnostic, DiagnosticSeverity } from '../core/profiler/linter'

export interface HeatmapPiece {
  startIndex: number
  endIndex: number
  text: string
  severity?: DiagnosticSeverity
  message: string
}

/** Split at diagnostic boundaries without changing any source text or offsets. */
export function getHeatmapPieces(text: string, start: number, end: number, diagnostics: Diagnostic[]): HeatmapPiece[] {
  const overlapping = diagnostics.filter((d) => d.startIndex < end && d.endIndex > start)
  const cuts = [...new Set([start, end, ...overlapping.flatMap((d) => [Math.max(start, d.startIndex), Math.min(end, d.endIndex)])])].sort((a, b) => a - b)
  return cuts.slice(0, -1).map((startIndex, index) => {
    const endIndex = cuts[index + 1]
    const matches = overlapping.filter((d) => d.startIndex < endIndex && d.endIndex > startIndex)
    const severity = (['warning', 'info', 'neutral'] as const).find((level) => matches.some((d) => d.severity === level))
    return { startIndex, endIndex, text: text.slice(startIndex, endIndex), severity,
      message: matches.map((d) => `${d.category}: ${d.message}`).join('\n') }
  })
}
