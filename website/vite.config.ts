import { createServer, defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { metadataFor, publicMetadata } from './src/publicMetadata.ts'

const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
function publicHead(html: string, route: string) {
  const meta = metadataFor(route)
  let next = html.replace(/<title>[^<]*<\/title>/, `<title>${escape(meta.title)}</title>`)
    .replace(/<meta (?:name="description"|property="og:[^"]*")[^>]*>/g, '')
    .replace(/<link rel="canonical"[^>]*>/g, '')
  const tags = `<link rel="canonical" href="${meta.canonical}" />
    <meta name="description" content="${escape(meta.description)}" />
    <meta name="robots" content="${meta.robots}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${meta.canonical}" />
    <meta property="og:title" content="${escape(meta.title)}" />
    <meta property="og:description" content="${escape(meta.description)}" />
    <meta property="og:image" content="${meta.image}" />
    <meta property="og:image:alt" content="LocalizationHub — game localization, local-first; Godot, Unreal, Unity, JSON, CSV and PO" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escape(meta.title)}" />
    <meta name="twitter:description" content="${escape(meta.description)}" />
    <meta name="twitter:image" content="${meta.image}" />`
  next = next.replace('</head>', `${tags}\n</head>`)
  if (route === '/') {
    const schema = { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'LocalizationHub', url: meta.canonical, description: meta.description, applicationCategory: 'DeveloperApplication', operatingSystem: 'Windows, Web', inLanguage: ['en', 'ar'] }
    next = next.replace('</head>', `<script id="product-schema" type="application/ld+json">${JSON.stringify(schema)}</script>\n</head>`)
  }
  return next
}

/** Render the real React tree rather than a separately maintained SEO copy. */
function prerenderPublicPages(): Plugin {
  let root = ''
  let outDir = ''
  return {
    name: 'prerender-public-pages',
    configResolved(config) { root = config.root; outDir = path.resolve(root, config.build.outDir) },
    async closeBundle() {
      const source = readFileSync(path.join(outDir, 'index.html'), 'utf8')
      writeFileSync(path.join(outDir, 'app-shell.html'), publicHead(source, '/app'))
      const renderer = await createServer({ root, configFile: false, plugins: [react()], server: { middlewareMode: true, watch: null }, appType: 'custom', ssr: { noExternal: ['@localizationhub/core', '@localizationhub/i18n'] } })
      try {
        const { renderPublicPage } = await renderer.ssrLoadModule('/src/publicEntry.tsx')
        for (const route of Object.keys(publicMetadata)) {
          const target = path.join(outDir, route === '/' ? 'index.html' : `${route.slice(1)}/index.html`)
          mkdirSync(path.dirname(target), { recursive: true })
          writeFileSync(target, publicHead(source, route).replace('<div id="root"></div>', `<div id="root" data-prerendered="${route}">${renderPublicPage(route)}</div>`))
        }
      } finally { await renderer.close() }
    },
  }
}

export default defineConfig({
  root: process.cwd().endsWith('website') ? '.' : 'website',
  server: { host: '0.0.0.0', allowedHosts: ['terminal.local'] },
  plugins: [react(), {
    name: 'web-build-manifest',
    generateBundle(_options, bundle) {
      const entries = Object.values(bundle).filter((item) => item.type === 'chunk' && item.isEntry).map((item) => item.fileName).sort()
      this.emitFile({ type: 'asset', fileName: 'web-build.json', source: JSON.stringify({ entries }) })
    },
  }, prerenderPublicPages()],
})
