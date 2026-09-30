import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import { I18nProvider } from '@localizationhub/i18n'
import App from './App'
import AppErrorBoundary from './AppErrorBoundary'

export function renderPublicPage(path: string) {
  return renderToString(<StrictMode><I18nProvider initialLocale="en"><AppErrorBoundary><App initialPath={path} /></AppErrorBoundary></I18nProvider></StrictMode>)
}
