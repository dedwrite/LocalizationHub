import { lazy, Suspense, useEffect, useState } from 'react'
import { LanguageSwitcher, useI18n } from '@localizationhub/i18n'
import { allowHistoryNavigation } from './navigation'
import Landing from './pages/LandingPage'
import { DownloadPage, DocumentPage, NotFound } from './pages/InfoPages'
import LhRadio from './lhRadio/LhRadio'
import CommandCenter from './delight/CommandCenter'

const AppWorkspace = lazy(() => import('./AppWorkspace'))
const LocalWorkspace = lazy(() => import('./LocalWorkspace'))
const AdminConsole = lazy(() => import('./AdminConsole'))

import './styles.css'
import './experience-polish.css'
import './workspace-deep-polish.css'
import './visual-refinement.css'
import './marketing-atmosphere.css'
import './delight/delight.css'
import './delight/quiet-polish.css'

function RouteLoading() {
  const { t } = useI18n()
  return (
    <main
      className="route-loading"
      role="status"
      aria-live="polite"
      data-i18n-skip
    >
      {t('projects.openingWorkspace')}
    </main>
  )
}

export default function App() {
  const [path, setPath] = useState(window.location.pathname)
  useEffect(() => {
    const handle = (event: PopStateEvent) => {
      if (allowHistoryNavigation(event)) setPath(window.location.pathname)
    }
    window.addEventListener('popstate', handle)
    return () => window.removeEventListener('popstate', handle)
  }, [])
  const suppressRadio = path === '/app/admin' || path.startsWith('/app/admin/')
  const isAppSurface = path === '/app' || path.startsWith('/app/')
  return (
    <>
      <Suspense fallback={<RouteLoading />}>
        <RoutedPage path={path} />
      </Suspense>
      <CommandCenter />
      {!suppressRadio && <LhRadio />}
      {isAppSurface && <LanguageSwitcher dock />}
    </>
  )
}

function RoutedPage({ path }: { path: string }) {
  if (path === '/app/local') return <LocalWorkspace />
  if (path === '/app/admin' || path.startsWith('/app/admin/'))
    return <AdminConsole />
  if (path === '/app' || path.startsWith('/app/')) return <AppWorkspace />
  if (path === '/download') return <DownloadPage />
  if (path === '/privacy') return <DocumentPage kind="privacy" />
  if (path === '/terms') return <DocumentPage kind="terms" />
  if (path !== '/') return <NotFound />
  return <Landing />
}
