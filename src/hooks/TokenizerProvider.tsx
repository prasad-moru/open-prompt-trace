import { useEffect, useState, type ReactNode } from 'react'
import { initTokenizer } from '../core/tokenizer/engine'
import { retainTokenizer } from '../core/tokenizer/ownership'
import { TokenizerContext, type TokenizerState } from './tokenizerContext'

export function TokenizerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TokenizerState>({ ready: false, error: null })
  useEffect(() => {
    const release = retainTokenizer()
    let active = true
    initTokenizer().then(
      () => { if (active) setState({ ready: true, error: null }) },
      () => { if (active) setState({ ready: false, error: 'Unable to load the local tokenizer. Reload the page to retry.' }) },
    )
    return () => { active = false; release() }
  }, [])
  return <TokenizerContext.Provider value={state}>{children}</TokenizerContext.Provider>
}
