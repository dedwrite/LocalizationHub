const staleMessage = 'The Web App was updated while this page was open. Save any unsaved work, reload this page, then import the file again. No project was created.'
const unavailableMessage = 'Could not verify the current Web App version. Check your connection and retry importing. No project was created.'

/** Cloud imports must not silently use a parser left in memory before a deploy.
 * This is a freshness check, not an auth/security boundary. Never reload an
 * editor automatically, re-parse persisted projects, or change offline storage.
 */
export async function checkWebBuild(loadedEntries: readonly string[], fetcher: typeof fetch = fetch): Promise<void> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  let entries: string[]
  try {
    const response = await fetcher('/web-build.json', { cache: 'no-store', signal: controller.signal })
    if (!response.ok) throw new Error()
    const manifest = await response.json()
    if (!Array.isArray(manifest?.entries) || !manifest.entries.length ||
      !manifest.entries.every((entry: unknown) => typeof entry === 'string' && /^assets\/[^/]+\.js$/u.test(entry))) throw new Error()
    entries = manifest.entries
  } catch {
    throw new Error(unavailableMessage)
  } finally {
    clearTimeout(timeout)
  }
  if (!loadedEntries.length || loadedEntries.length !== entries.length || !loadedEntries.every((entry) => entries.includes(entry))) {
    throw new Error(staleMessage)
  }
}

export async function assertCurrentWebBuild(): Promise<void> {
  // Vite dev/HMR has no immutable build artifact. Production/review builds do.
  if (import.meta.env.DEV) return
  const loadedEntries = Array.from(document.querySelectorAll<HTMLScriptElement>('script[type="module"][src]'))
    .map((script) => new URL(script.src))
    .filter((url) => url.origin === location.origin)
    .map((url) => url.pathname.slice(1))
  await checkWebBuild(loadedEntries)
}
