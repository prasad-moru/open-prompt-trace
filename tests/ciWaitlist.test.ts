import { describe, expect, it } from 'vitest'
import { CI_WAITLIST_STORAGE_KEY, saveCIWaitlistEmail } from '../src/lib/ciWaitlist'

describe('local CI waitlist capture', () => {
  it('stores normalized emails under the requested key and deduplicates repeat requests', () => {
    const data = new Map<string, string>()
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) } }
    saveCIWaitlistEmail('  Developer@Example.com  ', storage)
    saveCIWaitlistEmail('developer@example.com', storage)
    saveCIWaitlistEmail('second@example.com', storage)
    expect([...data.keys()]).toEqual([CI_WAITLIST_STORAGE_KEY])
    const entries = JSON.parse(data.get(CI_WAITLIST_STORAGE_KEY)!)
    expect(entries.map((entry: { email: string }) => entry.email)).toEqual(['developer@example.com', 'second@example.com'])
    expect(Number.isNaN(Date.parse(entries[0].createdAt))).toBe(false)
  })
  it('propagates disabled storage and quota failures rather than reporting false success', () => {
    expect(() => saveCIWaitlistEmail('a@example.com', { getItem() { throw new Error('blocked') }, setItem() {} })).toThrow('blocked')
    expect(() => saveCIWaitlistEmail('a@example.com', { getItem() { return null }, setItem() { throw new Error('quota') } })).toThrow('quota')
  })
  it('rejects blank input and preserves malformed existing storage', () => {
    let writes = 0
    const storage = { getItem: () => '{broken', setItem: () => { writes++ } }
    expect(() => saveCIWaitlistEmail(' ', storage)).toThrow('required')
    expect(() => saveCIWaitlistEmail('a@example.com', storage)).toThrow()
    expect(() => saveCIWaitlistEmail('a@example.com', { ...storage, getItem: () => '[{"email":2}]' })).toThrow('could not be read')
    expect(writes).toBe(0)
  })
})
