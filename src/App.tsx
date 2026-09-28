import { useRef, useState } from 'react'
import { PromptEditor } from './components/PromptEditor'
import { ProfilerPanel } from './components/ProfilerPanel'
import { ScaleMetrics } from './components/ScaleMetrics'
import { ProfileDiagnostics } from './components/ProfileDiagnostics'
import { usePromptProfile } from './hooks/usePromptProfile'
import './App.css'

const example = [
  'You are a support assistant for an online store.',
  'Summarize the customer issue, recommend a next step, and return JSON.',
  "Do not invent order details. Never promise a refund without evidence.",
  '', '', '',
  'Customer ticket: {{ticket_text}}',
  'Account tier: ${customer_tier}',
  '',
  'Use this response format:',
  '{',
  '    "summary": "A concise description of the issue",',
  '    "priority": "normal",',
  '    "next_steps": [',
  '        "Verify the order status",',
  '        "Explain the available options"',
  '    ]',
  '}',
  '',
  'Keep the response helpful and specific.   ',
].join('\n')

function App() {
  const [prompt, setPrompt] = useState(example)
  const editor = useRef<HTMLTextAreaElement>(null)
  const state = usePromptProfile(prompt)
  const selectRange = (start: number, end: number) => {
    editor.current?.focus()
    editor.current?.setSelectionRange(start, end)
  }
  return (
    <main className="app-shell">
      <header className="app-header">
        <a className="brand" href="./"><span className="brand-mark" aria-hidden="true">[ ]</span> Open Prompt Trace</a>
        <span className="privacy"><span aria-hidden="true" /> Runs in your browser</span>
      </header>
      <section className="intro">
        <p className="eyebrow">THE BUILDING BLOCKS OF LANGUAGE</p>
        <h1>See your prompt, token by token.</h1>
        <p>Explore token boundaries, spot formatting overhead, and review opportunities to trim your prompt.</p>
      </section>
      <div className="workspace">
        <PromptEditor ref={editor} prompt={prompt} onChange={setPrompt} />
        <ProfilerPanel state={state} />
      </div>
      <ScaleMetrics profile={state.profile} />
      <p className="help">Unicode characters stay intact; a thin marker indicates a token whose bytes complete in a later token. Counts use cl100k_base. For GPT-4o and models with other encodings: estimates based on cl100k proxy.</p>
      <p className="help" id="profile-limits">Profiling limits: 50,000 UTF-16 code units, 5,000 tokens, and 200 findings. Your input is never truncated.</p>
      {state.profile && <ProfileDiagnostics profile={state.profile} onSelectRange={selectRange} />}
      <footer className="page-footer">Local tokenization · Powered by tiktoken + WebAssembly · Your prompt stays on this device</footer>
    </main>
  )
}

export default App
