import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { I18nProvider, LanguageSwitcher } from '@localizationhub/i18n'
import './index.css'
import '@localizationhub/i18n/styles.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <LanguageSwitcher />
      <App />
    </I18nProvider>
  </StrictMode>,
)
