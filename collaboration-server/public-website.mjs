import { stat, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const MIME_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.manifest', 'application/manifest+json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['.webp', 'image/webp'],
])

export function resolvePublicWebsiteDirectory() {
  return fileURLToPath(new URL('../website/dist/', import.meta.url))
}

export function ensurePublicWebsiteDirectory(distDir) {
  if (!existsSync(distDir)) {
    throw new Error('Public website serving is enabled, but the website build is missing.')
  }
}

function isBackendPath(url) {
  let pathname
  try {
    pathname = new URL(url, 'http://localhost').pathname
  } catch {
    return true
  }
  return pathname === '/health' ||
    pathname.startsWith('/api/') ||
    pathname === '/api' ||
    pathname === '/verify-email' ||
    pathname === '/favicon.ico' ||
    pathname === '/apple-touch-icon.png'
}

function getSafePathname(url) {
  let pathname
  try {
    pathname = decodeURIComponent(new URL(url, 'http://localhost').pathname)
  } catch {
    return null
  }
  if (pathname.includes('\0') || pathname.split('/').includes('..')) return null
  return pathname
}

function cachePolicy(relativePath) {
  if (relativePath === 'web-build.json') return 'no-store'
  if (relativePath.startsWith('assets/') && /-[A-Za-z0-9_-]{6,}\./u.test(relativePath)) {
    return 'public, max-age=31536000, immutable'
  }
  if (relativePath === 'index.html' || relativePath.endsWith('/index.html') || relativePath.endsWith('.html')) return 'no-cache'
  return 'public, max-age=86400'
}

async function readResource(distDir, relativePath) {
  const resolved = path.resolve(distDir, relativePath)
  const root = path.resolve(distDir)
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) return null
  try {
    const info = await stat(resolved)
    if (!info.isFile()) return null
    return { resolved, size: info.size }
  } catch {
    return null
  }
}

export async function servePublicWebsite(request, response, distDir) {
  const url = request.url ?? '/'
  if (isBackendPath(url)) return false
  if (request.method !== 'GET' && request.method !== 'HEAD') return false
  const pathname = getSafePathname(url)
  if (!pathname) {
    response.writeHead(404, { 'Cache-Control': 'no-store' })
    response.end()
    return true
  }

  const requestedPath = pathname === '/' ? 'index.html' : pathname.slice(1)
  const isAsset = requestedPath.startsWith('assets/') || (requestedPath.includes('.') && !requestedPath.endsWith('.html'))
  const candidates = []
  if (pathname === '/') candidates.push('index.html')
  else {
    candidates.push(`${requestedPath}/index.html`)
    if (!requestedPath.includes('.')) candidates.push(`${requestedPath}.html`)
    candidates.push(requestedPath)
  }
  let resource = null
  let relativePath = 'index.html'
  for (const candidate of candidates) {
    resource = await readResource(distDir, candidate)
    if (resource) { relativePath = candidate; break }
  }
  const fallback = !resource && !isAsset ? await readResource(distDir, 'index.html') : null
  const selected = resource ?? fallback
  if (!selected) return false
  if (!resource) relativePath = 'index.html'
  response.writeHead(200, {
    'Content-Type': MIME_TYPES.get(path.extname(relativePath).toLowerCase()) ?? 'application/octet-stream',
    'Content-Length': selected.size,
    'Cache-Control': cachePolicy(relativePath),
    'X-Content-Type-Options': 'nosniff',
  })
  if (request.method === 'HEAD') response.end()
  else response.end(await readFile(selected.resolved))
  return true
}
