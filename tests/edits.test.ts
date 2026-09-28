import { describe, expect, it } from 'vitest'
import { applyReplacements, createPrunedDiff, selectReplacements } from '../src/core/profiler/edits'
import { getHeatmapPieces } from '../src/components/heatmap'
import type { Diagnostic, ProfilerResult } from '../src/core/profiler/linter'

const edit = (startIndex: number, endIndex: number, suggestedReplacement: string): Diagnostic => ({
  id: `${startIndex}:${endIndex}`, startIndex, endIndex, suggestedReplacement,
  category: 'WHITESPACE_BLEED', severity: 'info', message: 'Whitespace',
})

describe('overlap-safe descending edits and exact diff', () => {
  it('applies adjacent edits using original indices even when lengths change', () => {
    expect(applyReplacements('abcdef', [edit(4, 6, '!'), edit(0, 2, 'longer'), edit(2, 4, '')])).toBe('longer!')
  })
  it('prefers outer ranges and excludes intersecting or nested edits without mutating diagnostics', () => {
    const diagnostics = [edit(2, 3, 'bad'), edit(0, 2, 'bad'), edit(0, 4, 'X'), edit(3, 5, 'bad'), edit(5, 6, 'Y')]
    const snapshot = structuredClone(diagnostics)
    expect(selectReplacements(diagnostics).map((d) => d.id)).toEqual(['0:4', '5:6'])
    expect(applyReplacements('abcdef', diagnostics)).toBe('XeY')
    expect(diagnostics).toEqual(snapshot)
  })
  it('diff streams independently reconstruct the original and optimized prompts', () => {
    const rawText = '🌍 a   b\n\n\nc'
    const diagnostics = [edit(4, 7, ' '), edit(8, 11, '\n\n')]
    const prunedText = applyReplacements(rawText, diagnostics)
    const profile: ProfilerResult = { rawText, prunedText, diagnostics, charCount: 0, totalTokens: 0, savingsTokens: 0, projectedPrunedTokens: 0, bloatPercentage: 0 }
    const diff = createPrunedDiff(profile)
    expect(diff.filter((d) => d.kind !== 'added').map((d) => d.text).join('')).toBe(rawText)
    expect(diff.filter((d) => d.kind !== 'removed').map((d) => d.text).join('')).toBe(prunedText)
    expect(createPrunedDiff({ ...profile, prunedText: rawText })).toEqual([{ kind: 'unchanged', text: rawText }])
  })
  it('heatmap highlights exact UTF-16 slices with deterministic severity precedence', () => {
    const text = '🌍 abcdef'
    const diagnostics: Diagnostic[] = [edit(4, 7, ''), { ...edit(5, 6, ''), severity: 'warning' }]
    const pieces = getHeatmapPieces(text, 0, text.length, diagnostics)
    expect(pieces.map((p) => p.text).join('')).toBe(text)
    expect(pieces.filter((p) => p.severity === 'warning').map((p) => p.text).join('')).toBe('c')
    expect(pieces.every((p) => text.slice(p.startIndex, p.endIndex) === p.text)).toBe(true)
    expect(getHeatmapPieces(text, 0, 0, diagnostics)).toEqual([])
  })
})
