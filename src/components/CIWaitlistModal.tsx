import { useEffect, useRef, useState, type FormEvent } from 'react'
import { CheckCircle2, GitPullRequest, X, Zap } from 'lucide-react'
import { saveCIWaitlistEmail } from '../lib/ciWaitlist'

export function CIWaitlistModal({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const emailInput = useRef<HTMLInputElement>(null)
  const confirmation = useRef<HTMLHeadingElement>(null)
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const element = dialog.current!
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    element.showModal()
    document.body.style.overflow = 'hidden'
    emailInput.current?.focus()
    return () => {
      element.close()
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [])

  useEffect(() => {
    if (submitted) confirmation.current?.focus()
  }, [submitted])

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!event.currentTarget.reportValidity()) return
    setError(null)
    try {
      saveCIWaitlistEmail(email, window.localStorage)
      setSubmitted(true)
    } catch {
      setError('Could not save your request on this device. Check that local storage is available and try again.')
    }
  }

  return (
    <dialog ref={dialog} className="ci-modal" aria-labelledby={submitted ? 'ci-success-title' : 'ci-waitlist-title'}
      aria-describedby={submitted ? 'ci-success-description' : 'ci-waitlist-description'}
      onCancel={(event) => { event.preventDefault(); onClose() }}>
      <button className="ci-modal-close" type="button" onClick={onClose} aria-label="Close CI waitlist"><X size={18} aria-hidden="true" /></button>
      {submitted ? <div className="ci-success">
        <CheckCircle2 size={44} aria-hidden="true" />
        <h2 id="ci-success-title" ref={confirmation} tabIndex={-1}>You're on the priority list for the GitHub Action beta</h2>
        <p id="ci-success-description">Your request is saved on this device for this preview. No email has been sent.</p>
        <button className="ci-primary-button" type="button" onClick={onClose}>Back to profiling</button>
      </div> : <>
        <span className="ci-modal-icon"><GitPullRequest size={26} aria-hidden="true" /></span>
        <p className="eyebrow">GITHUB ACTION · EARLY ACCESS</p>
        <h2 id="ci-waitlist-title">Automate Prompt Regression in CI/CD</h2>
        <p id="ci-waitlist-description">Block bloated system prompts and unminified JSON before merging to main.</p>
        <form onSubmit={submit} className="ci-waitlist-form">
          <label htmlFor="ci-email">Email address</label>
          <input ref={emailInput} id="ci-email" name="email" type="email" required autoComplete="email" maxLength={254}
            placeholder="you@company.com" value={email} onChange={(event) => { setEmail(event.target.value); setError(null) }}
            aria-describedby={error ? 'ci-storage-note ci-form-error' : 'ci-storage-note'} />
          {error && <p id="ci-form-error" className="ci-form-error" role="alert">{error}</p>}
          <button className="ci-primary-button" type="submit"><Zap size={16} aria-hidden="true" />Request Early Access</button>
        </form>
        <p className="ci-storage-note" id="ci-storage-note">Preview waitlist · Saved only in this browser. No external requests.</p>
      </>}
    </dialog>
  )
}
