import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { I18nProvider, LanguageSwitcher } from '@localizationhub/i18n'
import App from './App'
import AppErrorBoundary from './AppErrorBoundary'
import '@localizationhub/i18n/styles.css'

// Safari < 15.4 lacks `structuredClone`. The workspace deep-clones JSON-derived
// project state, so a JSON round-trip is a faithful fallback on those engines.
if (typeof globalThis.structuredClone !== 'function') {
  ;(globalThis as any).structuredClone = (value: unknown) => JSON.parse(JSON.stringify(value))
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <LanguageSwitcher />
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </I18nProvider>
  </StrictMode>,
)
