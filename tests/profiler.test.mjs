import { afterAll as after, beforeAll as before, test } from 'vitest'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { build } from 'vite'

let engine
let wasmLoads = 0
let failNextLoad = true
const originalFetch = globalThis.fetch

before(async () => {
  // Bundle the actual browser modules, substituting only the WASM asset URL.
  const buildResult = await build({
    configFile: false, logLevel: 'silent',
    plugins: [{ name: 'test-local-wasm', enforce: 'pre',
      resolveId(id) { if (id.endsWith('.wasm?url')) return '\0local-wasm' },
      load(id) { if (id === '\0local-wasm') return 'export default "local-test.wasm"' },
    }],
    build: { write: false, minify: false, lib: { entry: 'tests/test-entry.ts', formats: ['es'] } },
  })
  const bundle = Array.isArray(buildResult) ? buildResult[0] : buildResult
  const chunk = bundle.output.find((item) => item.type === 'chunk' && item.isEntry)
  globalThis.fetch = async (url) => {
    assert.equal(url, 'local-test.wasm', 'Only the bundled WASM asset may be fetched')
    if (failNextLoad) { failNextLoad = false; return new Response('', { status: 503 }) }
    wasmLoads++
    return new Response(await readFile('node_modules/@dqbd/tiktoken/lite/tiktoken_bg.wasm'))
  }
  engine = await import(`data:text/javascript;base64,${Buffer.from(chunk.code).toString('base64')}`)
})

after(() => { engine?.freeTokenizer(); globalThis.fetch = originalFetch })

test('failed asset loading can be retried, concurrent callers share a promise, cleanup cancels pending creation', async () => {
  assert.throws(() => engine.tokenizeRaw('test'), /not ready/)
  await assert.rejects(engine.initTokenizer(), /503/)
  const cancelled = engine.initTokenizer()
  assert.equal(cancelled, engine.initTokenizer())
  engine.freeTokenizer()
  const current = engine.initTokenizer()
  assert.notEqual(cancelled, current)
  await assert.rejects(cancelled, /cancelled/)
  await current
  assert.equal(engine.isTokenizerReady(), true)
  assert.equal(wasmLoads, 1)
})

test('StrictMode effect replay and multiple owners preserve the encoder; final release frees it', async () => {
  const releaseA = engine.retainTokenizer()
  releaseA()
  const releaseB = engine.retainTokenizer()
  await Promise.resolve()
  assert.equal(engine.isTokenizerReady(), true)
  const releaseC = engine.retainTokenizer()
  releaseB()
  releaseB()
  await Promise.resolve()
  assert.equal(engine.isTokenizerReady(), true)
  releaseC()
  await Promise.resolve()
  assert.equal(engine.isTokenizerReady(), false)
  engine.freeTokenizer()
  await engine.initTokenizer()
  assert.equal(engine.isTokenizerReady(), true)
  assert.equal(wasmLoads, 1, 'Reinitialization reuses the original WASM instance')
})

test('known IDs, streaming Unicode, BOM, controls, CRLF, whitespace and exact UTF-16 offsets', () => {
  assert.deepEqual(Array.from(engine.tokenizeRaw('Hello, world!').tokens), [9906, 11, 1917, 0])
  for (const text of ['', 'hello  world\r\n\n\t', '\ufeffBOM\ufeff', '\0\u0001\u0008\u001b\u007f',
    'Hello \u{1f30d} \u4f60\u597d', '\u{1f469}\u200d\u{1f4bb} e\u0301 \u{1f1ee}\u{1f1f3}', '<|endoftext|>']) {
    const raw = engine.tokenizeRaw(text)
    assert.equal(raw.decodedPieces.join(''), text)
    assert.equal(raw.tokens.length, raw.decodedPieces.length)
    assert.equal(raw.charCount, Array.from(text).length)
    let cursor = 0
    raw.offsets.forEach(({ startIndex, endIndex }, index) => {
      assert.equal(startIndex, cursor)
      assert.equal(text.slice(startIndex, endIndex), raw.decodedPieces[index])
      cursor = endIndex
    })
    assert.equal(cursor, text.length)
  }
  const partial = engine.tokenizeRaw('\u{1f30d}')
  assert.ok(partial.decodedPieces.includes(''))
  assert.equal(partial.decodedPieces.at(-1), '\u{1f30d}')
  assert.throws(() => engine.tokenizeRaw('\ud800'), /unpaired/)
})

