import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { I18nProvider, LanguageSwitcher } from '@localizationhub/i18n'
import './index.css'
import '@localizationhub/i18n/styles.css'
import App from './App.tsx'
import LhRadio from './lhRadio/LhRadio'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <App />
      <footer className="desktop-chrome-footer" data-i18n-skip>
        <LanguageSwitcher />
      </footer>
      <LhRadio />
    </I18nProvider>
  </StrictMode>,
)
