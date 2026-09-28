import { forwardRef } from 'react'

interface PromptEditorProps { prompt: string; onChange: (text: string) => void }

export const PromptEditor = forwardRef<HTMLTextAreaElement, PromptEditorProps>(function PromptEditor({ prompt, onChange }, ref) {
  return (
    <section className="card" aria-labelledby="prompt-heading">
      <div className="card-header">
        <h2 id="prompt-heading"><label htmlFor="prompt">Your prompt</label></h2>
        <button type="button" onClick={() => onChange('')} disabled={!prompt}>Clear</button>
      </div>
      <textarea ref={ref} id="prompt" value={prompt} onChange={(event) => onChange(event.target.value)}
        placeholder="Type or paste a prompt here…" spellCheck={false} aria-describedby="profile-limits" />
      <div className="card-footer"><span>{Array.from(prompt).length.toLocaleString()} characters</span><span>200 ms debounce</span></div>
    </section>
  )
})
