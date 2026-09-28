import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'

// https://vite.dev/config/
export default defineConfig({
  // Evergreen production browsers support TLA natively. The legacy transform
  // cannot process Vite 8's split dynamic imports, so use it only during dev.
  plugins: [react(), wasm(), { ...topLevelAwait(), apply: 'serve' }],
  // This app targets evergreen browsers. Avoid the TLA plugin's legacy targets.
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const path = id.replaceAll('\\', '/')
          if (path.includes('/node_modules/@dqbd/tiktoken/') || path.endsWith('/src/core/tokenizer/runtime.ts')) {
            return 'vendor-tokenizer'
          }
        },
        // WASM remains a separately fetched binary owned by the lazy vendor chunk.
        assetFileNames(asset) {
          return asset.names.some((name) => name.endsWith('.wasm'))
            ? 'assets/vendor-tokenizer-[hash][extname]'
            : 'assets/[name]-[hash][extname]'
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,mjs}'],
    fileParallelism: false,
  },
})
