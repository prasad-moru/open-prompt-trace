export const CI_WAITLIST_STORAGE_KEY = 'opt_ci_waitlist'

export interface CIWaitlistSubmission {
  email: string
  createdAt: string
}

/** Local-only milestone capture. Storage failures propagate to the modal. */
export function saveCIWaitlistEmail(email: string, storage: Pick<Storage, 'getItem' | 'setItem'>): void {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail) throw new Error('Email is required.')
  const existing: unknown = JSON.parse(storage.getItem(CI_WAITLIST_STORAGE_KEY) ?? '[]')
  if (!Array.isArray(existing) || !existing.every((entry): entry is CIWaitlistSubmission =>
    typeof entry === 'object' && entry !== null && typeof entry.email === 'string' && typeof entry.createdAt === 'string')) {
    throw new Error('Existing local waitlist data could not be read.')
  }
  if (existing.some((entry) => entry.email.toLowerCase() === normalizedEmail)) return
  storage.setItem(CI_WAITLIST_STORAGE_KEY, JSON.stringify([
    ...existing, { email: normalizedEmail, createdAt: new Date().toISOString() },
  ]))
}