test('compatibility facade shares the encoder and reconstructs Unicode', async () => {
  const result = await engine.tokenizePrompt('\u{1f30d}\r\n')
  assert.equal(result.tokens.map((token) => token.text).join(''), '\u{1f30d}\r\n')
  assert.equal(result.characterCount, 3)
  assert.equal(wasmLoads, 1)
})

test('seeded mixed-script Unicode corpus round-trips without splitting UTF-16 surrogate pairs', () => {
  let seed = 12345
  const alphabet = ['a', ' ', '\r', '\n', '\0', '\ufeff', '\u0301', '\u4f60', '\u0915', '\u0627', '\u200d', '\u{1f469}', '\u{1f4bb}', '\u{1f30d}', '\u{10ffff}']
  for (let sample = 0; sample < 80; sample++) {
    let text = ''
    for (let index = 0; index < 40; index++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      text += alphabet[seed % alphabet.length]
    }
    const raw = engine.tokenizeRaw(text)
    assert.equal(raw.decodedPieces.join(''), text)
    raw.offsets.forEach(({ startIndex, endIndex }, index) => {
      assert.equal(text.slice(startIndex, endIndex), raw.decodedPieces[index])
      for (const point of raw.decodedPieces[index]) {
        const code = point.codePointAt(0)
        assert.ok(code < 0xd800 || code > 0xdfff)
      }
    })
  }
})

test('empty and clean input have finite zero savings', () => {
  const empty = engine.profilePrompt('')
  assert.deepEqual(empty, { rawText: '', totalTokens: 0, charCount: 0, diagnostics: [], projectedPrunedTokens: 0, savingsTokens: 0, bloatPercentage: 0, prunedText: '' })
  const clean = engine.profilePrompt('Hello, world!')
  assert.equal(clean.totalTokens, 4)
  assert.equal(clean.savingsTokens, 0)
  assert.deepEqual(clean.diagnostics, [])
})

test('fenced and embedded JSON compaction preserves strings, numeric lexemes and duplicate keys', () => {
  const text = 'Explain:\n```json\n{\n  "big": 9007199254740993,\n  "big": 1e+30,\n  "text": "a  b } \\\"",\n  "nested": [  1,  2  ]\n}\n```\nAnd [  3,  4  ]'
  const profile = engine.profilePrompt(text)
  assert.equal(profile.diagnostics.filter((d) => d.category === 'JSON_FORMATTING').length, 2)
  assert.ok(profile.prunedText.includes('"big":9007199254740993,"big":1e+30'))
  assert.ok(profile.prunedText.includes('"text":"a  b } \\\""'))
  assert.ok(profile.prunedText.includes('[1,2]'))
  assert.ok(profile.prunedText.endsWith('[3,4]'))
  assert.equal(engine.profilePrompt('{ invalid json }').diagnostics.length, 0)
})

test('overlapping JSON and whitespace edits count once and totals use full-context retokenization', () => {
  const text = '\u{1f30d} prefix\n{\n  "a": 1,  \n\n\n  "b": 2\n}\nend   '
  const profile = engine.profilePrompt(text)
  assert.equal(profile.prunedText, '\u{1f30d} prefix\n{"a":1,"b":2}\nend')
  assert.ok(profile.diagnostics.some((d) => d.category === 'WHITESPACE_BLEED'))
  assert.equal(profile.projectedPrunedTokens, engine.countTokens(profile.prunedText))
  assert.equal(profile.savingsTokens, profile.totalTokens - profile.projectedPrunedTokens)
  assert.equal(profile.bloatPercentage, profile.savingsTokens / profile.totalTokens * 100)
  const json = profile.diagnostics.find((d) => d.category === 'JSON_FORMATTING')
  assert.equal(text.slice(json.startIndex, json.endIndex), '{\n  "a": 1,  \n\n\n  "b": 2\n}')
})

