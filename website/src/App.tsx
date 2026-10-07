import { lazy, Suspense, useEffect, useState } from 'react'
import { LanguageSwitcher, useI18n } from '@localizationhub/i18n'
import { allowHistoryNavigation } from './navigation'
import ProductDetails from './productDetails/ProductDetails'
import HomePage from './productHome/HomePage'
import { DownloadPage, DocumentPage, NotFound } from './pages/InfoPages'
import { CapabilityPage, ReferenceIndex } from './pages/CapabilityPages'
import { updateRouteMetadata } from './publicMetadata'
import CommandCenter from './delight/CommandCenter'
const LhRadio = lazy(() => import('./lhRadio/LhRadio'))

const AppWorkspace = lazy(() => import('./AppWorkspace'))
const LocalWorkspace = lazy(() => import('./LocalWorkspace'))
const AdminConsole = lazy(() => import('./AdminConsole'))

import './styles.css'
import './app-palette.css'
import './experience-polish.css'
import './workspace-deep-polish.css'
import './visual-refinement.css'
import './delight/delight.css'
import './delight/quiet-polish.css'
import './public-site.css'

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

export default function App({ initialPath = '/' }: { initialPath?: string }) {
  const [path, setPath] = useState(() => typeof window === 'undefined' ? initialPath : window.location.pathname)
  const [clientReady, setClientReady] = useState(false)
  useEffect(() => { setClientReady(true) }, [])
  useEffect(() => { updateRouteMetadata(path) }, [path])
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
      <Suspense fallback={null}>
        {clientReady && !suppressRadio && <LhRadio />}
      </Suspense>
      {isAppSurface && <LanguageSwitcher dock />}
    </>
  )
}

function RoutedPage({ path }: { path: string }) {
  if (path === '/product') return <ProductDetails />
  if (path === '/app/local') return <LocalWorkspace />
  if (path === '/app/admin' || path.startsWith('/app/admin/'))
    return <AdminConsole />
  if (path === '/app' || path.startsWith('/app/')) return <AppWorkspace />
  if (path === '/download') return <DownloadPage />
  if (path === '/privacy') return <DocumentPage kind="privacy" />
  if (path === '/terms') return <DocumentPage kind="terms" />
  if (path === '/reference') return <ReferenceIndex />
  // The reference pages keep their own addresses: an engine or a format can be
  // linked from outside the site without an anchor into a shared page.
  if (path === '/godot') return <CapabilityPage page="godot" />
  if (path === '/unreal') return <CapabilityPage page="unreal" />
  if (path === '/unity') return <CapabilityPage page="unity" />
  if (path === '/formats/json') return <CapabilityPage page="json" />
  if (path === '/formats/po') return <CapabilityPage page="po" />
  if (path === '/features/translation-memory') return <CapabilityPage page="memory" />
  if (path !== '/') return <NotFound />
  return <HomePage />
}
