import { useEffect, useState } from 'react'
import { initTokenizer, tokenizeRaw, type RawTokenization } from '../core/tokenizer/engine'
import { assertInputWithinLimit, profilePrompt, PROFILER_LIMITS, type ProfilerResult } from '../core/profiler/linter'
import { useTokenizerState } from './tokenizerContext'

interface CompletedProfile {
  text: string
  profile: ProfilerResult | null
  tokenization: RawTokenization | null
  error: string | null
}

export interface PromptProfileState {
  status: 'initializing' | 'profiling' | 'ready' | 'error'
  profile: ProfilerResult | null
  tokenization: RawTokenization | null
  error: string | null
}

export function usePromptProfile(text: string): PromptProfileState {
  const tokenizer = useTokenizerState()
  const [completed, setCompleted] = useState<CompletedProfile | null>(null)
  useEffect(() => {
    if (!tokenizer.ready) return
    let active = true
    const timeout = window.setTimeout(() => {
      void (async () => {
        try {
          assertInputWithinLimit(text)
          await initTokenizer()
          if (!active) return
          const tokenization = tokenizeRaw(text, PROFILER_LIMITS.maxTokens)
          const profile = profilePrompt(text, tokenization)
          setCompleted({ text, profile, tokenization, error: null })
        } catch (error) {
          if (active) setCompleted({ text, profile: null, tokenization: null,
            error: error instanceof Error ? error.message : 'Unable to profile this prompt.' })
        }
      })()
    }, 200)
    return () => { active = false; window.clearTimeout(timeout) }
  }, [text, tokenizer.ready])

  if (tokenizer.error) return { status: 'error', profile: null, tokenization: null, error: tokenizer.error }
  if (!tokenizer.ready) return { status: 'initializing', profile: null, tokenization: null, error: null }
  if (completed?.text !== text) return { status: 'profiling', profile: null, tokenization: null, error: null }
  return { status: completed.error ? 'error' : 'ready', profile: completed.profile,
    tokenization: completed.tokenization, error: completed.error }
}
