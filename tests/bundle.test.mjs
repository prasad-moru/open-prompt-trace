import { expect, test, vi } from 'vitest'
import { build, createLogger } from 'vite'

test('production isolates vocabulary and WASM behind a dynamic vendor chunk while keeping React in the entry', async () => {
  const warnings = []
  const logger = createLogger('silent')
  logger.warn = (message) => warnings.push(message)
  logger.warnOnce = (message) => warnings.push(message)
  // Vitest otherwise leaves NODE_ENV=test, which bundles React's development runtime.
  vi.stubEnv('NODE_ENV', 'production')
  let result
  try {
    result = await build({ mode: 'production', customLogger: logger, build: { write: false } })
  } finally {
    vi.unstubAllEnvs()
  }
  const { output } = Array.isArray(result) ? result[0] : result
  const chunks = output.filter((item) => item.type === 'chunk')
  const entry = chunks.find((chunk) => chunk.isEntry)
  const vendor = chunks.find((chunk) => chunk.name === 'vendor-tokenizer')
  expect(entry).toBeDefined()
  expect(vendor).toBeDefined()
  const entryModules = Object.keys(entry.modules).map((id) => id.replaceAll('\\', '/'))
  const vendorModules = Object.keys(vendor.modules).map((id) => id.replaceAll('\\', '/'))
  expect(entryModules.some((id) => id.includes('/node_modules/react/'))).toBe(true)
  expect(entryModules.some((id) => id.includes('/node_modules/react-dom/'))).toBe(true)
  expect(entryModules.some((id) => id.includes('@dqbd/tiktoken'))).toBe(false)
  expect(vendorModules.some((id) => id.includes('cl100k_base.json'))).toBe(true)
  expect(vendorModules.some((id) => id.includes('tiktoken_bg.wasm'))).toBe(true)
  expect(vendorModules.some((id) => /\/node_modules\/react(?:-dom)?\//.test(id))).toBe(false)
  expect(entry.imports).not.toContain(vendor.fileName)
  expect(entry.dynamicImports).toContain(vendor.fileName)
  // Rolldown may reuse an interop helper from the entry; only the reverse
  // dependency would eagerly load the tokenizer and violate this boundary.
  const html = output.find((item) => item.fileName === 'index.html')
  expect(String(html.source)).not.toContain(vendor.fileName)
  const wasmAsset = output.find((item) => item.type === 'asset' && item.fileName.endsWith('.wasm'))
  expect(wasmAsset.fileName).toMatch(/assets\/vendor-tokenizer-.*\.wasm$/)
  expect(Buffer.byteLength(entry.code)).toBeLessThan(350_000)
  expect(warnings).toEqual([])
}, 20_000)