test('blank-line suggestions normalize to LF; redundant constraints and placeholders are advisory', () => {
  const whitespace = engine.profilePrompt('Hello  \r\n\r\n\r\nworld\t')
  assert.ok(whitespace.diagnostics.some((d) => d.suggestedReplacement === '\n\n'))
  const text = "\u{1f30d} Do not repeat yourself; never invent sources. {{name}} ${input} <context> {{bad> ${bad}}"
  const result = engine.profilePrompt(text)
  assert.ok(result.diagnostics.some((d) => d.category === 'REDUNDANT_CONSTRAINT'))
  const markers = result.diagnostics.filter((d) => d.category === 'DYNAMIC_VAR')
  assert.deepEqual(markers.map((d) => text.slice(d.startIndex, d.endIndex)), ['{{name}}', '${input}', '<context>', '${bad}'])
  assert.ok(markers.every((d) => d.potentialSavingsTokens === 0))
  assert.ok(result.diagnostics.every((d) => d.suggestedReplacement === undefined))
  assert.equal(result.savingsTokens, 0)
  assert.equal(result.prunedText, text)
  assert.deepEqual(engine.profilePrompt(text), result, 'Diagnostic IDs and ordering are deterministic')
})

test('work limits fail explicitly instead of returning truncated results', () => {
  assert.throws(() => engine.profilePrompt('x'.repeat(50_001)), /50,000/)
  assert.throws(() => engine.profilePrompt('a '.repeat(5_001)), /5,000 tokens/)
  assert.throws(() => engine.profilePrompt('{{value}} '.repeat(201)), /200-diagnostic/)
})

test('whole-input JSON, 80-character constraints, LF normalization and neutral savings follow the rules', () => {
  const json = engine.profilePrompt('{\n  "name": "customer",\n  "active": true\n}')
  assert.equal(json.diagnostics[0].category, 'JSON_FORMATTING')
  assert.equal(json.prunedText, '{"name":"customer","active":true}')
  const atLimit = engine.profilePrompt(`do not${'x'.repeat(80)}never`)
  const beyondLimit = engine.profilePrompt(`do not${'x'.repeat(81)}never`)
  assert.equal(atLimit.diagnostics.filter((d) => d.category === 'REDUNDANT_CONSTRAINT').length, 1)
  assert.equal(beyondLimit.diagnostics.filter((d) => d.category === 'REDUNDANT_CONSTRAINT').length, 0)
  assert.equal(atLimit.prunedText, atLimit.rawText)
  const whitespace = engine.profilePrompt('A\n\n\nB   ')
  assert.ok(whitespace.diagnostics.some((d) => d.suggestedReplacement === '\n\n'))
  const variables = engine.profilePrompt('{{ticket}} ${tier} <context>')
  assert.equal(variables.diagnostics.length, 3)
  assert.ok(variables.diagnostics.every((d) => d.severity === 'neutral' && d.potentialSavingsTokens === 0))
  assert.equal(variables.savingsTokens, 0)
})

test('5,000-token warm decode benchmark (reported, not a hardware-dependent CI gate)', () => {
  const text = ' hello'.repeat(5_000)
  assert.equal(engine.tokenizeRaw(text).tokens.length, 5_000)
  for (let i = 0; i < 3; i++) engine.tokenizeRaw(text)
  const samples = []
  for (let i = 0; i < 15; i++) {
    const start = performance.now()
    engine.tokenizeRaw(text)
    samples.push(performance.now() - start)
  }
  samples.sort((a, b) => a - b)
  console.info(`Node ${process.version}, 5,000 tokens, warm decode p50=${samples[7].toFixed(2)}ms, p95=${samples[14].toFixed(2)}ms; browser performance may differ`)
})
