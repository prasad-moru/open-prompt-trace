import { init, Tiktoken } from '@dqbd/tiktoken/lite/init'
import model from '@dqbd/tiktoken/encoders/cl100k_base.json'
import wasmUrl from '@dqbd/tiktoken/lite/tiktoken_bg.wasm?url'

/** Loaded only through engine.initTokenizer(), never by the initial UI bundle. */
export async function initializeWasm(): Promise<void> {
  await init(async (imports) => {
    const response = await fetch(wasmUrl)
    if (!response.ok) throw new Error(`WASM load failed (${response.status}).`)
    return WebAssembly.instantiate(await response.arrayBuffer(), imports)
  })
}

export function createEncoder(): Tiktoken {
  return new Tiktoken(model.bpe_ranks, model.special_tokens, model.pat_str)
}
