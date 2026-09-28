import { init, Tiktoken } from '@dqbd/tiktoken/lite/init'
import model from '@dqbd/tiktoken/encoders/cl100k_base.json'
import wasmUrl from '@dqbd/tiktoken/lite/tiktoken_bg.wasm?url'

export interface TokenOffset {
  startIndex: number
  endIndex: number
}

export interface RawTokenization {
  tokens: Uint32Array
  decodedPieces: string[]
  /** Half-open UTF-16 offsets. A leading partial Unicode token may be empty. */
  offsets: TokenOffset[]
  charCount: number
}

let wasmPromise: Promise<void> | undefined
let initializationPromise: Promise<void> | undefined
let encoder: Tiktoken | undefined
let generation = 0

function initializeWasm(): Promise<void> {
  if (!wasmPromise) {
    const request = init(async (imports) => {
      // The WASM and vocabulary are bundled local assets, never remote services.
      const response = await fetch(wasmUrl)
      if (!response.ok) throw new Error(`WASM load failed (${response.status}).`)
      return WebAssembly.instantiate(await response.arrayBuffer(), imports)
    })
    wasmPromise = request
    void request.catch(() => {
      if (wasmPromise === request) wasmPromise = undefined
    })
  }
  return wasmPromise
}

/** Concurrent callers receive the same promise; successful WASM init is permanent. */
export function initTokenizer(): Promise<void> {
  if (initializationPromise) return initializationPromise
  if (encoder) return Promise.resolve()
  const requestedGeneration = generation
  const request = initializeWasm().then(() => {
    if (requestedGeneration !== generation) {
      throw new Error('Tokenizer initialization was cancelled by cleanup.')
    }
    encoder = new Tiktoken(model.bpe_ranks, model.special_tokens, model.pat_str)
  })
  initializationPromise = request
  const clearPending = () => {
    if (initializationPromise === request) initializationPromise = undefined
  }
  void request.then(clearPending, clearPending)
  return request
}

export function isTokenizerReady(): boolean {
  return encoder !== undefined
}

/** Releases encoder allocations, not the app-lifetime WASM module. Safe repeatedly. */
export function freeTokenizer(): void {
  generation++
  encoder?.free()
  encoder = undefined
  initializationPromise = undefined
}

function requireEncoder(): Tiktoken {
  if (!encoder) throw new Error('Tokenizer is not ready. Await initTokenizer() first.')
  return encoder
}

/** Count without decoding or creating visualization objects. */
export function countTokens(text: string): number {
  return requireEncoder().encode_ordinary(text).length
}

export function tokenizeRaw(text: string, maxTokens = Infinity): RawTokenization {
  const activeEncoder = requireEncoder()
  let charCount = 0
  for (const character of text) {
    const point = character.codePointAt(0)!
    if (point >= 0xd800 && point <= 0xdfff) {
      throw new Error('The prompt contains an unpaired UTF-16 surrogate. Use valid Unicode text.')
    }
    charCount++
  }
  const tokens = activeEncoder.encode_ordinary(text)
  if (tokens.length > maxTokens) {
    throw new Error(`Profiling is limited to ${maxTokens.toLocaleString()} tokens. Shorten the prompt to continue.`)
  }
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
  const decodedPieces: string[] = []
  const offsets: TokenOffset[] = []
  let position = 0
  for (let index = 0; index < tokens.length; index++) {
    // Streaming buffers partial bytes until their closing token. ignoreBOM
    // preserves literal U+FEFF rather than stripping it from the prompt.
    const piece = decoder.decode(activeEncoder.decode_single_token_bytes(tokens[index]), {
      stream: index < tokens.length - 1,
    })
    decodedPieces.push(piece)
    offsets.push({ startIndex: position, endIndex: position + piece.length })
    position += piece.length
  }
  return { tokens, decodedPieces, offsets, charCount }
}
