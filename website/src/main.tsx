import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import AppErrorBoundary from './AppErrorBoundary'

// Safari < 15.4 lacks `structuredClone`. The workspace deep-clones JSON-derived
// project state, so a JSON round-trip is a faithful fallback on those engines.
if (typeof globalThis.structuredClone !== 'function') {
  ;(globalThis as any).structuredClone = (value: unknown) => JSON.parse(JSON.stringify(value))
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
)
