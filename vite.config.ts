import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), wasm(), topLevelAwait()],
  // This app targets evergreen browsers. Avoid the TLA plugin's legacy targets.
  build: { target: 'esnext' },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,mjs}'],
    fileParallelism: false,
  },
})
