import { countTokens, tokenizeRaw, type RawTokenization } from '../tokenizer/engine'
import { applyReplacements } from './edits'

export type DiagnosticSeverity = 'warning' | 'info' | 'neutral'
export type DiagnosticCategory = 'JSON_FORMATTING' | 'REDUNDANT_CONSTRAINT' | 'WHITESPACE_BLEED' | 'DYNAMIC_VAR'

export interface Diagnostic {
  id: string
  category: DiagnosticCategory
  severity: DiagnosticSeverity
  startIndex: number
  endIndex: number
  message: string
  suggestedReplacement?: string
  potentialSavingsTokens?: number
}

export interface ProfilerResult {
  rawText: string
  totalTokens: number
  charCount: number
  diagnostics: Diagnostic[]
  projectedPrunedTokens: number
  savingsTokens: number
  bloatPercentage: number
  prunedText: string
}

export const PROFILER_LIMITS = {
  maxCodeUnits: 50_000,
  maxTokens: 5_000,
  maxDiagnostics: 200,
} as const

export function assertInputWithinLimit(text: string): void {
  if (text.length > PROFILER_LIMITS.maxCodeUnits) {
    throw new Error(`Profiling is limited to ${PROFILER_LIMITS.maxCodeUnits.toLocaleString()} UTF-16 code units. Shorten the prompt to continue.`)
  }
}

interface JsonBlock { start: number; end: number; compact: string }

/** Linear, string/escape-aware scan of disjoint objects/arrays, including fences. */
function findJsonBlocks(text: string): JsonBlock[] {
  const blocks: JsonBlock[] = []
  let start = -1
  let quoted = false
  let escaped = false
  let stack: string[] = []
  for (let index = 0; index < text.length; index++) {
    const character = text[index]
    if (start < 0) {
      if (character !== '{' && character !== '[') continue
      start = index
      stack = [character]
      quoted = false
      escaped = false
      continue
    }
    if (quoted) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '"') quoted = false
      continue
    }
    if (character === '"') quoted = true
    else if (character === '{' || character === '[') stack.push(character)
    else if (character === '}' || character === ']') {
      const expected = character === '}' ? '{' : '['
      if (stack.pop() !== expected) { start = -1; continue }
      if (stack.length) continue
      const source = text.slice(start, index + 1)
      try {
        JSON.parse(source)
        // Strip only JSON whitespace outside strings. Unlike stringify(parse()),
        // this preserves duplicate keys, numeric lexemes, and large integers.
        const compact = source.replace(/"(?:\\.|[^"\\])*"|[ \t\r\n]+/g, (part) => part.startsWith('"') ? part : '')
        blocks.push({ start, end: index + 1, compact })
      } catch { /* Invalid candidates are not JSON diagnostics. */ }
      start = -1
    }
  }
  return blocks
}

/** Deterministic suggestions; all ranges are half-open JavaScript slice offsets. */
export function profilePrompt(rawText: string, tokenization?: RawTokenization): ProfilerResult {
  assertInputWithinLimit(rawText)
  const raw = tokenization ?? tokenizeRaw(rawText, PROFILER_LIMITS.maxTokens)
  const totalTokens = raw.tokens.length
  if (totalTokens > PROFILER_LIMITS.maxTokens) {
    throw new Error(`Profiling is limited to ${PROFILER_LIMITS.maxTokens.toLocaleString()} tokens. Shorten the prompt to continue.`)
  }
  const diagnostics: Diagnostic[] = []
  const add = (diagnostic: Omit<Diagnostic, 'id'>) => {
    if (diagnostics.length >= PROFILER_LIMITS.maxDiagnostics) {
      throw new Error(`This prompt exceeds the ${PROFILER_LIMITS.maxDiagnostics}-diagnostic limit. Profile a smaller section.`)
    }
    diagnostics.push({ ...diagnostic, id: `${diagnostic.category}:${diagnostic.startIndex}:${diagnostic.endIndex}` })
  }
  for (const block of findJsonBlocks(rawText)) {
    const original = rawText.slice(block.start, block.end)
    if (original === block.compact || !/(?:\r?\n|[ \t]{2,})/.test(original)) continue
    add({ category: 'JSON_FORMATTING', severity: 'warning', startIndex: block.start, endIndex: block.end,
      message: 'JSON formatting can be compacted. Review readability before applying.',
      suggestedReplacement: block.compact,
      potentialSavingsTokens: Math.max(0, countTokens(original) - countTokens(block.compact)),
    })
  }
  const constraints = /(?:do not|never|don't|no need to|strictly avoid).{1,80}?(?:do not|never|don't|no need to|strictly avoid)/gi
  for (const match of rawText.matchAll(constraints)) {
    add({ category: 'REDUNDANT_CONSTRAINT', severity: 'warning', startIndex: match.index, endIndex: match.index + match[0].length,
      message: 'Nearby negative instructions may repeat a constraint. Review manually; no removal is assumed.',
    })
  }
  for (const match of rawText.matchAll(/(?:\r\n|\n){3,}|[ \t]+(?=\r?$)/gm)) {
    const lineBreaks = match[0].startsWith('\n') || match[0].startsWith('\r')
    const replacement = lineBreaks ? '\n\n' : ''
    add({ category: 'WHITESPACE_BLEED', severity: 'info', startIndex: match.index, endIndex: match.index + match[0].length,
      message: lineBreaks ? 'Extra blank lines can be reduced. Review structure before applying.' : 'Trailing spaces can be removed. Review Markdown or code whitespace before applying.',
      suggestedReplacement: replacement,
      potentialSavingsTokens: Math.max(0, countTokens(match[0]) - countTokens(replacement)),
    })
  }
  for (const match of rawText.matchAll(/\{\{[a-zA-Z0-9_-]+\}\}|\$\{[a-zA-Z0-9_-]+\}|<[a-zA-Z0-9_-]+>/g)) {
    add({ category: 'DYNAMIC_VAR', severity: 'neutral', startIndex: match.index, endIndex: match.index + match[0].length,
      message: 'Possible dynamic placeholder (angle brackets can also be HTML). Its injected value will change token usage.',
      potentialSavingsTokens: 0,
    })
  }
  // Prefer the outermost edit at the same start; skip intersecting suggestions.
  diagnostics.sort((a, b) => a.startIndex - b.startIndex || b.endIndex - a.endIndex || a.category.localeCompare(b.category))
  let prunedText = applyReplacements(rawText, diagnostics)
  let projectedPrunedTokens = prunedText === rawText ? totalTokens : countTokens(prunedText)
  // BPE context may make local edits more expensive. Never promise negative savings.
  if (projectedPrunedTokens > totalTokens) {
    prunedText = rawText
    projectedPrunedTokens = totalTokens
  }
  const savingsTokens = totalTokens - projectedPrunedTokens
  return { rawText, totalTokens, charCount: raw.charCount, diagnostics, projectedPrunedTokens, savingsTokens,
    bloatPercentage: totalTokens ? savingsTokens / totalTokens * 100 : 0, prunedText }
}
