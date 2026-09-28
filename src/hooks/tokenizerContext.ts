import { createContext, useContext } from 'react'

export interface TokenizerState { ready: boolean; error: string | null }
export const TokenizerContext = createContext<TokenizerState | null>(null)

export function useTokenizerState(): TokenizerState {
  const context = useContext(TokenizerContext)
  if (!context) throw new Error('Wrap the application in TokenizerProvider.')
  return context
}
