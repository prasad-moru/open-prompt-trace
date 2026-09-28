import type { Diagnostic, ProfilerResult } from './linter'

export type Replacement = Diagnostic & { suggestedReplacement: string }
export interface DiffSegment { kind: 'unchanged' | 'removed' | 'added'; text: string }

/** Source-order selection prioritizes outer replacements and never mutates input. */
export function selectReplacements(diagnostics: Diagnostic[]): Replacement[] {
  const candidates = diagnostics.filter((diagnostic): diagnostic is Replacement => diagnostic.suggestedReplacement !== undefined)
    .sort((a, b) => a.startIndex - b.startIndex || b.endIndex - a.endIndex || a.id.localeCompare(b.id))
  const selected: Replacement[] = []
  let end = 0
  for (const candidate of candidates) {
    if (candidate.startIndex < end) continue
    selected.push(candidate)
    end = candidate.endIndex
  }
  return selected
}

export function applyReplacements(rawText: string, diagnostics: Diagnostic[]): string {
  let prunedText = rawText
  // Descending edits preserve the original UTF-16 indices for every replacement.
  for (const edit of selectReplacements(diagnostics).sort((a, b) => b.startIndex - a.startIndex)) {
    prunedText = prunedText.slice(0, edit.startIndex) + edit.suggestedReplacement + prunedText.slice(edit.endIndex)
  }
  return prunedText
}

/** Render exactly the edits used in the preview, including unchanged context. */
export function createPrunedDiff(profile: ProfilerResult): DiffSegment[] {
  if (profile.rawText === profile.prunedText) return [{ kind: 'unchanged', text: profile.rawText }]
  const segments: DiffSegment[] = []
  let cursor = 0
  for (const edit of selectReplacements(profile.diagnostics)) {
    if (cursor < edit.startIndex) segments.push({ kind: 'unchanged', text: profile.rawText.slice(cursor, edit.startIndex) })
    segments.push({ kind: 'removed', text: profile.rawText.slice(edit.startIndex, edit.endIndex) })
    if (edit.suggestedReplacement) segments.push({ kind: 'added', text: edit.suggestedReplacement })
    cursor = edit.endIndex
  }
  if (cursor < profile.rawText.length) segments.push({ kind: 'unchanged', text: profile.rawText.slice(cursor) })
  return segments
}
