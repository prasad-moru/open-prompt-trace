import { initTokenizer, tokenizeRaw } from '../core/tokenizer/engine'

/** Compatibility facade for the original manual tokenization API. */
export interface TokenizedResult {
  tokenCount: number
  tokens: Array<{ id: number; text: string }>
  characterCount: number
}

export const initializeTokenizer = initTokenizer

export async function tokenizePrompt(prompt: string): Promise<TokenizedResult> {
  await initTokenizer()
  const raw = tokenizeRaw(prompt)
  return {
    tokenCount: raw.tokens.length,
    tokens: Array.from(raw.tokens, (id, index) => ({ id, text: raw.decodedPieces[index] })),
    characterCount: raw.charCount,
  }
}
