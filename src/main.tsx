import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { TokenizerProvider } from './hooks/TokenizerProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TokenizerProvider><App /></TokenizerProvider>
  </StrictMode>,
)
