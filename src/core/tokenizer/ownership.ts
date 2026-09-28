import { freeTokenizer } from './engine'

const owners = new Set<symbol>()

/** Provider-owned lease; microtask cleanup survives StrictMode's effect replay. */
export function retainTokenizer(): () => void {
  const owner = Symbol('tokenizer-owner')
  owners.add(owner)
  return () => {
    if (!owners.delete(owner)) return
    queueMicrotask(() => {
      if (owners.size === 0) freeTokenizer()
    })
  }
}
