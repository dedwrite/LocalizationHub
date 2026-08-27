// Safe client-side navigation for the web workspace.
//
// `window.history.pushState` updates the URL, then a synthetic `popstate`
// event tells the router to re-render. Some older WebKit builds do not expose
// a `PopStateEvent` constructor, so fall back to a generic `Event`.

export function navigate(path: string) {
  window.history.pushState({}, '', path)
  dispatchPopState()
}

function dispatchPopState() {
  try {
    window.dispatchEvent(new PopStateEvent('popstate'))
  } catch {
    window.dispatchEvent(new Event('popstate'))
  }
}
