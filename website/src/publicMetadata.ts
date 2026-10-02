const origin = 'https://localizationhub.app'
export const publicMetadata = {
  '/': { title: 'LocalizationHub — Game localization, local-first', description: 'Translate and review game text in a local-first workspace. Open JSON, CSV, and PO in your browser, or extract supported Godot, Unreal, and Unity text on Windows.' },
  '/privacy': { title: 'Privacy — LocalizationHub', description: 'How LocalizationHub handles browser-local projects, Cloud data, backups, retention, deletion, and third-party translation services.' },
  '/terms': { title: 'Terms — LocalizationHub', description: 'Terms for using LocalizationHub, keeping local backups, and collaborating on Cloud localization projects.' },
  '/download': { title: 'Windows app — LocalizationHub', description: 'The LocalizationHub Windows app extracts supported Godot, Unreal and Unity game text locally. The desktop build is a private tester preview; the browser editor is public.' },
} as const
export type PublicRoute = keyof typeof publicMetadata
/* Workspace routes are application shells, not pages: a crawler that follows
 * one gains nothing, so they are noindex, nofollow. Everything else that is not
 * a real public page keeps noindex but stays followable. */
const workspaceRoute = /^\/app(?:\/|$)/
export function metadataFor(path: string) {
  const page = publicMetadata[path as PublicRoute]
  return { title: page?.title ?? 'Workspace — LocalizationHub', description: page?.description ?? 'Your LocalizationHub translation workspace.', canonical: `${origin}${path}`, image: `${origin}/og-card.png`, robots: page ? 'index, follow' : workspaceRoute.test(path) ? 'noindex, nofollow' : 'noindex, follow' }
}
export function updateRouteMetadata(path: string) {
  const meta = metadataFor(path)
  document.title = meta.title
  function setMeta(attribute: 'name' | 'property', key: string, content: string) {
    let node = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)
    if (!node) { node = document.createElement('meta'); node.setAttribute(attribute, key); document.head.append(node) }
    node.content = content
  }
  setMeta('name', 'description', meta.description)
  setMeta('name', 'robots', meta.robots)
  setMeta('name', 'theme-color', path === '/' ? '#111016' : '#0b0d11')
  for (const prefix of ['og', 'twitter']) {
    const attribute = prefix === 'og' ? 'property' : 'name'
    setMeta(attribute, `${prefix}:title`, meta.title)
    setMeta(attribute, `${prefix}:description`, meta.description)
    setMeta(attribute, `${prefix}:image`, meta.image)
  }
  setMeta('property', 'og:url', meta.canonical)
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.append(canonical) }
  canonical.href = meta.canonical
  // Application schema belongs only to the public product route.
  const schema = document.head.querySelector<HTMLScriptElement>('#product-schema')
  if (schema) schema.type = path === '/' ? 'application/ld+json' : 'application/json'
}
