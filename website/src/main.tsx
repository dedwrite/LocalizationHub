import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { I18nProvider } from '@localizationhub/i18n'
import App from './App'
import AppErrorBoundary from './AppErrorBoundary'
import '@localizationhub/i18n/styles.css'

// Safari < 15.4 lacks `structuredClone`. The workspace deep-clones JSON-derived
// project state, so a JSON round-trip is a faithful fallback on those engines.
if (typeof globalThis.structuredClone !== 'function') {
  ;(globalThis as any).structuredClone = (value: unknown) => JSON.parse(JSON.stringify(value))
}

const root = document.getElementById('root')!
const prerendered = root.dataset.prerendered === window.location.pathname
const application = (
  <StrictMode>
    <I18nProvider initialLocale={prerendered ? 'en' : undefined}>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </I18nProvider>
  </StrictMode>
)
if (prerendered) hydrateRoot(root, application)
else createRoot(root).render(application)
