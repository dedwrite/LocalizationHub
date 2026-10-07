// Safe client-side navigation for the web workspace.
//
// `window.history.pushState` updates the URL, then a synthetic `popstate`
// event tells the router to re-render. Some older WebKit builds do not expose
// a `PopStateEvent` constructor, so fall back to a generic `Event`.

type NavigationGuard = (resume: () => void) => boolean
let guard: NavigationGuard | undefined
let guardedUrl = ''

export function setNavigationGuard(next: NavigationGuard) {
  guard = next
  guardedUrl = window.location.href
  return () => { if (guard === next) guard = undefined }
}

/** Run at the router boundary BEFORE changing the mounted route. Window
 * popstate handlers must not race a separately registered capture listener. */
export function allowHistoryNavigation(event: PopStateEvent) {
  const destination = window.location.href
  if (guard && event.isTrusted && destination !== guardedUrl && !guard(() => commitNavigation(destination))) {
    event.stopImmediatePropagation()
    window.history.pushState({}, '', guardedUrl)
    return false
  }
  guardedUrl = destination
  return true
}

export function navigate(path: string, options: {replace?: boolean} = {}) {
  if (guard && !guard(() => commitNavigation(path, options.replace))) return
  commitNavigation(path, options.replace)
}

function commitNavigation(path: string, replace = false) {
  if (replace) window.history.replaceState({}, '', path)
  else window.history.pushState({}, '', path)
  dispatchPopState()
}

function dispatchPopState() {
  try {
    window.dispatchEvent(new PopStateEvent('popstate'))
  } catch {
    window.dispatchEvent(new Event('popstate'))
  }
}
